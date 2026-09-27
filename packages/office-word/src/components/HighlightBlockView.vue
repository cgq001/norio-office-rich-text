<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/vue-3'

import EmojiPickerPanel from './EmojiPickerPanel.vue'
import { useNodeViewEditable } from '../composables/useNodeViewEditable'

const props = defineProps<NodeViewProps>()

type ElementLike = HTMLElement | { $el?: Element | null } | null

const wrapperRef = ref<ElementLike>(null)
const emojiTriggerRef = ref<HTMLElement | null>(null)
const emojiPickerRef = ref<HTMLElement | null>(null)
const isEmojiEnabled = computed(() => props.node.attrs.emojiEnabled !== false)
const emoji = computed(() => String(props.node.attrs.emoji || '✍️'))
const canEdit = useNodeViewEditable(props.editor)
const surfaceStyle = computed(() => ({
  borderColor: String(props.node.attrs.borderColor || '#f3c389'),
  background: String(props.node.attrs.backgroundColor || '#fff8ef'),
}))
const isEmojiPickerOpen = ref(false)

function resolveWrapperElement() {
  if (wrapperRef.value instanceof HTMLElement) {
    return wrapperRef.value
  }

  const element = wrapperRef.value?.$el
  return element instanceof HTMLElement ? element : null
}

function removePlaceholderAttr() {
  resolveWrapperElement()?.removeAttribute('data-placeholder')
}

function toggleEmojiPicker() {
  if (!canEdit.value || !isEmojiEnabled.value) {
    isEmojiPickerOpen.value = false
    return
  }

  isEmojiPickerOpen.value = !isEmojiPickerOpen.value
}

function selectEmoji(nextEmoji: string) {
  if (!canEdit.value) {
    return
  }

  props.updateAttributes({
    emoji: nextEmoji,
    emojiEnabled: true,
  })
  isEmojiPickerOpen.value = false
}

function handleDocumentPointerDown(event: MouseEvent) {
  const target = event.target as Node | null
  if (!target) {
    return
  }

  if (emojiTriggerRef.value?.contains(target) || emojiPickerRef.value?.contains(target)) {
    return
  }

  isEmojiPickerOpen.value = false
}

onMounted(() => {
  void nextTick(removePlaceholderAttr)
  document.addEventListener('pointerdown', handleDocumentPointerDown)
})

watch(isEmojiEnabled, (enabled) => {
  if (!enabled || !canEdit.value) {
    isEmojiPickerOpen.value = false
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
})
</script>

<template>
  <NodeViewWrapper
    ref="wrapperRef"
    class="norio-office-rich-highlight-block"
    :data-emoji-enabled="isEmojiEnabled ? 'true' : 'false'"
  >
    <div class="norio-office-rich-highlight-block__body" @mousedown.stop="">
      <div class="norio-office-rich-highlight-block__surface" :style="surfaceStyle">
        <button
          v-if="isEmojiEnabled && canEdit"
          ref="emojiTriggerRef"
          type="button"
          class="norio-office-rich-highlight-block__emoji-slot"
          title="选择表情"
          @mousedown.prevent
          @click.stop="toggleEmojiPicker"
        >
          <span class="norio-office-rich-highlight-block__emoji">{{ emoji }}</span>
        </button>

        <span v-else-if="isEmojiEnabled" class="norio-office-rich-highlight-block__emoji-slot norio-office-rich-highlight-block__emoji-slot--readonly">
          <span class="norio-office-rich-highlight-block__emoji">{{ emoji }}</span>
        </span>

        <div v-if="isEmojiPickerOpen && canEdit" ref="emojiPickerRef" class="norio-office-rich-highlight-block__emoji-picker" @mousedown.stop>
          <EmojiPickerPanel :selected-emoji="emoji" @select="selectEmoji" />
        </div>

        <NodeViewContent class="norio-office-rich-highlight-block__content" />
      </div>
    </div>
  </NodeViewWrapper>
</template>

<style scoped>
.norio-office-rich-highlight-block__emoji-slot {
  padding: 0;
  border: 0;
  cursor: pointer;
}

.norio-office-rich-highlight-block__emoji-slot--readonly {
  cursor: default;
}

.norio-office-rich-highlight-block__emoji-picker {
  position: absolute;
  top: 46px;
  left: 16px;
  z-index: 24;
  width: min(450px, calc(100vw - 32px));
}
</style>
