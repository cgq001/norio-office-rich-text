<script setup lang="ts">
import { computed } from 'vue'

import { colorIcons } from '../icons'

const props = withDefaults(
  defineProps<{
    name: string
    size?: number | string
    backgroundColor?: string
  }>(),
  {
    size: 22,
    backgroundColor: '#ffffff',
  },
)

const iconMarkup = computed(() => colorIcons[props.name] ?? '')

const sizeValue = computed(() => {
  return typeof props.size === 'number' ? `${props.size}px` : props.size
})

const rootStyle = computed(() => ({
  width: sizeValue.value,
  height: sizeValue.value,
  backgroundColor: props.backgroundColor,
}))
</script>

<template>
  <span
    class="norio-office-rich-icon"
    :class="{ 'norio-office-rich-icon--missing': !iconMarkup }"
    :style="rootStyle"
    :data-name="name"
    :title="iconMarkup ? undefined : `Unknown icon: ${name}`"
    v-html="iconMarkup"
  />
</template>
