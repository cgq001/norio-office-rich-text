<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    maxHeight?: string
    className?: string
  }>(),
  {
    maxHeight: '',
    className: '',
  },
)
</script>

<template>
  <div
    class="norio-office-rich-scroll-area"
    :class="className"
    :style="props.maxHeight ? { maxHeight: props.maxHeight } : undefined"
  >
    <slot />
  </div>
</template>
