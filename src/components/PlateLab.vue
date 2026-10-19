<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const props = defineProps({ mode: { type: Object, required: true }, replayKey: { type: Number, default: 0 } })
const host = ref(null)
const progress = ref(0)
const playing = ref(true)
const speed = ref(1)
const phase = computed(() => progress.value < 25 ? 0 : progress.value < 75 ? 1 : 2)
const stages = computed(() => ({
  divergent: ['地壳开始拉伸', '裂隙扩大 · 岩浆上涌', '裂谷形成 · 新地壳出现'],
  collision: ['两块大陆相向运动', '地层受到挤压与褶皱', '山脉逐渐抬升'],
  transform: ['两侧地表标记对齐', '板块沿断层水平滑动', '地表错位 · 断层活动'],
}[props.mode.id]))
let renderer, scene, camera, controls, observer, animation, objects
let visibilityObserver
let inView = false
let previousTime = 0
let visualTime = 0
let disposed = false

function disposeObject(group) {
  if (!group) return
  const geometries = new Set()
  const materials = new Set()
  group.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry)
    if (object.material) materials.add(object.material)
  })
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
  group.removeFromParent()
}

function slab(color) {
  const group = new THREE.Group()
  const strata = [
    { height: 0.42, y: 0.34, color },
    { height: 0.45, y: -0.095, color: 0xc39870 },
    { height: 0.55, y: -0.595, color: 0x527789 },
    { height: 0.4, y: -1.07, color: 0x294b63 },
  ]
  strata.forEach((layer) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(5.2, layer.height, 3.1), new THREE.MeshStandardMaterial({ color: layer.color, roughness: 0.74 }))
    mesh.position.y = layer.y
    mesh.castShadow = mesh.receiveShadow = true
    group.add(mesh)
  })
  const marker = new THREE.Mesh(new THREE.BoxGeometry(5.21, 0.025, 0.12), new THREE.MeshBasicMaterial({ color: 0xffe4a4 }))
  marker.position.y = 0.558
  marker.visible = props.mode.id === 'transform'
  group.add(marker)
  return group
}

function mountainGeometry() {
  const geometry = new THREE.PlaneGeometry(4.4, 3.08, 64, 22)
  geometry.rotateX(-Math.PI / 2)
  const positions = geometry.attributes.position
  const colors = new Float32Array(positions.count * 3)
  const low = new THREE.Color(0x6c9587)
  const high = new THREE.Color(0xe5d2b5)
  const snow = new THREE.Color(0xf6f9ff)
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index)
    const z = positions.getZ(index)
    const ridge = Math.exp(-x * x * 0.82)
    const height = ridge * (1.75 + Math.sin(z * 5 + x * 1.8) * 0.33 + Math.sin(z * 9 - x * 3) * 0.19)
    positions.setY(index, height)
    const color = low.clone().lerp(high, Math.min(height / 2.25, 1))
    if (height > 1.8) color.lerp(snow, (height - 1.8) * 2.8)
    colors[index * 3] = color.r
    colors[index * 3 + 1] = color.g
    colors[index * 3 + 2] = color.b
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

function buildModel() {
  if (!scene) return
  disposeObject(objects?.group)
  const group = new THREE.Group()
  scene.add(group)
  const left = slab(0x60ada8)
  const right = slab(0x8ab5cc)
  group.add(left, right)
  const mantle = new THREE.Mesh(new THREE.BoxGeometry(13.4, 0.5, 4.5), new THREE.MeshStandardMaterial({ color: 0xa94f36, emissive: 0x72341f, emissiveIntensity: 0.55, roughness: 0.85 }))
  mantle.position.y = -1.75
  group.add(mantle)
  const magma = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.82, 2.25, 20), new THREE.MeshStandardMaterial({ color: 0xffa45f, emissive: 0xff572c, emissiveIntensity: 1.2, roughness: 0.45 }))
  magma.position.y = -0.73
  group.add(magma)
  const newCrust = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 3.08), new THREE.MeshStandardMaterial({ color: 0x4d6b76, roughness: 0.9 }))
  newCrust.position.y = 0.19
  group.add(newCrust)
  const mountain = new THREE.Mesh(mountainGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.92 }))
  mountain.position.y = 0.55
  mountain.castShadow = mountain.receiveShadow = true
  group.add(mountain)
  const folds = Array.from({ length: 4 }, (_, layer) => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(65 * 3), 3))
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: layer % 2 ? 0xedd1a0 : 0x7495a0 }))
    group.add(line)
    return line
  })
  const fault = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.025, 4.7), new THREE.MeshBasicMaterial({ color: 0xffd184 }))
  fault.position.y = 0.57
  group.add(fault)
  const rings = Array.from({ length: 3 }, (_, index) => {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 72), new THREE.MeshBasicMaterial({ color: 0xffc77f, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }))
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(0, 0.6, index * 0.3 - 0.3)
    group.add(mesh)
    return mesh
  })
  const bubbles = Array.from({ length: 24 }, (_, index) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.045 + index % 3 * 0.02, 8, 6), new THREE.MeshBasicMaterial({ color: index % 2 ? 0xffd796 : 0xff8551 }))
    group.add(mesh)
    return mesh
  })
  const arrows = [-1, 1].map((side) => {
    const direction = props.mode.id === 'transform'
      ? new THREE.Vector3(0, 0, side)
      : new THREE.Vector3(side * (props.mode.id === 'collision' ? -1 : 1), 0, 0)
    const arrow = new THREE.ArrowHelper(direction, new THREE.Vector3(side * 3.8, 1.15, 0), 1.9, side < 0 ? 0x77e2db : 0xb9deff, 0.38, 0.24)
    arrow.line.material.toneMapped = false
    arrow.cone.material.toneMapped = false
    group.add(arrow)
    return arrow
  })
  objects = { group, left, right, magma, mountain, newCrust, folds, fault, rings, bubbles, arrows }
  updateModel()
}

function updateModel() {
  if (!objects) return
  const p = progress.value / 100
  const { left, right, magma, mountain, newCrust, folds, fault, rings, bubbles, arrows } = objects
  const divergent = props.mode.id === 'divergent'
  const collision = props.mode.id === 'collision'
  left.position.set(-2.75 + (divergent ? -p * 1.1 : collision ? p * 0.65 : 0), 0, divergent || collision ? 0 : -p * 1.25)
  right.position.set(2.75 + (divergent ? p * 1.1 : collision ? -p * 0.65 : 0), 0, divergent || collision ? 0 : p * 1.25)
  left.rotation.z = divergent ? p * 0.025 : 0
  right.rotation.z = divergent ? -p * 0.025 : 0
  magma.visible = newCrust.visible = divergent
  magma.scale.set(0.2 + p * 0.85, 0.45 + p * 0.55, 1)
  newCrust.scale.x = 0.1 + p * 2.1
  mountain.visible = collision
  mountain.scale.y = Math.pow(p, 1.25)
  folds.forEach((line, layer) => {
    line.visible = collision
    const positions = line.geometry.attributes.position
    for (let index = 0; index < 65; index++) {
      const x = -2.2 + index / 64 * 4.4
      const height = Math.exp(-x * x * 0.82) * 1.55 * Math.pow(p, 1.25)
      positions.setXYZ(index, x, 0.56 + height - layer * 0.2, 1.558)
    }
    positions.needsUpdate = true
  })
  fault.visible = !divergent && !collision
  rings.forEach((ring, index) => {
    ring.visible = !divergent && !collision && p > 0.35
    const pulse = (visualTime / 2 + index / 3) % 1
    ring.scale.setScalar(0.15 + pulse * 2.7)
    ring.material.opacity = (1 - pulse) * 0.65
  })
  bubbles.forEach((bubble, index) => {
    bubble.visible = divergent && p > 0.1
    const rise = (visualTime * 0.45 + index / 24) % 1
    bubble.position.set(Math.sin(index * 2.4) * (0.14 + p * 0.7), -1.45 + rise * 2.1, Math.cos(index * 1.8) * 1.2)
    bubble.scale.setScalar((1 - rise) * 0.9 + 0.25)
  })
  arrows.forEach((arrow, index) => {
    arrow.position.z = props.mode.id === 'transform' ? (index ? p : -p) * 1.25 : 0
  })
}

function replay() {
  progress.value = 0
  visualTime = 0
  playing.value = true
}

function scrub(event) {
  progress.value = Number(event.target.value)
  playing.value = false
  updateModel()
}

function togglePlay() {
  if (progress.value >= 100) return replay()
  playing.value = !playing.value
}

function resetView() {
  const aspect = host.value.clientWidth / host.value.clientHeight
  camera.position.set(10, 7.2, 11).multiplyScalar(aspect < 1.4 ? 1.42 : 1.16)
  controls.target.set(0, -0.5, 0)
  controls.update()
}

watch(() => props.mode.id, () => { replay(); buildModel() })
watch(() => props.replayKey, replay)

onMounted(() => {
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  host.value.appendChild(renderer.domElement)
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.enablePan = false
  controls.minDistance = 12
  controls.maxDistance = 42
  controls.minPolarAngle = 0.3
  controls.maxPolarAngle = Math.PI / 2.1
  resetView()
  scene.add(new THREE.HemisphereLight(0xdcf3ff, 0x445775, 2))
  const key = new THREE.DirectionalLight(0xfff2d9, 3.2)
  key.position.set(2, 10, 6)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.camera.left = key.shadow.camera.bottom = -9
  key.shadow.camera.right = key.shadow.camera.top = 9
  key.shadow.normalBias = 0.03
  scene.add(key)
  const rim = new THREE.DirectionalLight(0x73cfff, 2)
  rim.position.set(-6, 4, -8)
  scene.add(rim)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.25 }))
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -2.01
  floor.receiveShadow = true
  scene.add(floor)
  buildModel()
  observer = new ResizeObserver(() => {
    if (!host.value || disposed) return
    const { clientWidth, clientHeight } = host.value
    renderer.setSize(clientWidth, clientHeight)
    camera.aspect = clientWidth / clientHeight
    camera.updateProjectionMatrix()
  })
  observer.observe(host.value)
  visibilityObserver = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting }, { threshold: 0.15 })
  visibilityObserver.observe(host.value)
  const frame = (time) => {
    if (disposed) return
    const delta = Math.min((time - previousTime) / 1000 || 0, 0.05)
    previousTime = time
    if (playing.value && inView) {
      visualTime += delta * speed.value
      progress.value = Math.min(100, progress.value + delta * 10 * speed.value)
      if (progress.value === 100) playing.value = false
    }
    if (inView) {
      updateModel()
      controls.update()
      renderer.render(scene, camera)
    }
    animation = requestAnimationFrame(frame)
  }
  animation = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(animation)
  observer?.disconnect()
  visibilityObserver?.disconnect()
  controls?.dispose()
  disposeObject(objects?.group)
  scene?.traverse((object) => {
    object.geometry?.dispose()
    object.material?.dispose()
    object.shadow?.map?.dispose()
  })
  renderer?.dispose()
})
</script>

<template>
  <section class="process-lab plate-lab" aria-label="板块运动三维实验">
    <div class="lab-heading"><div><span class="lab-eyebrow">TECTONIC STUDIO</span><h3>{{ mode.name }}，让地表发生变化</h3></div><span class="lab-type">可旋转 3D 剖面</span></div>
    <div class="plate-lab-stage">
      <div ref="host" class="plate-lab-canvas"></div>
      <div class="lab-stage-caption"><span class="stage-dot"></span>{{ stages[phase] }}</div>
      <div class="strata-legend"><span><i></i>岩石圈</span><span><i></i>地幔上部</span></div>
      <button class="lab-view-reset" @click="resetView" aria-label="重置剖面视角">⤢</button>
      <span class="lab-drag-hint">拖动旋转 · 滚轮缩放</span>
    </div>
    <div class="lab-playback">
      <button class="lab-play-button" @click="togglePlay" :aria-label="playing ? '暂停板块演示' : '播放板块演示'">{{ playing ? 'Ⅱ' : '▶' }}</button>
      <div class="lab-timeline"><div><span>运动过程</span><strong>{{ Math.round(progress) }}%</strong></div><input type="range" min="0" max="100" step="0.1" :value="progress" @input="scrub" aria-label="板块运动演示进度" /></div>
      <button class="lab-speed" @click="speed = speed === 1 ? 2 : 1">{{ speed }}×</button>
      <button class="lab-restart" @click="replay">↻ 重播</button>
    </div>
    <div class="process-steps"><div v-for="(stage, index) in stages" :key="stage" :class="{ active: index === phase, done: index < phase }"><span>{{ String(index + 1).padStart(2, '0') }}</span><p>{{ stage }}</p></div></div>
    <p class="lab-footnote">观察运动方向与地表变化的关系。动画经过时间压缩和形变放大，属于教学原理示意。</p>
  </section>
</template>
