<script setup lang="ts">
import { ref } from 'vue'
import OfficeIcon from './OfficeIcon.vue'
import { colorGrid, standardColors } from '../utils/color-palette'

const props = defineProps<{
  color: string
  defaultColor: string
  recentColors: string[]
}>()
const emit = defineEmits<{ change: [color: string] }>()
const pickerRef = ref<HTMLInputElement | null>(null)

function isSelected(color: string) {
  return props.color.toLowerCase() === color.toLowerCase()
}

function handlePickerChange(event: Event) {
  const value = (event.target as HTMLInputElement).value
  if (value) emit('change', value)
}
</script>

<template>
  <div class="norio-office-rich-color-palette" @mousedown.prevent>
    <div class="norio-office-rich-color-menu__section">
      <button type="button" class="norio-office-rich-color-menu__current" @click="emit('change', defaultColor)">默认</button>
    </div>
    <div class="norio-office-rich-color-menu__section">
      <div class="norio-office-rich-color-menu__grid">
        <button
          v-for="(colorOption, index) in colorGrid.flat()"
          :key="index"
          type="button"
          class="norio-office-rich-color-menu__swatch"
          :class="{ 'norio-office-rich-color-menu__swatch--active': isSelected(colorOption) }"
          :style="{ backgroundColor: colorOption }"
          :aria-label="colorOption"
          :aria-pressed="isSelected(colorOption)"
          :title="colorOption"
          @click="emit('change', colorOption)"
        />
      </div>
    </div>
    <div class="norio-office-rich-color-menu__section">
      <div class="norio-office-rich-color-menu__label">标准色</div>
      <div class="norio-office-rich-color-menu__row">
        <button
          v-for="colorOption in standardColors"
          :key="colorOption"
          type="button"
          class="norio-office-rich-color-menu__swatch norio-office-rich-color-menu__swatch--compact"
          :class="{ 'norio-office-rich-color-menu__swatch--active': isSelected(colorOption) }"
          :style="{ backgroundColor: colorOption }"
          :aria-label="`标准色 ${colorOption}`"
          :aria-pressed="isSelected(colorOption)"
          :title="colorOption"
          @click="emit('change', colorOption)"
        />
      </div>
    </div>
    <div class="norio-office-rich-color-menu__section">
      <div class="norio-office-rich-color-menu__label">最近使用</div>
      <div class="norio-office-rich-color-menu__row">
        <button
          v-for="colorOption in recentColors.slice(0, 10)"
          :key="colorOption"
          type="button"
          class="norio-office-rich-color-menu__swatch norio-office-rich-color-menu__swatch--recent"
          :class="{ 'norio-office-rich-color-menu__swatch--active': isSelected(colorOption) }"
          :style="{ backgroundColor: colorOption }"
          :aria-label="`最近使用 ${colorOption}`"
          :aria-pressed="isSelected(colorOption)"
          :title="colorOption"
          @click="emit('change', colorOption)"
        />
        <span v-for="index in Math.max(0, 10 - recentColors.length)" :key="index" class="norio-office-rich-color-menu__swatch norio-office-rich-color-menu__swatch--empty" />
      </div>
    </div>
    <div class="norio-office-rich-color-menu__footer">
      <button type="button" class="norio-office-rich-color-menu__more" @click="pickerRef?.click()">
        <span class="norio-office-rich-color-menu__rainbow" />
        <span>更多颜色</span>
        <OfficeIcon name="shixinxiangyou" :size="10" color="#9ca3af" background-color="transparent" class="norio-office-rich-color-menu__arrow" />
      </button>
      <input ref="pickerRef" type="color" class="norio-office-rich-color-menu__picker" aria-label="更多颜色取色器" :value="color === 'transparent' ? defaultColor : color" @input="handlePickerChange" />
    </div>
  </div>
</template>
