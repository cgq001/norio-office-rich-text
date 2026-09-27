<script setup lang="ts">
import { computed } from 'vue'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/vue-3'

import OfficeColorIcon from './OfficeColorIcon.vue'
import OfficeIcon from './OfficeIcon.vue'
import { useNodeViewEditable } from '../composables/useNodeViewEditable'

const props = defineProps<NodeViewProps>()

const assetId = computed(() => String(props.node.attrs.assetId ?? ''))
const fileUrl = computed(() => String(props.node.attrs.url ?? ''))
const fileName = computed(() => String(props.node.attrs.name ?? ''))
const fileSize = computed(() => Number(props.node.attrs.size ?? 0))
const mimeType = computed(() => String(props.node.attrs.mimeType ?? ''))
const canEdit = useNodeViewEditable(props.editor)
const isConfigured = computed(() => fileUrl.value.trim().length > 0 && fileName.value.trim().length > 0)
const metaLabel = computed(() => {
  const segments: string[] = []

  if (mimeType.value.trim()) {
    segments.push(mimeType.value)
  }

  if (fileSize.value > 0) {
    segments.push(formatFileSize(fileSize.value))
  }

  return segments.join(' · ')
})

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(size >= 10 * 1024 ? 0 : 1)} KB`
  }

  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`
  }

  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function selectNode() {
  if (!canEdit.value) {
    return
  }

  const position = props.getPos()
  if (typeof position === 'number') {
    props.editor.commands.setNodeSelection(position)
  }
}

function getFilePayload() {
	return {
		assetId: assetId.value || undefined,
		url: fileUrl.value,
    name: fileName.value,
    size: fileSize.value > 0 ? fileSize.value : undefined,
    mimeType: mimeType.value || undefined,
  }
}

function triggerFileClick() {
  selectNode()
  if (!isConfigured.value) {
    return
  }

  props.extension.options.onClick?.(getFilePayload())
}

function triggerDownload() {
  selectNode()
  if (!isConfigured.value) {
    return
  }

  props.extension.options.onDownload?.(getFilePayload())
}
</script>

<template>
  <NodeViewWrapper
    class="norio-office-rich-local-file-block"
    :class="{
      'norio-office-rich-local-file-block--selected': selected && canEdit,
      'norio-office-rich-local-file-block--empty': !isConfigured,
    }"
    @click="triggerFileClick"
  >
    <div class="norio-office-rich-local-file-block__main">
      <span class="norio-office-rich-local-file-block__icon">
        <OfficeColorIcon name="file" :size="28" background-color="transparent" />
      </span>

      <div class="norio-office-rich-local-file-block__content">
        <div class="norio-office-rich-local-file-block__title">
          {{ isConfigured ? fileName : '请选择本地文件' }}
        </div>
        <div v-if="isConfigured && metaLabel" class="norio-office-rich-local-file-block__meta">
          {{ metaLabel }}
        </div>
        <div v-else-if="!isConfigured" class="norio-office-rich-local-file-block__meta">
          本地文件卡片
        </div>
      </div>
    </div>

    <button
      type="button"
      class="norio-office-rich-local-file-block__download"
      :disabled="!isConfigured"
      @mousedown.prevent
      @click.stop="triggerDownload"
    >
      <OfficeIcon name="save" :size="14" color="#2563eb" background-color="transparent" />
      <span>下载</span>
    </button>
  </NodeViewWrapper>
</template>
