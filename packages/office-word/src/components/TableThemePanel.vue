<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import ColorPalettePanel from './ColorPalettePanel.vue'
import OfficeIcon from './OfficeIcon.vue'
import { tableThemePresets, type TableThemeColors } from '../utils/table-theme'

const props = defineProps<{ theme: TableThemeColors | null; recentColors: string[] }>()
const emit = defineEmits<{
  change: [theme: TableThemeColors]
  clear: []
  close: []
  resize: [height: number]
  colorUsed: [color: string]
  reposition: []
}>()

const panelRef = ref<HTMLElement | null>(null)
const surfaceRef = ref<HTMLElement | null>(null)
const paletteRef = ref<HTMLElement | null>(null)
const activeColorField = ref<keyof TableThemeColors | null>(null)
const paletteStyle = ref<Record<string, string>>({})
let colorTrigger: HTMLElement | null = null
let resizeObserver: ResizeObserver | null = null
let positionObserver: MutationObserver | null = null
onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    if (surfaceRef.value) emit('resize', surfaceRef.value.offsetHeight)
    void nextTick(updatePalettePosition)
  })
  if (surfaceRef.value) resizeObserver.observe(surfaceRef.value)
  positionObserver = new MutationObserver(records => {
    if (records.some(record => record.target !== panelRef.value)) emit('reposition')
    void nextTick(updatePalettePosition)
  })
  if (panelRef.value) positionObserver.observe(panelRef.value, { attributes: true, attributeFilter: ['style'] })
  const bubble = panelRef.value?.closest('.norio-office-rich-table-bubble-menu')
  if (bubble) positionObserver.observe(bubble, { attributes: true, attributeFilter: ['style'] })
  document.addEventListener('pointerdown', handlePointerDown)
  window.addEventListener('resize', updatePalettePosition)
  window.addEventListener('scroll', updatePalettePosition, true)
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  positionObserver?.disconnect()
  document.removeEventListener('pointerdown', handlePointerDown)
  window.removeEventListener('resize', updatePalettePosition)
  window.removeEventListener('scroll', updatePalettePosition, true)
})

const colors = computed(() => props.theme ?? tableThemePresets[0])
const fields = [
  { key: 'header', label: '表头' },
  { key: 'odd', label: '奇数行' },
  { key: 'even', label: '偶数行' },
] as const

function isSelected(theme: TableThemeColors) {
  return !!props.theme && fields.every(field => props.theme![field.key] === theme[field.key])
}

function changeColor(color: string) {
  if (!activeColorField.value) return
  emit('change', { header: colors.value.header, odd: colors.value.odd, even: colors.value.even, [activeColorField.value]: color })
  emit('colorUsed', color)
}

async function toggleColorField(key: keyof TableThemeColors, event: MouseEvent) {
  colorTrigger = event.currentTarget as HTMLElement
  activeColorField.value = activeColorField.value === key ? null : key
  await nextTick()
  updatePalettePosition()
}

function handlePointerDown(event: PointerEvent) {
  const target = event.target as Node | null
  if (target && !paletteRef.value?.contains(target) && !colorTrigger?.contains(target)) {
    activeColorField.value = null
  }
}

function closeOnEscape() {
  if (activeColorField.value) activeColorField.value = null
  else emit('close')
}

function updatePalettePosition() {
  if (!activeColorField.value || !paletteRef.value || !panelRef.value || !colorTrigger) return
  // Keep the nested palette outside the scrolling surface, inside its owning menu.
  const panel = panelRef.value.getBoundingClientRect()
  const trigger = colorTrigger.getBoundingClientRect()
  const viewport = panelRef.value.closest('.norio-office-rich-editor__main')?.getBoundingClientRect()
  const scale = panel.width / panelRef.value.offsetWidth || 1
  const leftEdge = Math.max(0, viewport?.left ?? 0) + 8
  const rightEdge = Math.min(window.innerWidth, viewport?.right ?? window.innerWidth) - 8
  const topEdge = Math.max(0, viewport?.top ?? 0) + 8
  const bottomEdge = Math.min(window.innerHeight, viewport?.bottom ?? window.innerHeight) - 8
  const width = Math.min(264, (rightEdge - leftEdge) / scale)
  const maxHeight = Math.max(0, (bottomEdge - topEdge) / scale)
  const height = Math.min(paletteRef.value.scrollHeight, maxHeight) * scale
  const left = Math.max(leftEdge, Math.min(trigger.left, rightEdge - width * scale))
  const preferredTop = trigger.bottom + 6 + height <= bottomEdge ? trigger.bottom + 6 : trigger.top - height - 6
  const top = Math.max(topEdge, Math.min(preferredTop, bottomEdge - height))
  paletteStyle.value = {
    left: `${(left - panel.left) / scale}px`, top: `${(top - panel.top) / scale}px`,
    width: `${width}px`, maxHeight: `${maxHeight}px`,
  }
}
</script>

<template>
  <div ref="panelRef" class="norio-office-rich-table-theme" role="dialog" aria-label="表格主题色" @keydown.esc.prevent.stop="closeOnEscape">
    <div ref="surfaceRef" class="norio-office-rich-table-theme__surface">
      <div class="norio-office-rich-table-theme__title">表格主题色</div>
      <div class="norio-office-rich-table-theme__subtitle">表头配色 · 隔行填充</div>
      <div class="norio-office-rich-table-theme__presets">
        <button
          v-for="preset in tableThemePresets"
          :key="preset.id"
          type="button"
          class="norio-office-rich-table-theme__preset"
          :class="{ 'norio-office-rich-table-theme__preset--active': isSelected(preset) }"
          :aria-pressed="isSelected(preset)"
          :aria-label="preset.name"
          @mousedown.prevent
          @click="emit('change', { header: preset.header, odd: preset.odd, even: preset.even })"
        >
          <span class="norio-office-rich-table-theme__preview">
            <table aria-hidden="true">
              <tbody>
                <tr v-for="(color, row) in [preset.header, preset.odd, preset.even, preset.odd]" :key="row">
                  <td v-for="column in 3" :key="column" :style="{ backgroundColor: color }" />
                </tr>
              </tbody>
            </table>
            <OfficeIcon v-if="isSelected(preset)" class="norio-office-rich-table-theme__selected" name="To-do" :size="18" color="#ffffff" background-color="#1677ff" />
          </span>
          <span>{{ preset.name }}</span>
        </button>
      </div>
      <div class="norio-office-rich-table-theme__custom">
        <span class="norio-office-rich-table-theme__custom-title">自定义</span>
        <div v-for="field in fields" :key="field.key" class="norio-office-rich-table-theme__field">
          <span>{{ field.label }}</span>
          <button type="button" class="norio-office-rich-table-theme__swatch"
            :style="{ backgroundColor: colors[field.key] }" :aria-label="`${field.label}颜色`"
            :title="`${field.label}颜色`" :aria-expanded="activeColorField === field.key"
            @mousedown.prevent @click="toggleColorField(field.key, $event)" />
        </div>
      </div>
      <button type="button" class="norio-office-rich-table-theme__clear" @mousedown.prevent @click="emit('clear')">
        <OfficeIcon name="delete" :size="16" color="currentColor" background-color="transparent" />
        <span>清除样式</span>
      </button>
    </div>
    <div v-if="activeColorField" ref="paletteRef" class="norio-office-rich-table-theme__palette" :style="paletteStyle"
      role="dialog" :aria-label="`${fields.find(field => field.key === activeColorField)?.label}颜色选择`">
      <ColorPalettePanel :color="colors[activeColorField]" :default-color="tableThemePresets[0][activeColorField]"
        :recent-colors="recentColors" @change="changeColor" />
    </div>
  </div>
</template>
