<script setup lang="ts">
import { computed } from 'vue'
import OfficeIcon from './OfficeIcon.vue'

export type BlockColorKind = 'text' | 'background' | 'border' | 'fill'
const props = defineProps<{ textColor?: string | null; backgroundColor?: string | null; color?: string | null; kind?: 'border' | 'fill'; label?: string; presetColors?: readonly string[]; customKind: BlockColorKind | null; hoverEnabled: boolean }>()
const emit = defineEmits<{
  change: [kind: BlockColorKind, color: string | null]
  custom: [kind: BlockColorKind, anchor: HTMLElement]
  reset: []
}>()
const textColors = [null, '#9CA3AF', '#DC2626', '#F97316', '#D4A500', '#15803D', '#2F6BFF', '#9333EA']
const backgroundColors = [null, '#F4F5F7', '#FDE1DD', '#FFE9D2', '#FFF3C4', '#D8F4E5', '#DDE9FF', '#F1D8FF', '#E6E8EC', '#D9DEE7', '#F9C3BC', '#FFD6AC', '#FFE58C', '#B8ECD2', '#BED3FF', '#E4BCFF']
const fields = computed(() => props.kind ? [
  { key: props.kind, label: props.label || (props.kind === 'border' ? '边框颜色' : '填充颜色'), colors: props.presetColors ? [null, ...props.presetColors] : backgroundColors },
] : [
  { key: 'text', label: '字体颜色', colors: textColors },
  { key: 'background', label: '背景颜色', colors: backgroundColors },
] as const)

function customLabel(kind: BlockColorKind) {
  if (props.kind && props.label) return `自定义${props.label}`
  return { text: '自定义文字颜色', background: '自定义背景颜色', border: '自定义边框颜色', fill: '自定义填充颜色' }[kind]
}

function colorLabel(kind: BlockColorKind, color: string | null) {
  return color || (kind === 'border' || kind === 'fill' ? '无颜色' : '默认')
}

function isSelected(kind: BlockColorKind, color: string | null) {
  const current = kind === 'text' ? props.textColor : kind === 'background' ? props.backgroundColor : props.color
  return (current === 'transparent' ? '' : current ?? '').toLowerCase() === (color ?? '').toLowerCase()
}

function openCustom(kind: BlockColorKind, event: MouseEvent) {
  if (event.currentTarget instanceof HTMLElement) emit('custom', kind, event.currentTarget)
}
</script>

<template>
  <div class="norio-office-rich-block-colors" @mousedown.prevent>
    <section v-for="field in fields" :key="field.key" class="norio-office-rich-block-colors__section">
      <div class="norio-office-rich-block-colors__label">{{ field.label }}</div>
      <div class="norio-office-rich-block-colors__grid">
        <button
          v-for="color in field.colors" :key="color || 'default'" type="button"
          class="norio-office-rich-block-colors__swatch"
          :class="{ 'norio-office-rich-block-colors__swatch--active': isSelected(field.key, color), 'norio-office-rich-block-colors__swatch--clear': field.key !== 'text' && !color }"
          :style="field.key === 'text' ? { color: color || '#273142' } : { backgroundColor: color || '#ffffff' }"
          :aria-label="`${field.label} ${colorLabel(field.key, color)}`" :title="`${field.label} ${colorLabel(field.key, color)}`"
          :aria-pressed="isSelected(field.key, color)" @click="emit('change', field.key, color)"
        >
          <span v-if="field.key === 'text'">A</span>
        </button>
      </div>
      <button
        type="button" class="norio-office-rich-block-side-menu__item norio-office-rich-block-colors__custom"
        :class="{ 'norio-office-rich-block-side-menu__item--active': customKind === field.key }"
        :aria-label="customLabel(field.key)" :aria-expanded="customKind === field.key"
        @mouseenter="hoverEnabled && openCustom(field.key, $event)" @click="openCustom(field.key, $event)"
      >
        <OfficeIcon name="yanse" :size="16" color="currentColor" background-color="transparent" />
        <span>自定义颜色</span>
        <OfficeIcon name="youjiantou" :size="12" color="#9aa4b2" background-color="transparent" />
      </button>
    </section>
    <button type="button" class="norio-office-rich-color-menu__current norio-office-rich-block-colors__reset" @click="emit('reset')">恢复默认</button>
  </div>
</template>
