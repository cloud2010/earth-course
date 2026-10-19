import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

function disposeGroup(group) {
  const geometries = new Set()
  const materials = new Set()
  group.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry)
    if (object.material) {
      const entries = Array.isArray(object.material) ? object.material : [object.material]
      entries.forEach((material) => materials.add(material))
    }
  })
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
  group.clear()
}

function glowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.2, 'rgba(255,255,255,.8)')
  gradient.addColorStop(0.55, 'rgba(255,255,255,.18)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(canvas)
}

function sphericalRoute(globe, coordinates) {
  const curve = new THREE.CatmullRomCurve3(coordinates.map(([lat, lng]) => {
    const point = globe.getCoords(lat, lng, 0.025)
    return new THREE.Vector3(point.x, point.y, point.z)
  }))
  const radius = globe.getGlobeRadius() * 1.025
  const samples = Array.from({ length: 401 }, (_, index) => curve.getPoint(index / 400).normalize().multiplyScalar(radius))
  return (progress, target = new THREE.Vector3()) => {
    const position = THREE.MathUtils.clamp(progress, 0, 0.99999) * 400
    const index = Math.floor(position)
    return target.copy(samples[index]).lerp(samples[index + 1], position - index).normalize().multiplyScalar(radius)
  }
}

export function createEarthMaterial(globe) {
  const renderer = globe.renderer()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.16

  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const environment = pmrem.fromScene(room, 0.03)
  room.dispose()
  pmrem.dispose()
  const material = new THREE.MeshPhysicalMaterial({
    roughness: 0.87,
    metalness: 0,
    clearcoat: 0.58,
    clearcoatRoughness: 0.42,
    bumpScale: 0.38,
    envMap: environment.texture,
    envMapIntensity: 0.38,
  })
  const loader = new THREE.TextureLoader()
  let disposed = false
  const textures = []
  loader.load('/earth/earth-water.png', (texture) => {
    if (disposed) return texture.dispose()
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8)
    textures.push(texture)
    material.clearcoatMap = texture
    // The satellite composite has almost black open water. Lift only the
    // ocean's diffuse blue while retaining the original land and coastal detail.
    material.onBeforeCompile = (shader) => {
      shader.uniforms.earthWaterMask = { value: texture }
      shader.fragmentShader = 'uniform sampler2D earthWaterMask;\n' + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        #include <map_fragment>
        #ifdef USE_MAP
          float oceanMask = texture2D(earthWaterMask, vMapUv).r;
          diffuseColor.rgb += vec3(0.006, 0.033, 0.085) * oceanMask;
        #endif
      `)
    }
    material.customProgramCacheKey = () => 'earth-ocean-diffuse-v1'
    material.needsUpdate = true
  })
  globe.globeMaterial(material)
  globe.bumpImageUrl('/earth/earth-topology.png')

  const cloudMaterial = new THREE.MeshPhongMaterial({ transparent: true, opacity: 0.2, depthWrite: false })
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(globe.getGlobeRadius() * 1.008, 96, 64), cloudMaterial)
  clouds.renderOrder = 2
  // Visual overlays must not consume globe.gl's pointer picking.
  clouds.raycast = () => {}
  globe.scene().add(clouds)
  loader.load('/earth/earth-clouds.png', (texture) => {
    if (disposed) return texture.dispose()
    texture.colorSpace = THREE.SRGBColorSpace
    textures.push(texture)
    cloudMaterial.map = texture
    cloudMaterial.needsUpdate = true
  })

  const key = new THREE.DirectionalLight(0xfff3e1, 2.8)
  const fill = new THREE.DirectionalLight(0xa9daff, 0.9)
  const ambient = new THREE.HemisphereLight(0xd8f0ff, 0x35557e, 1.25)
  globe.lights([ambient, key, fill])

  return {
    update({ nightMode, solarLatitude, solarLongitude, showClouds }, delta = 0) {
      if (nightMode) {
        const sun = globe.getCoords(solarLatitude, solarLongitude)
        key.position.set(sun.x, sun.y, sun.z).multiplyScalar(5)
        key.intensity = 2.8
        ambient.intensity = 0.06
        fill.intensity = 0
        material.envMapIntensity = 0.035
      } else {
        const camera = globe.camera()
        key.position.copy(camera.position).applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.32)
        key.position.y += 180
        fill.position.copy(camera.position).applyAxisAngle(new THREE.Vector3(0, 1, 0), 1.35)
        key.intensity = 2.8
        ambient.intensity = 1.5
        fill.intensity = 0.9
        material.envMapIntensity = 0.3
      }
      clouds.visible = showClouds
      clouds.rotation.y += delta * 0.003
      cloudMaterial.opacity = nightMode ? 0.16 : 0.2
      if (material.map) material.map.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8)
    },
    dispose() {
      disposed = true
      globe.scene().remove(clouds)
      clouds.geometry.dispose()
      cloudMaterial.dispose()
      textures.forEach((texture) => texture.dispose())
      environment.dispose()
      material.dispose()
    },
  }
}

export function createGlobeEffects(globe) {
  const currentsGroup = new THREE.Group()
  const platesGroup = new THREE.Group()
  globe.scene().add(currentsGroup, platesGroup)
  const glow = glowTexture()
  let flows = []
  let plateArrows = []
  let boundaryRings = []
  let flowTime = 0
  let plateTime = 0
  const point = new THREE.Vector3()
  const ahead = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)

  return {
    setCurrents(currents, selectedId) {
      disposeGroup(currentsGroup)
      flows = currents.map((current) => {
        const selected = current.id === selectedId
        const sample = sphericalRoute(globe, current.points)
        const color = current.category === 'warm' ? 0xffa35c : 0x65ddff
        const count = selected ? 6 : 3
        const heads = Array.from({ length: count }, () => {
          const mesh = new THREE.Mesh(new THREE.ConeGeometry(selected ? 1.1 : 0.65, selected ? 3.4 : 2.2, 8), new THREE.MeshBasicMaterial({ color, toneMapped: false }))
          mesh.raycast = () => {}
          currentsGroup.add(mesh)
          return mesh
        })
        const positions = new Float32Array(count * 14 * 3)
        const colors = new Float32Array(positions.length)
        const baseColor = new THREE.Color(color)
        for (let index = 0; index < count * 14; index++) {
          const strength = 1 - (index % 14) / 16
          colors[index * 3] = baseColor.r * strength
          colors[index * 3 + 1] = baseColor.g * strength
          colors[index * 3 + 2] = baseColor.b * strength
        }
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        const trail = new THREE.Points(geometry, new THREE.PointsMaterial({
          size: selected ? 3.2 : 1.9, map: glow, transparent: true, opacity: selected ? 0.95 : 0.72,
          depthWrite: false, vertexColors: true, blending: THREE.AdditiveBlending,
          toneMapped: false,
        }))
        trail.frustumCulled = false
        trail.raycast = () => {}
        currentsGroup.add(trail)
        return { heads, sample, positions, geometry }
      })
    },
    setPlateMode(mode) {
      disposeGroup(platesGroup)
      plateArrows = []
      boundaryRings = []
      const sample = sphericalRoute(globe, mode.points)
      for (let index = 0; index < 5; index++) {
        const t = 0.15 + index * 0.17
        const center = sample(t)
        const normal = center.clone().normalize()
        const tangent = sample(t + 0.012).sub(sample(t - 0.012)).normalize()
        const across = tangent.clone().cross(normal).normalize()
        for (const side of [-1, 1]) {
          const direction = mode.id === 'transform' ? tangent.clone().multiplyScalar(side) : across.clone().multiplyScalar(side * (mode.id === 'collision' ? -1 : 1))
          const arrow = new THREE.Group()
          const material = new THREE.MeshBasicMaterial({ color: side < 0 ? 0x58e7ff : 0xffb460, toneMapped: false })
          const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3.1, 8), material)
          const tip = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.8, 8), material)
          tip.position.y = 2.3
          arrow.add(shaft, tip)
          arrow.scale.setScalar(1.4)
          arrow.quaternion.setFromUnitVectors(up, direction)
          arrow.traverse((object) => { object.raycast = () => {} })
          platesGroup.add(arrow)
          plateArrows.push({ arrow, center, across, direction, side })
        }
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.05, 32), new THREE.MeshBasicMaterial({ color: 0xee94ff, transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }))
        ring.position.copy(center).multiplyScalar(1.004)
        ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
        ring.raycast = () => {}
        platesGroup.add(ring)
        boundaryRings.push({ ring, offset: index * 0.23 })
      }
    },
    update(delta, { lesson, motion, speed }) {
      currentsGroup.visible = lesson === 'currents'
      platesGroup.visible = lesson === 'plates'
      if (lesson === 'currents') {
        if (motion) flowTime += delta * speed / 16
        for (const flow of flows) {
          flow.heads.forEach((head, index) => {
            const t = (flowTime + index / flow.heads.length) % 1
            flow.sample(t, point)
            head.position.copy(point)
            const forward = t < 0.993
            flow.sample(t + (forward ? 0.007 : -0.007), ahead)
            head.quaternion.setFromUnitVectors(up, ahead.sub(point).multiplyScalar(forward ? 1 : -1).normalize())
            for (let tail = 0; tail < 14; tail++) {
              flow.sample(Math.max(0, t - tail * 0.004), point)
              const offset = (index * 14 + tail) * 3
              flow.positions[offset] = point.x
              flow.positions[offset + 1] = point.y
              flow.positions[offset + 2] = point.z
            }
          })
          flow.geometry.attributes.position.needsUpdate = true
        }
      }
      if (lesson === 'plates') {
        plateTime += delta
        const shift = (plateTime % 3) / 3 * 2.5
        plateArrows.forEach(({ arrow, center, across, direction, side }) => {
          arrow.position.copy(center).addScaledVector(across, side * 5.4).addScaledVector(direction, shift)
          arrow.position.normalize().multiplyScalar(globe.getGlobeRadius() * 1.038)
        })
        boundaryRings.forEach(({ ring, offset }) => {
          const pulse = (plateTime / 2.6 + offset) % 1
          ring.scale.setScalar(1 + pulse * 4)
          ring.material.opacity = (1 - pulse) * 0.65
        })
      }
    },
    dispose() {
      disposeGroup(currentsGroup)
      disposeGroup(platesGroup)
      glow.dispose()
      globe.scene().remove(currentsGroup, platesGroup)
    },
  }
}
