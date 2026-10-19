<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({ current: { type: Object, required: true }, motion: { type: Boolean, default: true }, speed: { type: Number, default: 1 } })
const emit = defineEmits(['select-peru'])
const mode = ref('transport')
const phase = ref(0)
const warm = computed(() => props.current.category === 'warm')
let animation, previousTime = 0
let disposed = false

function bezier(t, coordinates) {
  const u = 1 - t
  return {
    x: u ** 3 * coordinates[0][0] + 3 * u * u * t * coordinates[1][0] + 3 * u * t * t * coordinates[2][0] + t ** 3 * coordinates[3][0],
    y: u ** 3 * coordinates[0][1] + 3 * u * u * t * coordinates[1][1] + 3 * u * t * t * coordinates[2][1] + t ** 3 * coordinates[3][1],
  }
}

const transportParticles = computed(() => Array.from({ length: 21 }, (_, index) => bezier((phase.value + index / 21) % 1, [[64, 147], [235, 36], [409, 223], [568, 113]])))
const surfaceParticles = computed(() => Array.from({ length: 13 }, (_, index) => bezier((phase.value + index / 13) % 1, [[483, 104], [344, 73], [220, 109], [56, 96]])))
const risingParticles = computed(() => Array.from({ length: 12 }, (_, index) => bezier((phase.value * 0.8 + index / 12) % 1, [[343, 225], [446, 229], [510, 149], [468, 110]])))

function selectMode(nextMode) {
  mode.value = nextMode
  if (nextMode === 'upwelling') emit('select-peru')
}

watch(() => props.current.id, (id) => {
  if (id !== 'peru') mode.value = 'transport'
})

onMounted(() => {
  const frame = (time) => {
    if (disposed) return
    const delta = Math.min((time - previousTime) / 1000 || 0, 0.05)
    previousTime = time
    if (props.motion) phase.value += delta * props.speed / 8
    animation = requestAnimationFrame(frame)
  }
  animation = requestAnimationFrame(frame)
})
onBeforeUnmount(() => { disposed = true; cancelAnimationFrame(animation) })
</script>

<template>
  <section class="process-lab ocean-lab" aria-label="洋流机制动态演示">
    <div class="lab-heading"><div><span class="lab-eyebrow">OCEAN IN MOTION</span><h3>{{ mode === 'transport' ? '跟着海水，观察热量的旅程' : '秘鲁沿岸，深层冷水如何上涌？' }}</h3></div><div class="lab-tabs" role="group" aria-label="洋流机制"><button :class="{ active: mode === 'transport' }" :aria-pressed="mode === 'transport'" @click="selectMode('transport')">海水输送</button><button :class="{ active: mode === 'upwelling' }" :aria-pressed="mode === 'upwelling'" @click="selectMode('upwelling')">沿岸上涌</button></div></div>
    <div class="ocean-lab-stage" :class="{ warm, upwelling: mode === 'upwelling' }">
      <svg v-if="mode === 'transport'" viewBox="0 0 640 260" role="img" :aria-label="`${current.shortName}海水输送示意`">
        <defs>
          <linearGradient id="ocean-water" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#214f83"/><stop offset="1" stop-color="#122f57"/></linearGradient>
          <linearGradient id="transport-ribbon"><stop :stop-color="warm ? '#ff985e' : '#4cb8ff'"/><stop offset="1" :stop-color="warm ? '#ffd193' : '#8ef7e3'"/></linearGradient>
          <marker id="transport-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 0 L 10 5 L 0 10 Z" :fill="warm ? '#ffd193' : '#8ef7e3'"/></marker>
        </defs>
        <rect x="0" y="0" width="640" height="260" rx="16" fill="url(#ocean-water)"/>
        <g fill="none" stroke="#80cbea" stroke-width="0.6" opacity="0.12"><path v-for="row in 8" :key="row" :d="`M-40 ${row * 33} Q180 ${row * 33 - 55} 330 ${row * 33} T680 ${row * 33}`"/></g>
        <circle cx="62" cy="147" r="31" :fill="warm ? '#ff985e' : '#4cb8ff'" opacity="0.09"/>
        <circle cx="566" cy="113" r="31" :fill="warm ? '#ffcc84' : '#8ef7e3'" opacity="0.12"/>
        <path d="M64 147 C235 36 409 223 568 113" stroke="url(#transport-ribbon)" stroke-width="30" fill="none" opacity="0.1"/>
        <path d="M64 147 C235 36 409 223 568 113" stroke="url(#transport-ribbon)" stroke-width="2.2" fill="none" marker-end="url(#transport-arrow)"/>
        <g v-for="(particle, index) in transportParticles" :key="index"><circle :cx="particle.x" :cy="particle.y" :r="index % 3 === 0 ? 9 : 5" :fill="warm ? '#ffba83' : '#68ddff'" opacity="0.12"/><circle :cx="particle.x" :cy="particle.y" :r="index % 3 === 0 ? 3.5 : 2" :fill="warm ? '#ffe1a7' : '#b0f7ff'"/></g>
        <g class="ocean-svg-labels"><text x="37" y="71">{{ warm ? '低纬海区' : '高纬海区' }}</text><text x="513" y="61">{{ warm ? '高纬海区' : '低纬海区' }}</text><text x="214" y="224" class="svg-note">海水沿一定方向移动，携带热量</text></g>
        <g class="ocean-svg-tag"><rect x="240" y="37" width="155" height="26" rx="13" fill="#fff" opacity="0.07"/><text x="317" y="54" text-anchor="middle">{{ warm ? '暖流 · 相对较暖' : '寒流 · 相对较冷' }}</text></g>
      </svg>
      <svg v-else viewBox="0 0 640 260" role="img" aria-label="沿岸风使表层海水离岸，深层冷水上涌补位的示意图">
        <defs><linearGradient id="upwelling-water" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#247cab"/><stop offset="1" stop-color="#11345e"/></linearGradient><marker id="upwell-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#9feeff"/></marker></defs>
        <rect width="640" height="260" rx="16" fill="#163b68"/>
        <path d="M0 93 Q75 86 140 94 T280 94 T420 94 L510 93 L570 260 H0Z" fill="url(#upwelling-water)"/>
        <path d="M510 89 L534 62 L559 69 L591 45 L640 54 V260 H570Z" fill="#b59a76"/>
        <path d="M0 93 Q75 86 140 94 T280 94 T420 94 L510 93" stroke="#96dded" stroke-width="1.5" fill="none" opacity="0.6"/>
        <path d="M483 104 C344 73 220 109 56 96" fill="none" stroke="#9feeff" stroke-width="2" marker-end="url(#upwell-arrow)"/>
        <path d="M343 225 C446 229 510 149 468 110" fill="none" stroke="#66d4ed" stroke-width="18" opacity="0.14"/>
        <path d="M343 225 C446 229 510 149 468 110" fill="none" stroke="#9feeff" stroke-width="2" marker-end="url(#upwell-arrow)"/>
        <circle v-for="(particle, index) in surfaceParticles" :key="`surface-${index}`" :cx="particle.x" :cy="particle.y" r="3" fill="#c3f2ff"/>
        <g v-for="(particle, index) in risingParticles" :key="`rise-${index}`"><circle :cx="particle.x" :cy="particle.y" r="7" fill="#71dff5" opacity="0.15"/><circle :cx="particle.x" :cy="particle.y" r="2.5" :fill="index % 3 === 0 ? '#bde893' : '#93e7ff'"/></g>
        <g fill="#acdfba" opacity="0.8"><circle v-for="dot in 9" :key="dot" :cx="330 + dot * 14" :cy="156 + Math.sin(dot * 2.4) * 20" r="2"/></g>
        <g class="ocean-svg-labels"><text x="241" y="53">⊗ 沿岸风（大致向北）</text><text x="67" y="140">表层海水离岸</text><text x="328" y="204">深层冷水上涌</text><text x="370" y="147" class="svg-note">营养物质</text><text x="557" y="101">海岸</text><text x="33" y="237" class="svg-note">⊗ 风吹向剖面内 · 西侧为海洋，东侧为海岸</text></g>
      </svg>
      <span class="ocean-animation-state"><i :class="{ paused: !motion }"></i>{{ motion ? '流动中' : '已暂停' }} · {{ speed }}×</span>
    </div>
    <div class="ocean-observation"><b>{{ mode === 'transport' ? current.shortName : '观察上涌' }}</b><p>{{ mode === 'transport' ? warm ? '顺着粒子观察方向：暖流一般把较暖的海水输送到其他海域，改变沿途的热量分布。' : '顺着粒子观察方向：寒流将相对较冷的海水带到其他海域。冷暖是与流经海区周边海水比较。' : '表层海水被推离海岸后，深层冷水上升补位，同时带来营养物质。这有利于浮游生物生长，是秘鲁附近渔业资源丰富的原因之一。' }}</p></div>
    <p class="lab-footnote">海水输送的布局与速度为教学示意。沿岸上涌还受风向、地转偏向力和海岸形态等条件影响。</p>
  </section>
</template>
