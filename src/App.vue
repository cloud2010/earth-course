<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import Globe from 'globe.gl'
import * as THREE from 'three'
import OceanLab from './components/OceanLab.vue'
import PlateLab from './components/PlateLab.vue'
import { createEarthMaterial, createGlobeEffects } from './scene/globeEffects.js'

const lessons = [
  { id: 'earth', number: '01', title: '认识地球', subtitle: '一颗有生命的蓝色星球', icon: '◉' },
  { id: 'grid', number: '02', title: '经纬网', subtitle: '给地球编一张定位网', icon: '⌗' },
  { id: 'daynight', number: '03', title: '昼夜更替', subtitle: '太阳照亮地球的一半', icon: '◐' },
  { id: 'seasons', number: '04', title: '回归线与四季', subtitle: '追踪太阳直射点的旅行', icon: '☼' },
  { id: 'currents', number: '05', title: '海洋与洋流', subtitle: '追踪海水与热量的旅程', icon: '≋' },
  { id: 'plates', number: '06', title: '板块运动', subtitle: '大陆与海洋如何改变', icon: '⇄' },
]

const lessonCopy = {
  earth: {
    eyebrow: '地球 · 01 / 06',
    title: '从太空看我们的家',
    intro: '地球是一个近似球体的星球。转动它，看看海洋与大陆如何铺展在球面上。',
    factTitle: '地球有多大？',
    fact: '平均半径约 6,371 千米，赤道周长约 4 万千米。',
    hint: '拖动地球旋转 · 滚轮缩放 · 点击球面读取坐标',
    note: '观察地球时，海洋约占表面积的 71%，陆地约占 29%。',
  },
  grid: {
    eyebrow: '地图 · 02 / 06',
    title: '给地球编一张定位网',
    intro: '经线连接南北两极，纬线与赤道平行。它们相交形成经纬网，帮助我们描述地球上的位置。',
    factTitle: '坐标怎么读？',
    fact: '先读纬度，再读经度。例如上海约为（31°N，121°E）。',
    hint: '打开经纬网图层 · 点击地球任意位置试着读坐标',
    note: '纬线指示东西，经线指示南北；所有经线等长，赤道是最长的纬线。',
  },
  daynight: {
    eyebrow: '地球运动 · 03 / 06',
    title: '太阳照亮地球的一半',
    intro: '地球是不透明的球体，太阳光只能照亮一半。地球不停自转，于是昼夜不断更替。',
    factTitle: '晨线与昏线',
    fact: '顺着自转方向，由夜进入昼的是晨线；由昼进入夜的是昏线。',
    hint: '拖动“模拟时刻”滑块，观察亮面与暗面移动',
    note: '昼夜更替由地球自转产生。地球自西向东自转，周期约为 24 小时。',
  },
  seasons: {
    eyebrow: '地球运动 · 04 / 06',
    title: '太阳直射点在南北之间旅行',
    intro: '地球公转时，地轴保持倾斜且方向基本不变。太阳直射点便在南、北回归线之间往返移动。',
    factTitle: '记住两个界限',
    fact: '地球绕太阳自西向东公转，约 365 天一周。公转时地轴倾斜且方向基本不变。',
    hint: '拖动日期，观察直射点在南北回归线之间移动',
    note: '北半球夏至前后直射北回归线，冬至前后直射南回归线；南北半球季节相反。',
  },
  currents: {
    eyebrow: '海洋 · 05 / 06',
    title: '追随洋流，发现海洋在运动',
    intro: '海水并非静止不动。风等因素推动表层海水形成有方向的流动；洋流还能把热量带到不同海域。',
    factTitle: '洋流是什么？',
    fact: '海水大规模、较稳定地沿一定方向流动，称为洋流。暖流和寒流是相对流经海区周边海水而言的。',
    hint: '沿亮点与箭头看流向 · 在下方实验中观察海水输送',
    note: '洋流会影响沿岸气候和海洋生物分布；判断气候时，还要综合考虑纬度、盛行风、海陆位置与地形。',
  },
  plates: {
    eyebrow: '地表变化 · 06 / 06',
    title: '板块运动，塑造地表',
    intro: '地球岩石圈由六大板块拼合而成。板块缓慢移动，在交界处张裂、碰撞或错动，塑造山脉、裂谷，也带来地震与火山活动。',
    factTitle: '板块交界处',
    fact: '板块内部相对稳定，交界处地壳活动较活跃。观察不同的运动方式，看看地表会发生什么变化。',
    hint: '球面定位边界 · 在下方拖动三维剖面，观察形变',
    note: '全球板块边界的路线经过简化；剖面动画帮助理解原理，不按真实速度和高差呈现。',
  },
}

const oceanCurrents = [
  {
    id: 'north-atlantic', name: '墨西哥湾流—北大西洋暖流', shortName: '北大西洋暖流', category: 'warm',
    region: '北大西洋 · 向欧洲延伸', center: { lat: 48, lng: -36 },
    points: [[25, -80], [31, -77], [37, -72], [41, -64], [44, -54], [47, -43], [51, -31], [55, -20], [59, -9], [61, 2], [64, 12], [66, 20]],
    story: '这支暖流从墨西哥湾附近沿北美东岸北上，再向东北延伸至西欧附近，把较暖海水携带到高纬度海域，影响西欧部分沿岸气候。区域气候还受纬度、风和海陆位置等因素共同影响。',
  },
  {
    id: 'canary', name: '加那利寒流', shortName: '加那利寒流', category: 'cold',
    region: '非洲西北岸 · 向南流', center: { lat: 27, lng: -17 },
    points: [[38, -15], [33, -16], [28, -17], [23, -18], [18, -18], [13, -17]],
    story: '加那利寒流沿非洲西北岸大致向南流。它说明同一纬度的沿岸地区，也可能因洋流不同而出现气温差异。',
  },
  {
    id: 'kuroshio', name: '黑潮（日本暖流）', shortName: '黑潮（日本暖流）', category: 'warm',
    region: '西北太平洋 · 沿日本南侧向东北', center: { lat: 31, lng: 135 },
    points: [[20, 123], [24, 126], [28, 130], [32, 134], [36, 139], [40, 145], [43, 151]],
    story: '黑潮沿台湾东侧、日本列岛南侧向东北流，是西北太平洋的重要暖流。读图时要沿流线看方向，不要只凭海岸线的朝向猜测。',
  },
  {
    id: 'peru', name: '秘鲁寒流', shortName: '秘鲁寒流', category: 'cold',
    region: '南美洲西岸 · 向北流', center: { lat: -22, lng: -77 },
    points: [[-42, -75], [-34, -75], [-26, -76], [-18, -78], [-11, -80], [-5, -81], [-1, -82]],
    story: '秘鲁寒流沿南美洲西岸大致向北流。秘鲁附近的冷水上涌能带来丰富营养物质，有利于渔业发展；但沿岸气候还会受其他因素共同影响。',
  },
  {
    id: 'california', name: '加利福尼亚寒流', shortName: '加利福尼亚寒流', category: 'cold',
    region: '北美洲西岸 · 向南流', center: { lat: 34, lng: -123 },
    points: [[48, -128], [42, -127], [36, -125], [30, -122], [24, -118], [18, -112]],
    story: '加利福尼亚寒流沿北美洲西岸向南流，是北太平洋环流的一部分。',
  },
  {
    id: 'brazil', name: '巴西暖流', shortName: '巴西暖流', category: 'warm',
    region: '南美洲东岸 · 向南流', center: { lat: -21, lng: -43 },
    points: [[4, -34], [-4, -35], [-12, -39], [-20, -43], [-28, -47], [-36, -51]],
    story: '巴西暖流沿南美洲东岸大致向南流。它与秘鲁寒流分处南美洲东西两侧，适合用来比较洋流方向和性质。',
  },
  {
    id: 'benguela', name: '本格拉寒流', shortName: '本格拉寒流', category: 'cold',
    region: '非洲西南岸 · 向北流', center: { lat: -22, lng: 12 },
    points: [[-36, 16], [-30, 14], [-24, 12], [-18, 11], [-12, 10], [-6, 9]],
    story: '本格拉寒流沿非洲西南岸向北流。把它和同纬度的巴西暖流放在一起观察，可以发现洋流常沿大洋边缘形成环流。',
  },
  {
    id: 'east-australia', name: '东澳大利亚暖流', shortName: '东澳大利亚暖流', category: 'warm',
    region: '澳大利亚东岸 · 向南流', center: { lat: -27, lng: 153 },
    points: [[-14, 153], [-20, 154], [-26, 154], [-32, 153], [-38, 150]],
    story: '东澳大利亚暖流沿澳大利亚东岸向南流，是南太平洋环流的一部分。',
  },
]

const plateModes = [
  {
    id: 'divergent', name: '张裂', subtitle: '背离运动', location: '东非大裂谷', region: '东非 · 约 0°N，35°E', center: { lat: 1, lng: 35 },
    story: '这里的板块彼此分离，地壳被拉开，形成东非大裂谷。若张裂持续，裂谷可能逐渐扩展，最终形成新的海洋。',
    result: '裂谷 · 新地壳',
    points: [[12, 32], [7, 34], [1, 35], [-7, 36], [-15, 35], [-23, 32], [-30, 29]],
  },
  {
    id: 'collision', name: '碰撞', subtitle: '相向挤压', location: '喜马拉雅山', region: '南亚 · 约 29°N，84°E', center: { lat: 29, lng: 84 },
    story: '印度洋板块向北运动，与亚欧板块相互挤压，地壳褶皱并抬升，形成喜马拉雅山。两块大陆碰撞是这里形成高大山脉的重要原因。',
    result: '褶皱 · 高山',
    points: [[25, 70], [28, 75], [30, 80], [31, 85], [30, 90], [28, 95]],
  },
  {
    id: 'transform', name: '错动', subtitle: '水平滑动', location: '圣安德烈斯断层', region: '北美西岸 · 约 36°N，120°W', center: { lat: 36, lng: -120 },
    story: '太平洋板块与北美洲板块沿圣安德烈斯断层水平错动。边界附近容易发生地震；这种运动不会像张裂那样形成新地壳。',
    result: '断层 · 地震',
    points: [[32.5, -116.3], [34.5, -118.5], [36, -120.5], [38.5, -122.5], [40.5, -124.2]],
  },
]

const activeLesson = ref('grid')
const globeHost = ref(null)
const globeReady = ref(false)
const showGrid = ref(true)
const showTropics = ref(true)
const showPolarCircles = ref(false)
const showAxis = ref(true)
const isRotating = ref(false)
const localHour = ref(12)
const dayOfYear = ref(172)
const currentFilter = ref('all')
const currentMotion = ref(true)
const currentSpeed = ref(1)
const showClouds = ref(true)
const selectedCurrentId = ref('north-atlantic')
const selectedPlateModeId = ref('divergent')
const plateAnimationKey = ref(0)
const selectedPoint = ref({ lat: 31.2, lng: 121.5 })
const selectedPointLabel = ref('上海附近')
const globeInstance = shallowRef(null)
let resizeObserver
let axisGroup
let earthMaterialController
let globeEffects
let animationFrame
let previousFrameTime = 0
const answerRevealed = ref(false)

const currentLesson = computed(() => lessonCopy[activeLesson.value])
const lessonIndex = computed(() => lessons.findIndex((item) => item.id === activeLesson.value))
const lessonProgress = computed(() => ((lessonIndex.value + 1) / lessons.length) * 100)
const selectedCurrent = computed(() => oceanCurrents.find((current) => current.id === selectedCurrentId.value) || oceanCurrents[0])
const selectedPlateMode = computed(() => plateModes.find((mode) => mode.id === selectedPlateModeId.value) || plateModes[0])
const platePaths = computed(() => plateModes.map((mode) => ({
  ...mode,
  name: `${mode.location} · ${mode.name}`,
  plateModeId: mode.id,
  color: mode.id === selectedPlateModeId.value ? '#ee94ff' : '#97bded',
  width: mode.id === selectedPlateModeId.value ? 1.45 : 0.48,
})))
const visibleCurrents = computed(() => oceanCurrents
  .filter((current) => currentFilter.value === 'all' || current.category === currentFilter.value)
  .map((current) => ({
    ...current,
    isCurrent: true,
    color: current.category === 'warm' ? '#ffa969' : '#62d7ff',
    width: current.id === selectedCurrentId.value ? 0.6 : 0.28,
    dashLength: 1,
    dashGap: 0,
    animateTime: 0,
  })))
const featuredCurrents = computed(() => ['north-atlantic', 'kuroshio', 'peru']
  .map((id) => oceanCurrents.find((current) => current.id === id)))
const currentFilterLabel = computed(() => ({ all: '暖流 + 寒流', warm: '暖流', cold: '寒流' }[currentFilter.value]))
const timeText = computed(() => `${String(localHour.value).padStart(2, '0')}:00`)
const dateInfo = computed(() => {
  const d = new Date(2025, 0, Number(dayOfYear.value))
  return `${d.getMonth() + 1}月${d.getDate()}日`
})
const solarDeclination = computed(() => {
  const angle = (2 * Math.PI * (Number(dayOfYear.value) - 80)) / 365
  return 23.5 * Math.sin(angle)
})
const solarLatitude = computed(() => Math.abs(solarDeclination.value) < 0.6 ? '赤道（0°）' : `${Math.abs(solarDeclination.value).toFixed(1)}°${solarDeclination.value > 0 ? 'N' : 'S'}`)
const seasonName = computed(() => {
  const n = Number(dayOfYear.value)
  if (n >= 80 && n < 172) return '北半球 · 春'
  if (n >= 172 && n < 266) return '北半球 · 夏'
  if (n >= 266 && n < 356) return '北半球 · 秋'
  return '北半球 · 冬'
})
const referenceAnswer = computed(() => ({
  earth: '因为地球是不透明的球体，太阳光只能照亮地球的一半。',
  grid: '上海约位于（31°N，121°E），在北半球、东半球。',
  daynight: '地球另一侧正被太阳照亮，处在白昼。',
  seasons: '是冬季。南北半球季节相反。',
  currents: '橙红色表示暖流，蓝色表示寒流。暖流和寒流要与周边海水比较；秘鲁寒流沿南美洲西岸大致向北流。',
  plates: selectedPlateMode.value.id === 'divergent'
    ? '是张裂。两侧板块彼此分离，地壳被拉开，形成裂谷。'
    : selectedPlateMode.value.id === 'collision'
      ? '两侧板块相向运动、相互挤压。印度洋板块与亚欧板块碰撞抬升，形成喜马拉雅山。'
      : '是水平错动。太平洋板块与北美洲板块沿边界滑动，断层附近地震多发。',
}[activeLesson.value]))
const latText = computed(() => `${Math.abs(selectedPoint.value.lat).toFixed(1)}°${selectedPoint.value.lat >= 0 ? 'N' : 'S'}`)
const lngText = computed(() => `${Math.abs(selectedPoint.value.lng).toFixed(1)}°${selectedPoint.value.lng >= 0 ? 'E' : 'W'}`)

function parallelPoints(lat, resolution = 3) {
  const points = []
  for (let lng = -180; lng <= 180; lng += resolution) points.push([lat, lng])
  return points
}

function meridianPoints(lng, resolution = 3) {
  const points = []
  for (let lat = -90; lat <= 90; lat += resolution) points.push([lat, lng])
  return points
}

function terminatorPoints(solarLat, solarLng, resolution = 4) {
  const lat = THREE.MathUtils.degToRad(solarLat)
  const lng = THREE.MathUtils.degToRad(solarLng)
  const sun = new THREE.Vector3(Math.cos(lat) * Math.cos(lng), Math.sin(lat), Math.cos(lat) * Math.sin(lng)).normalize()
  const reference = Math.abs(sun.y) < 0.85 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
  const axisA = new THREE.Vector3().crossVectors(sun, reference).normalize()
  const axisB = new THREE.Vector3().crossVectors(sun, axisA).normalize()
  const points = []
  for (let degrees = 0; degrees <= 360; degrees += resolution) {
    const angle = THREE.MathUtils.degToRad(degrees)
    const point = axisA.clone().multiplyScalar(Math.cos(angle)).add(axisB.clone().multiplyScalar(Math.sin(angle))).normalize()
    points.push([THREE.MathUtils.radToDeg(Math.asin(point.y)), THREE.MathUtils.radToDeg(Math.atan2(point.z, point.x))])
  }
  return points
}

const mapLines = computed(() => {
  const rows = []
  if (activeLesson.value === 'plates') return rows
  if (showGrid.value) {
    for (let lat = -60; lat <= 60; lat += 30) {
      if (lat !== 0 && Math.abs(lat) !== 30) rows.push({ name: `纬线 ${lat}°`, points: parallelPoints(lat), color: '#77a8b6', width: 0.12, opacity: 0.54 })
    }
    for (let lng = -180; lng < 180; lng += 30) {
      rows.push({ name: `经线 ${lng}°`, points: meridianPoints(lng), color: '#77a8b6', width: 0.12, opacity: 0.54 })
    }
  }
  rows.push({ name: '赤道 0°', points: parallelPoints(0), color: '#65dfd2', width: 0.42, opacity: 0.98 })
  if (showTropics.value || activeLesson.value === 'seasons') {
    rows.push({ name: '北回归线 23.5°N', points: parallelPoints(23.5), color: '#f7bd68', width: 0.42, opacity: 0.98 })
    rows.push({ name: '南回归线 23.5°S', points: parallelPoints(-23.5), color: '#f7bd68', width: 0.42, opacity: 0.98 })
  }
  if (showPolarCircles.value) {
    rows.push({ name: '北极圈 66.5°N', points: parallelPoints(66.5), color: '#acc9e9', width: 0.24, opacity: 0.88 })
    rows.push({ name: '南极圈 66.5°S', points: parallelPoints(-66.5), color: '#acc9e9', width: 0.24, opacity: 0.88 })
  }
  if (activeLesson.value === 'seasons') {
    rows.push({ name: '太阳直射点', points: parallelPoints(solarDeclination.value), color: '#ff997d', width: 0.6, opacity: 1 })
  }
  if (activeLesson.value === 'daynight') {
    rows.push({ name: '晨昏线', points: terminatorPoints(solarDeclination.value, sunLongitude.value), color: '#d8f0e7', width: 0.3, opacity: 0.95 })
  }
  return rows
})

const sunLongitude = computed(() => (12 - Number(localHour.value)) * 15)
const sunPoint = computed(() => ({ lat: solarDeclination.value, lng: sunLongitude.value, name: '太阳直射点' }))

function formatCoordinate(lat, lng) {
  selectedPoint.value = { lat, lng }
  selectedPointLabel.value = '选中的位置'
}

function updateGlobeLayers() {
  const globe = globeInstance.value
  if (!globe) return
  const paths = activeLesson.value === 'currents'
    ? [...mapLines.value, ...visibleCurrents.value]
    : activeLesson.value === 'plates'
      ? platePaths.value
      : mapLines.value
  globe.pathsData(paths)
    .pathPoints((d) => d.points)
    .pathColor((d) => d.color)
    .pathStroke((d) => d.width)
    .pathDashLength((d) => d.dashLength ?? 1)
    .pathDashGap((d) => d.dashGap || 0)
    .pathDashAnimateTime((d) => d.animateTime || 0)
    .pathLabel((d) => d.isCurrent ? `${d.name} · ${d.category === 'warm' ? '暖流' : '寒流'}` : d.name)
    .pathResolution(2)
    .pathTransitionDuration(220)
  globe.pointsData(activeLesson.value === 'seasons' ? [sunPoint.value] : [])
    .pointLat((d) => d.lat)
    .pointLng((d) => d.lng)
    .pointColor(() => '#ffb77e')
    .pointRadius(0.62)
    .pointAltitude(0.022)
    .pointLabel((d) => d.name)
  const currentLabels = { 'north-atlantic': 'N. ATLANTIC', canary: 'CANARY', kuroshio: 'KUROSHIO', peru: 'PERU', california: 'CALIFORNIA', brazil: 'BRAZIL', benguela: 'BENGUELA', 'east-australia': 'E. AUSTRALIA' }
  const plateLabels = { divergent: 'E. AFRICAN RIFT', collision: 'HIMALAYAS', transform: 'SAN ANDREAS' }
  const labels = activeLesson.value === 'seasons' ? [{ ...sunPoint.value, text: 'SUN' }]
    : activeLesson.value === 'currents' ? [{ ...selectedCurrent.value.center, text: currentLabels[selectedCurrentId.value] }]
      : activeLesson.value === 'plates' ? [{ ...selectedPlateMode.value.center, text: plateLabels[selectedPlateModeId.value] }]
        : []
  globe.labelsData(labels)
    .labelLat((d) => d.lat)
    .labelLng((d) => d.lng)
    .labelText((d) => d.text)
    .labelSize(0.72)
    .labelColor(() => '#ffe0ab')
    .labelDotRadius(0.26)
    .labelAltitude(0.045)
}

function updateSunlight(delta = 0) {
  earthMaterialController?.update({
    nightMode: activeLesson.value === 'daynight',
    solarLatitude: solarDeclination.value,
    solarLongitude: sunLongitude.value,
    showClouds: showClouds.value && !['currents', 'plates'].includes(activeLesson.value),
  }, typeof delta === 'number' ? delta : 0)
}

function updateAxis() {
  if (axisGroup) axisGroup.visible = showAxis.value
}

function makeAxis() {
  const group = new THREE.Group()
  const axisMaterial = new THREE.LineBasicMaterial({ color: 0xe6c47f, transparent: true, opacity: 0.82, depthTest: true })
  const axisGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -130, 0),
    new THREE.Vector3(0, 130, 0),
  ])
  group.add(new THREE.Line(axisGeometry, axisMaterial))
  const northTip = new THREE.Mesh(new THREE.ConeGeometry(2.1, 7, 12), new THREE.MeshBasicMaterial({ color: 0xf5d28e }))
  northTip.position.y = 134
  group.add(northTip)
  const northPole = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd58b }))
  northPole.position.y = 128
  group.add(northPole)
  const southPole = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 8), new THREE.MeshBasicMaterial({ color: 0xa1bfbb }))
  southPole.position.y = -128
  group.add(southPole)
  group.rotation.z = THREE.MathUtils.degToRad(-23.5)
  return group
}

function setRotation() {
  const controls = globeInstance.value?.controls()
  if (!controls) return
  controls.autoRotate = isRotating.value
  controls.autoRotateSpeed = 0.42
}

function focusLesson(id) {
  activeLesson.value = id
  answerRevealed.value = false
  if (id === 'grid') showGrid.value = true
  if (id === 'daynight') {
    showGrid.value = false
    showTropics.value = false
  }
  if (id === 'seasons') {
    showGrid.value = false
    showTropics.value = true
    dayOfYear.value = 172
  }
  if (id === 'earth') {
    showGrid.value = false
    showTropics.value = false
  }
  if (id === 'currents') {
    showGrid.value = false
    showTropics.value = false
    showPolarCircles.value = false
    showAxis.value = false
    currentFilter.value = 'all'
    currentMotion.value = true
    selectCurrent('north-atlantic')
  }
  if (id === 'plates') {
    showGrid.value = false
    showTropics.value = false
    showPolarCircles.value = false
    showAxis.value = false
    selectPlateMode('divergent')
  }
}

function selectCurrent(id) {
  const current = oceanCurrents.find((item) => item.id === id)
  if (!current) return
  selectedCurrentId.value = current.id
  if (currentFilter.value !== 'all' && currentFilter.value !== current.category) currentFilter.value = current.category
  isRotating.value = false
  globeInstance.value?.pointOfView({ ...current.center, altitude: 1.85 }, 850)
}

function setCurrentFilter(filter) {
  currentFilter.value = filter
  if (filter !== 'all' && selectedCurrent.value.category !== filter) {
    const firstVisible = oceanCurrents.find((current) => current.category === filter)
    if (firstVisible) selectCurrent(firstVisible.id)
  }
}

function selectPlateMode(id) {
  const mode = plateModes.find((item) => item.id === id)
  if (!mode) return
  selectedPlateModeId.value = mode.id
  isRotating.value = false
  plateAnimationKey.value += 1
  globeInstance.value?.pointOfView({ ...mode.center, altitude: 1.85 }, 850)
}

function replayPlateAnimation() {
  plateAnimationKey.value += 1
}

function revealAnswer() {
  if (activeLesson.value === 'grid') {
    selectedPoint.value = { lat: 31.2, lng: 121.5 }
    selectedPointLabel.value = '上海附近'
    globeInstance.value?.pointOfView({ lat: 31.2, lng: 121.5, altitude: 1.8 }, 750)
    return
  }
  answerRevealed.value = !answerRevealed.value
}

function resetGlobe() {
  if (activeLesson.value === 'currents') {
    selectCurrent(selectedCurrentId.value)
    return
  }
  if (activeLesson.value === 'plates') {
    globeInstance.value?.pointOfView({ ...selectedPlateMode.value.center, altitude: 1.85 }, 850)
    return
  }
  globeInstance.value?.pointOfView({ lat: 18, lng: 105, altitude: 2.35 }, 900)
}

function toggleRotation() {
  isRotating.value = !isRotating.value
  setRotation()
}

watch([mapLines, activeLesson, dayOfYear, visibleCurrents, selectedCurrentId, platePaths], async () => {
  await nextTick()
  updateGlobeLayers()
  updateSunlight()
  updateAxis()
})
watch(localHour, () => updateSunlight())
watch([visibleCurrents, selectedCurrentId], () => globeEffects?.setCurrents(visibleCurrents.value, selectedCurrentId.value))
watch(selectedPlateMode, () => globeEffects?.setPlateMode(selectedPlateMode.value))
watch(isRotating, setRotation)
watch(showAxis, updateAxis)

onMounted(async () => {
  await nextTick()
  if (!globeHost.value) return
  const globe = new Globe(globeHost.value, {
    rendererConfig: { antialias: true, alpha: true, powerPreference: 'high-performance' },
  })
    .backgroundColor('rgba(0,0,0,0)')
    .showAtmosphere(true)
    .atmosphereColor('#80c6ff')
    .atmosphereAltitude(0.065)
    .globeCurvatureResolution(2)
    .showGraticules(false)
    .enablePointerInteraction(true)
    .onGlobeClick(({ lat, lng }) => formatCoordinate(lat, lng))
    .onPathClick((path) => {
      if (path.isCurrent) selectCurrent(path.id)
      if (path.plateModeId) selectPlateMode(path.plateModeId)
    })
    .pointOfView({ lat: 18, lng: 105, altitude: 2.05 }, 0)
  globeInstance.value = globe
  earthMaterialController = createEarthMaterial(globe)
  globe.onGlobeReady(() => { globeReady.value = true })
    .globeImageUrl('/earth/blue-marble-june.jpg')
  globeEffects = createGlobeEffects(globe)
  globeEffects.setCurrents(visibleCurrents.value, selectedCurrentId.value)
  globeEffects.setPlateMode(selectedPlateMode.value)
  globe.controls().enableDamping = true
  globe.controls().dampingFactor = 0.09
  globe.controls().minDistance = 150
  globe.controls().maxDistance = 430
  globe.controls().autoRotate = false
  axisGroup = makeAxis()
  globe.scene().add(axisGroup)
  updateGlobeLayers()
  updateSunlight()
  resizeObserver = new ResizeObserver(() => {
    if (globeHost.value) globe.width(globeHost.value.clientWidth).height(globeHost.value.clientHeight)
  })
  resizeObserver.observe(globeHost.value)
  const frame = (time) => {
    const delta = Math.min((time - previousFrameTime) / 1000 || 0, 0.05)
    previousFrameTime = time
    updateSunlight(delta)
    globeEffects.update(delta, { lesson: activeLesson.value, motion: currentMotion.value, speed: currentSpeed.value })
    animationFrame = requestAnimationFrame(frame)
  }
  animationFrame = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  cancelAnimationFrame(animationFrame)
  globeEffects?.dispose()
  earthMaterialController?.dispose()
  axisGroup?.traverse((object) => { object.geometry?.dispose(); object.material?.dispose() })
  if (globeInstance.value) globeInstance.value._destructor?.()
})
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="#top" aria-label="地球实验室首页">
        <span class="brand-mark"><span></span></span>
        <span class="brand-copy"><strong>地球实验室</strong><small>EARTH / LAB</small></span>
      </a>
      <div class="topbar-center"><span class="topbar-dot"></span>互动地理课堂 <i></i> 六年级 · 全球篇</div>
      <div class="topbar-right"><span class="live-pill"><b></b> 探索模式</span><div class="avatar">六</div></div>
    </header>

    <div class="layout" id="top">
      <aside class="sidebar">
        <div class="side-caption">本节课程 <span>CHAPTER 01</span></div>
        <div class="course-title"><span class="course-icon">✳</span><div><strong>地球与地球仪</strong><small>认识我们的星球</small></div></div>
        <div class="progress-block"><div class="progress-meta"><span>探索进度</span><strong>{{ lessonIndex + 1 }} <i>/ {{ lessons.length }}</i></strong></div><div class="progress-track"><span :style="{ width: `${lessonProgress}%` }"></span></div></div>
        <div class="side-caption lesson-caption">学习路径 <span>{{ lessons.length }} 个知识点</span></div>
        <nav class="lesson-list" aria-label="学习路径">
          <button v-for="lesson in lessons" :key="lesson.id" class="lesson-nav" :class="{ active: activeLesson === lesson.id }" @click="focusLesson(lesson.id)">
            <span class="lesson-num">{{ lesson.number }}</span><span class="lesson-symbol">{{ lesson.icon }}</span>
            <span class="lesson-nav-copy"><strong>{{ lesson.title }}</strong><small>{{ lesson.subtitle }}</small></span>
            <span class="lesson-check">{{ lessons.findIndex(item => item.id === activeLesson) > lessons.findIndex(item => item.id === lesson.id) ? '✓' : '↗' }}</span>
          </button>
        </nav>
        <div class="side-tip"><span class="tip-star">✦</span><div><strong>学习小提示</strong><p>先观察地球，再切换控制台，发现位置与运动规律。</p></div></div>
        <div class="sidebar-footer"><span class="footer-orbit">◎</span><span>沪教版 · 五四学制</span><span class="footer-dots">•••</span></div>
      </aside>

      <main class="main-content">
        <div class="page-heading">
          <div><div class="breadcrumb"><span>课程</span><b>/</b><span>地球与地球仪</span><b>/</b><strong>{{ currentLesson.eyebrow }}</strong></div><h1>{{ currentLesson.title }}<span class="heading-spark">✳</span></h1><p>转动、观察、发现——让地理知识在眼前发生。</p></div>
          <div v-if="activeLesson !== 'currents' && activeLesson !== 'plates'" class="heading-actions"><button class="outline-button" @click="focusLesson('grid')"><span>⌗</span> 经纬网练习</button><button class="round-button" title="课程选项">···</button></div>
        </div>

        <div class="workspace-grid" :class="{ 'has-process-lab': activeLesson === 'currents' || activeLesson === 'plates' }">
          <section class="explorer-column">
            <div class="globe-card">
              <div class="card-topline"><div class="live-label"><span class="pulse-dot"></span><span>EXPLORE OUR PLANET</span></div><div class="scene-tags"><span>{{ activeLesson === 'currents' ? '洋流图层' : activeLesson === 'plates' ? '板块边界' : '地球仪' }} <b>3D</b></span><span class="accuracy-tag">{{ activeLesson === 'currents' ? '方向示意' : activeLesson === 'plates' ? '位置示意' : '示意模型' }}</span></div></div>
              <div class="globe-scene">
                <div class="scene-glow"></div><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
                <div class="scene-coordinate coordinate-top"><template v-if="activeLesson === 'currents'"><small>当前洋流 · {{ selectedCurrent.category === 'warm' ? '暖流' : '寒流' }}</small><strong>{{ selectedCurrent.shortName }}</strong></template><template v-else-if="activeLesson === 'plates'"><small>当前案例 · {{ selectedPlateMode.name }}</small><strong>{{ selectedPlateMode.location }}</strong></template><template v-else><small>当前位置</small><strong>{{ latText }} <i>/</i> {{ lngText }}</strong></template></div>
                <div class="scene-coordinate coordinate-bottom"><template v-if="activeLesson === 'currents'"><span class="mini-sun current-mark">≈</span><small>显示图层</small><strong>{{ currentFilterLabel }}</strong></template><template v-else-if="activeLesson === 'plates'"><span class="mini-sun plate-mark">⇄</span><small>运动方式</small><strong>{{ selectedPlateMode.subtitle }}</strong></template><template v-else><span class="mini-sun">☼</span><small>太阳直射</small><strong>{{ solarLatitude }}</strong></template></div>
                <div ref="globeHost" class="globe-host" :class="{ ready: globeReady }"></div>
                <div class="scene-compass"><span class="compass-n">N</span><span class="compass-arrow">↑</span><span class="compass-s">S</span></div>
                <div class="scene-hint"><span>↔</span> {{ currentLesson.hint }}</div>
                <div v-if="activeLesson === 'seasons'" class="sun-ray-caption"><span></span>太阳直射点 {{ solarLatitude }}</div>
              </div>
              <div class="globe-footer">
                <div class="selected-location"><span class="location-pin">⌖</span><div><small>{{ activeLesson === 'currents' ? selectedCurrent.region : activeLesson === 'plates' ? selectedPlateMode.region : selectedPointLabel }}</small><strong>{{ activeLesson === 'currents' ? selectedCurrent.shortName : activeLesson === 'plates' ? selectedPlateMode.location : `(${latText}, ${lngText})` }}</strong></div></div>
                <div class="globe-actions">
                  <button class="icon-control" :class="{ selected: isRotating }" @click="toggleRotation" :title="isRotating ? '暂停旋转' : '自动旋转'"><span>{{ isRotating ? 'Ⅱ' : '↻' }}</span>{{ isRotating ? '暂停' : '自转' }}</button>
                  <button v-if="activeLesson !== 'plates'" class="icon-control" :class="{ selected: showGrid }" @click="showGrid = !showGrid" title="切换经纬网"><span>⌗</span>经纬网</button>
                  <button v-if="activeLesson !== 'currents' && activeLesson !== 'plates'" class="icon-control" :class="{ selected: showClouds }" @click="showClouds = !showClouds" title="切换云层"><span>☁</span>云层</button>
                  <button class="icon-control" @click="resetGlobe" title="重置视角"><span>⤢</span>复位</button>
                </div>
              </div>
            </div>

            <div class="control-deck">
              <div class="control-heading"><div><span class="control-icon">⌁</span><strong>{{ activeLesson === 'currents' ? '洋流图层控制台' : activeLesson === 'plates' ? '板块运动实验台' : activeLesson === 'seasons' ? '公转时间轴' : '地球运动控制台' }}</strong></div><span class="control-caption">{{ activeLesson === 'currents' ? '筛选洋流，观察海水移动方向' : activeLesson === 'plates' ? '选择一种运动，观察地表结果' : '拖动滑块，观察变化' }}</span></div>
              <div v-if="activeLesson === 'currents'" class="current-controls">
                <div class="current-filter" role="group" aria-label="洋流类型">
                  <button class="filter-chip" :class="{ on: currentFilter === 'all' }" :aria-pressed="currentFilter === 'all'" @click="setCurrentFilter('all')">全部洋流</button>
                  <button class="filter-chip warm-chip" :class="{ on: currentFilter === 'warm' }" :aria-pressed="currentFilter === 'warm'" @click="setCurrentFilter('warm')">暖流</button>
                  <button class="filter-chip cold-chip" :class="{ on: currentFilter === 'cold' }" :aria-pressed="currentFilter === 'cold'" @click="setCurrentFilter('cold')">寒流</button>
                </div>
                <button class="flow-speed" @click="currentSpeed = currentSpeed === 1 ? 2 : currentSpeed === 2 ? 0.5 : 1" aria-label="切换洋流动画速度">{{ currentSpeed }}×</button>
                <button class="flow-toggle" :class="{ paused: !currentMotion }" :aria-pressed="currentMotion" @click="currentMotion = !currentMotion"><span>{{ currentMotion ? 'Ⅱ' : '▶' }}</span>{{ currentMotion ? '暂停流动' : '继续流动' }}</button>
              </div>
              <div v-else-if="activeLesson === 'plates'" class="plate-mode-controls" role="group" aria-label="板块运动方式">
                <button v-for="mode in plateModes" :key="mode.id" class="plate-mode-chip" :class="{ active: selectedPlateModeId === mode.id }" :aria-pressed="selectedPlateModeId === mode.id" @click="selectPlateMode(mode.id)"><span>{{ mode.name }}</span><small>{{ mode.subtitle }}</small></button>
                <button class="plate-replay" @click="replayPlateAnimation"><span>↻</span>重播实验</button>
              </div>
              <div class="range-row" v-else-if="activeLesson === 'seasons'">
                <div class="range-label"><span>日期</span><strong>{{ dateInfo }}</strong></div>
                <div class="range-wrap"><div class="range-scale"><span>春分</span><span>夏至</span><span>秋分</span><span>冬至</span></div><input v-model="dayOfYear" type="range" min="1" max="365" aria-label="一年中的日期" class="range-input season-range" /><div class="range-markers"><span class="mark-spring"></span><span class="mark-summer"></span><span class="mark-autumn"></span><span class="mark-winter"></span></div></div>
                <div class="range-result"><small>太阳直射</small><strong>{{ solarLatitude }}</strong></div>
              </div>
              <div class="range-row" v-else>
                <div class="range-label"><span>模拟时刻</span><strong>{{ timeText }}</strong></div>
                <div class="range-wrap time-wrap"><div class="range-scale"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div><input v-model="localHour" type="range" min="0" max="24" aria-label="地球上的模拟时刻" class="range-input" /></div>
                <div class="range-result"><small>{{ activeLesson === 'daynight' ? '晨昏线' : '直射点纬度' }}</small><strong>{{ activeLesson === 'daynight' ? '移动中' : solarLatitude }}</strong></div>
              </div>
              <div class="control-bottom" v-if="activeLesson === 'currents'"><div class="legend current-legend"><span><i class="legend-warm"></i>暖流</span><span><i class="legend-cold"></i>寒流</span></div><span class="schematic-note">亮点与箭头指示流向 · 教学示意</span></div>
              <div class="control-bottom" v-else-if="activeLesson === 'plates'"><div class="legend"><span><i class="legend-plate"></i>板块边界</span><span><i class="legend-plate-dim"></i>其他示例</span></div><span class="schematic-note">球面看位置 · 下方实验看运动</span></div>
              <div class="control-bottom" v-else><div class="switches"><button class="switch-chip" :class="{ on: showTropics }" @click="showTropics = !showTropics"><span class="switch-dot"></span>回归线</button><button class="switch-chip" :class="{ on: showPolarCircles }" @click="showPolarCircles = !showPolarCircles"><span class="switch-dot"></span>极圈</button><button class="switch-chip" :class="{ on: showAxis }" @click="showAxis = !showAxis"><span class="switch-dot"></span>地轴</button></div><div class="legend"><span><i class="legend-equator"></i>赤道</span><span><i class="legend-tropic"></i>回归线</span><span v-if="activeLesson === 'seasons'"><i class="legend-sun"></i>直射点</span></div></div>
            </div>
            <OceanLab v-if="activeLesson === 'currents'" :current="selectedCurrent" :motion="currentMotion" :speed="currentSpeed" @select-peru="selectCurrent('peru')" />
            <PlateLab v-if="activeLesson === 'plates'" :mode="selectedPlateMode" :replay-key="plateAnimationKey" />
          </section>

          <aside class="lesson-panel">
            <div class="panel-top"><div><span class="panel-kicker">{{ currentLesson.eyebrow }}</span><h2>{{ lessons.find(item => item.id === activeLesson)?.title }}</h2></div><span class="panel-mark">✳</span></div>
            <p class="lesson-intro">{{ currentLesson.intro }}</p>
            <div class="concept-card"><div class="concept-card-head"><span class="concept-symbol">✦</span><span>核心概念</span><span class="concept-line"></span></div><h3>{{ currentLesson.factTitle }}</h3><p>{{ currentLesson.fact }}</p><div v-if="activeLesson === 'grid'" class="coordinate-demo"><span class="coord-pill">31°N</span><span class="coord-comma">,</span><span class="coord-pill mint">121°E</span><span class="coord-note">先纬后经</span></div><div v-else-if="activeLesson === 'daynight'" class="daynight-demo"><div class="half-earth"><span class="half-sun">☼</span><span class="half-moon">☾</span><i></i></div><span class="half-label">昼半球 <b>/</b> 夜半球</span></div><div v-else-if="activeLesson === 'seasons'" class="season-fact"><div><span>当前直射纬度</span><strong>{{ solarLatitude }}</strong></div><span class="season-badge">{{ seasonName }}</span></div><div v-else-if="activeLesson === 'currents'" class="current-definition"><span class="current-wave">≈</span><span>按相对温度区分：暖流 / 寒流</span></div><div v-else-if="activeLesson === 'plates'" class="plate-fact"><span class="plate-fact-mark">06</span><span><b>六大板块</b><small>亚欧 · 非洲 · 美洲 · 太平洋 · 印度洋 · 南极洲</small></span></div><div v-else class="earth-fact"><div class="fact-stat"><strong>71<span>%</span></strong><small>海洋</small></div><div class="stat-divider"></div><div class="fact-stat"><strong>29<span>%</span></strong><small>陆地</small></div><div class="globe-mini">◉</div></div></div>
            <div v-if="activeLesson === 'currents'" class="current-reading"><div><span :class="['current-kind', selectedCurrent.category]">{{ selectedCurrent.category === 'warm' ? '暖流' : '寒流' }}</span><h3>{{ selectedCurrent.name }}</h3><small>{{ selectedCurrent.region }}</small></div><p>{{ selectedCurrent.story }}</p><div class="flow-rule"><b>一般规律</b><span>{{ selectedCurrent.category === 'warm' ? '暖流多从低纬流向高纬，水温相对较高。' : '寒流多从高纬流向低纬，水温相对较低。' }}</span></div></div>
            <div v-if="activeLesson === 'currents'" class="current-examples"><div class="current-examples-title"><span>选择一个海域</span><small>8 个洋流案例</small></div><select class="current-select" :value="selectedCurrentId" @change="selectCurrent($event.target.value)" aria-label="选择洋流案例"><option v-for="current in oceanCurrents" :key="current.id" :value="current.id">{{ current.shortName }}</option></select><button v-for="current in featuredCurrents" :key="current.id" class="current-example" :class="{ active: selectedCurrentId === current.id }" :aria-pressed="selectedCurrentId === current.id" @click="selectCurrent(current.id)"><span :class="['current-example-dot', current.category]"></span><span class="current-example-copy"><strong>{{ current.shortName }}</strong><small>{{ current.region }}</small></span><span class="current-example-arrow">↗</span></button></div>
            <div v-if="activeLesson === 'plates'" class="plate-reading">
              <div class="plate-reading-head"><div><span>{{ selectedPlateMode.name }} · {{ selectedPlateMode.subtitle }}</span><strong>{{ selectedPlateMode.result }}</strong></div><span class="plate-reading-icon">{{ selectedPlateMode.id === 'divergent' ? '⇠ ⇢' : selectedPlateMode.id === 'collision' ? '⇢ ⇠' : '⇅' }}</span></div>
              <div class="plate-location"><span>地球案例</span><strong>{{ selectedPlateMode.location }}</strong><small>{{ selectedPlateMode.region }}</small></div>
              <p class="plate-story">{{ selectedPlateMode.story }}</p>
            </div>
            <div v-if="activeLesson === 'seasons'" class="orbit-diagram"><div class="orbit-title"><span>地球绕太阳公转</span><small>自西向东 · 约 365 天</small></div><div class="orbit-map"><i class="orbit-track"></i><span class="orbit-sun">☼</span><span class="orbit-season spring">春分</span><span class="orbit-season summer">夏至</span><span class="orbit-season autumn">秋分</span><span class="orbit-season winter">冬至</span><i class="orbit-earth" :style="{ left: `${50 + 39 * Math.cos((2 * Math.PI * (Number(dayOfYear) - 80)) / 365)}%`, top: `${50 + 30 * Math.sin((2 * Math.PI * (Number(dayOfYear) - 80)) / 365)}%` }"></i></div></div>
            <details v-if="activeLesson === 'currents'" class="ocean-glossary"><summary><span>展开海洋小词典</span><small>海域 · 地形 · 资源</small></summary><div class="glossary-copy"><p><b>边缘海 / 内陆海</b> 边缘海濒临大陆，以岛屿或半岛与大洋分隔（如东海）；内陆海深入大陆，仅以狭窄水道与大洋相连（如渤海）。</p><p><b>海湾 / 海峡</b> 海湾是海洋伸进陆地的部分；海峡是连接两个海域的狭窄水道。</p><p><b>海底地形</b> 大陆架 → 大陆坡 → 洋盆 → 海沟。大陆架水浅，渔业和油气资源较丰富。</p><p><b>海洋资源</b> 有渔业、矿产、能源和航运空间；控制污染与捕捞强度，有助于保护海洋生态。</p></div></details>
            <details v-if="activeLesson === 'plates'" class="ocean-glossary plate-glossary"><summary><span>六大板块与易错点</span><small>板块地图</small></summary><div class="glossary-copy"><p><b>六大板块</b> 亚欧、非洲、美洲、太平洋、印度洋、南极洲板块。</p><p><b>记住</b> 澳大利亚大陆和印度半岛都属于印度洋板块；太平洋板块几乎全是海洋。</p><p><b>观察规律</b> 板块交界处地壳比较活跃，常见火山、地震；板块内部相对稳定。</p></div></details>
            <div class="insight-note"><span class="note-icon">✧</span><p>{{ currentLesson.note }}</p></div>
            <div class="try-card"><div class="try-heading"><span>试着想一想</span><span class="try-level">思考题</span></div><p>{{ activeLesson === 'grid' ? '上海位于北半球还是南半球？东半球还是西半球？' : activeLesson === 'daynight' ? '上海进入黑夜时，地球另一侧的同学正在经历什么？' : activeLesson === 'seasons' ? '当北半球是夏季时，南半球是什么季节？' : activeLesson === 'currents' ? '沿南美洲西岸向北流的洋流，属于暖流还是寒流？' : activeLesson === 'plates' ? selectedPlateMode.id === 'divergent' ? '东非大裂谷的两侧板块是在相互张裂还是相互碰撞？' : selectedPlateMode.id === 'collision' ? '形成喜马拉雅山的两大板块运动方向是怎样的？' : '圣安德烈斯断层处，两侧板块是相向碰撞还是水平错动？' : '为什么从太空看，地球有一半总是处于黑夜？' }}</p><div v-if="answerRevealed" class="reference-answer"><span>参考答案</span>{{ referenceAnswer }}</div><button class="answer-button" @click="revealAnswer">{{ activeLesson === 'grid' ? '显示上海位置' : answerRevealed ? '收起参考答案' : '查看参考答案' }} <span>↗</span></button></div>
            <div class="panel-foot"><span class="foot-star">✧</span><span>先观察，再用地理语言说出你的发现。</span></div>
          </aside>
        </div>
        <footer class="page-footer"><span>地球实验室 <i>·</i> 互动地理课堂</span><span>NASA Earth Observatory · Blue Marble 2004.06 · 教学演示用</span><span class="footer-page">{{ String(lessonIndex + 1).padStart(2, '0') }} <i>/</i> {{ String(lessons.length).padStart(2, '0') }}</span></footer>
      </main>
    </div>
  </div>
</template>
