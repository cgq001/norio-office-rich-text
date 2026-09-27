<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/vue-3'

import OfficeColorIcon from './OfficeColorIcon.vue'
import OfficeIcon from './OfficeIcon.vue'
import { normalizeWebUrl } from '../utils/url'
import { useNodeViewEditable } from '../composables/useNodeViewEditable'

type LinkMode = 'preview' | 'card' | 'text'
type LinkAlign = 'left' | 'center' | 'right'
type ResizeCorner = 'tl' | 'tr' | 'bl' | 'br'

const props = defineProps<NodeViewProps>()

const alignDropdownRef = ref<HTMLElement | null>(null)
const formTitle = ref('')
const formUrl = ref('')
const editTitle = ref('')
const editUrl = ref('')
const isAlignMenuOpen = ref(false)
const isEditing = ref(false)
const isFullscreenOpen = ref(false)
const isResizing = ref(false)
const isHeightResizing = ref(false)
let resizeStartX = 0
let resizeStartWidth = 100
let resizeStartY = 0
let resizeStartHeight = 420
let resizeCorner: ResizeCorner = 'br'

const title = computed(() => String(props.node.attrs.title ?? ''))
const url = computed(() => String(props.node.attrs.url ?? ''))
const displayMode = computed<LinkMode>(() => {
  const value = String(props.node.attrs.displayMode ?? 'preview')
  return value === 'card' || value === 'text' ? value : 'preview'
})
const align = computed<LinkAlign>(() => {
  const value = String(props.node.attrs.align ?? 'left')
  return value === 'center' || value === 'right' ? value : 'left'
})
const widthPercent = computed(() => Number(props.node.attrs.widthPercent ?? 100))
const previewHeight = computed(() => Number(props.node.attrs.height ?? 420))
const canEdit = useNodeViewEditable(props.editor)
const isConfigured = computed(() => title.value.trim().length > 0 && url.value.trim().length > 0)
const normalizedUrl = computed(() => normalizeUrl(url.value))
const normalizedEditUrl = computed(() => normalizeUrl(editUrl.value))
const domainLabel = computed(() => {
  try {
    return normalizedUrl.value ? new URL(normalizedUrl.value).host : ''
  } catch {
    return url.value
  }
})
const alignIconName = computed(() => {
  if (align.value === 'center') {
    return 'juzhongduiqi'
  }

  if (align.value === 'right') {
    return 'youduiqi'
  }

  return 'zuoduiqi'
})
const canSubmitForm = computed(() => formTitle.value.trim().length > 0 && formUrl.value.trim().length > 0)
const canSubmitEdit = computed(() => editTitle.value.trim().length > 0 && editUrl.value.trim().length > 0)
const rootStyle = computed(() => {
  if (!isConfigured.value) {
    return {
      width: 'fit-content',
      maxWidth: '100%',
    }
  }

  if (displayMode.value === 'preview') {
    return {
      width: `${widthPercent.value}%`,
    }
  }

  if (displayMode.value === 'card') {
    return {
      width: '400px',
      maxWidth: '100%',
    }
  }

  return {
    width: 'fit-content',
    maxWidth: '100%',
  }
})

function normalizeUrl(value: string) {
  return normalizeWebUrl(value)
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

function submitInitialForm() {
  if (!canEdit.value || !canSubmitForm.value) {
    return
  }

  props.updateAttributes({
    title: formTitle.value.trim(),
    url: normalizeUrl(formUrl.value),
    displayMode: 'preview',
  })
}

function openEditor() {
  if (!canEdit.value) {
    return
  }

  editTitle.value = title.value
  editUrl.value = url.value
  isEditing.value = true
}

function closeEditor() {
  isEditing.value = false
  editTitle.value = ''
  editUrl.value = ''
}

function submitEdit() {
  if (!canEdit.value || !canSubmitEdit.value) {
    return
  }

  props.updateAttributes({
    title: editTitle.value.trim(),
    url: normalizeUrl(editUrl.value),
  })
  closeEditor()
}

function setDisplayMode(mode: LinkMode) {
  if (!canEdit.value) {
    return
  }

  props.updateAttributes({ displayMode: mode })
}

function setAlign(nextAlign: LinkAlign) {
  if (!canEdit.value) {
    return
  }

  props.updateAttributes({ align: nextAlign })
  isAlignMenuOpen.value = false
}

function toggleAlignMenu() {
  if (!canEdit.value) {
    return
  }

  isAlignMenuOpen.value = !isAlignMenuOpen.value
}

function closeAlignMenu() {
  isAlignMenuOpen.value = false
}

function openFullscreen() {
  isFullscreenOpen.value = true
}

function closeFullscreen() {
  isFullscreenOpen.value = false
}

function removeLinkBlock() {
  if (!canEdit.value) {
    return
  }

  props.deleteNode()
}

function startResize(event: MouseEvent, corner: ResizeCorner) {
  if (!canEdit.value) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  selectNode()

  isResizing.value = true
  resizeCorner = corner
  resizeStartX = event.clientX
  resizeStartWidth = widthPercent.value
  resizeStartY = event.clientY
  resizeStartHeight = previewHeight.value

  window.addEventListener('mousemove', handleResizeMove)
  window.addEventListener('mouseup', stopResize)
}

function startHeightResize(event: MouseEvent) {
  if (!canEdit.value) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  selectNode()

  isHeightResizing.value = true
  resizeStartY = event.clientY
  resizeStartHeight = previewHeight.value

  window.addEventListener('mousemove', handleHeightResizeMove)
  window.addEventListener('mouseup', stopHeightResize)
}

function handleResizeMove(event: MouseEvent) {
  if (!isResizing.value) {
    return
  }

  const deltaX = event.clientX - resizeStartX
  const deltaY = event.clientY - resizeStartY
  const horizontalFactor = resizeCorner === 'tl' || resizeCorner === 'bl' ? -1 : 1
  const verticalFactor = resizeCorner === 'tl' || resizeCorner === 'tr' ? -1 : 1
  const nextWidth = Math.max(30, Math.min(100, resizeStartWidth + (deltaX * horizontalFactor) / 8))
  const nextHeight = Math.max(240, Math.min(860, resizeStartHeight + deltaY * verticalFactor))
  props.updateAttributes({
    widthPercent: Math.round(nextWidth),
    height: Math.round(nextHeight),
  })
}

function handleHeightResizeMove(event: MouseEvent) {
  if (!isHeightResizing.value) {
    return
  }

  const delta = event.clientY - resizeStartY
  const nextHeight = Math.max(240, Math.min(860, resizeStartHeight + delta))
  props.updateAttributes({ height: Math.round(nextHeight) })
}

function stopResize() {
  isResizing.value = false
  window.removeEventListener('mousemove', handleResizeMove)
  window.removeEventListener('mouseup', stopResize)
}

function stopHeightResize() {
  isHeightResizing.value = false
  window.removeEventListener('mousemove', handleHeightResizeMove)
  window.removeEventListener('mouseup', stopHeightResize)
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!isAlignMenuOpen.value) {
    return
  }

  const target = event.target
  if (!(target instanceof Node) || !alignDropdownRef.value?.contains(target)) {
    closeAlignMenu()
  }
}

watch(
  () => [title.value, url.value],
  () => {
    if (!isConfigured.value) {
      formTitle.value = title.value
      formUrl.value = url.value
    }
  },
  { immediate: true },
)

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown, true)
})

onBeforeUnmount(() => {
  stopResize()
  stopHeightResize()
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
})
</script>

<template>
  <NodeViewWrapper
    class="norio-office-rich-link-block"
    :class="{ 'norio-office-rich-link-block--selected': selected && canEdit }"
    :data-align="align"
    :style="rootStyle"
    @mousedown="selectNode"
  >
    <template v-if="!isConfigured && canEdit">
      <div class="norio-office-rich-link-block__form-card">
        <label class="norio-office-rich-link-block__form-row">
          <span class="norio-office-rich-link-block__form-label">文本</span>
          <input
            v-model="formTitle"
            class="norio-office-rich-link-block__form-input"
            placeholder="输入文本"
            @keydown.enter.prevent="submitInitialForm"
          />
        </label>
        <label class="norio-office-rich-link-block__form-row">
          <span class="norio-office-rich-link-block__form-label">链接</span>
          <input
            v-model="formUrl"
            class="norio-office-rich-link-block__form-input"
            placeholder="粘贴或输入链接"
            @keydown.enter.prevent="submitInitialForm"
          />
        </label>
        <div class="norio-office-rich-link-block__form-actions">
          <button type="button" class="norio-office-rich-link-block__form-confirm" :disabled="!canSubmitForm" @click="submitInitialForm">确认</button>
        </div>
      </div>
    </template>

    <template v-else>
      <div v-if="selected && canEdit" class="norio-office-rich-link-block__toolbar">
        <button type="button" class="norio-office-rich-link-block__tool" title="全屏预览" @click.stop="openFullscreen">
          <OfficeIcon name="quanpingzuidahua" :size="14" color="#4b5563" background-color="transparent" />
        </button>
        <span class="norio-office-rich-link-block__divider" />
        <button
          type="button"
          class="norio-office-rich-link-block__tool"
          :class="{ 'norio-office-rich-link-block__tool--active': displayMode === 'text' }"
          title="文字模式"
          @click.stop="setDisplayMode('text')"
        >
          <OfficeIcon name="wenziyulan" :size="14" color="#4b5563" background-color="transparent" />
        </button>
        <button
          type="button"
          class="norio-office-rich-link-block__tool"
          :class="{ 'norio-office-rich-link-block__tool--active': displayMode === 'card' }"
          title="卡片模式"
          @click.stop="setDisplayMode('card')"
        >
          <OfficeIcon name="kapianyulan" :size="14" color="#4b5563" background-color="transparent" />
        </button>
        <button
          type="button"
          class="norio-office-rich-link-block__tool"
          :class="{ 'norio-office-rich-link-block__tool--active': displayMode === 'preview' }"
          title="预览模式"
          @click.stop="setDisplayMode('preview')"
        >
          <OfficeIcon name="fangdayulan" :size="14" color="#4b5563" background-color="transparent" />
        </button>
        <span class="norio-office-rich-link-block__divider" />
        <button type="button" class="norio-office-rich-link-block__tool" title="编辑超链接" @click.stop="openEditor">
          <OfficeIcon name="link" :size="14" color="#4b5563" background-color="transparent" />
        </button>
        <div ref="alignDropdownRef" class="norio-office-rich-link-block__dropdown">
          <button type="button" class="norio-office-rich-link-block__tool" title="对齐方式" @click.stop="toggleAlignMenu">
            <OfficeIcon :name="alignIconName" :size="14" color="#4b5563" background-color="transparent" />
          </button>

          <div v-if="isAlignMenuOpen" class="norio-office-rich-link-block__align-menu">
            <button
              type="button"
              class="norio-office-rich-link-block__align-item"
              :class="{ 'norio-office-rich-link-block__align-item--active': align === 'left' }"
              @click.stop="setAlign('left')"
            >
              <OfficeColorIcon v-if="align === 'left'" name="duihao" :size="16" background-color="transparent" />
              <span v-else class="norio-office-rich-link-block__align-check" />
              <OfficeIcon class="norio-office-rich-link-block__align-icon" name="zuoduiqi" :size="14" color="#4b5563" background-color="transparent" />
              <span>左对齐</span>
            </button>
            <button
              type="button"
              class="norio-office-rich-link-block__align-item"
              :class="{ 'norio-office-rich-link-block__align-item--active': align === 'center' }"
              @click.stop="setAlign('center')"
            >
              <OfficeColorIcon v-if="align === 'center'" name="duihao" :size="16" background-color="transparent" />
              <span v-else class="norio-office-rich-link-block__align-check" />
              <OfficeIcon class="norio-office-rich-link-block__align-icon" name="juzhongduiqi" :size="14" color="#4b5563" background-color="transparent" />
              <span>居中对齐</span>
            </button>
            <button
              type="button"
              class="norio-office-rich-link-block__align-item"
              :class="{ 'norio-office-rich-link-block__align-item--active': align === 'right' }"
              @click.stop="setAlign('right')"
            >
              <OfficeColorIcon v-if="align === 'right'" name="duihao" :size="16" background-color="transparent" />
              <span v-else class="norio-office-rich-link-block__align-check" />
              <OfficeIcon class="norio-office-rich-link-block__align-icon" name="youduiqi" :size="14" color="#4b5563" background-color="transparent" />
              <span>右对齐</span>
            </button>
          </div>
        </div>
        <button type="button" class="norio-office-rich-link-block__tool" title="删除超链接" @click.stop="removeLinkBlock">
          <OfficeIcon name="delete" :size="14" color="#4b5563" background-color="transparent" />
        </button>
      </div>

      <div v-if="displayMode === 'preview'" class="norio-office-rich-link-block__preview">
        <iframe
          class="norio-office-rich-link-block__iframe"
          :src="normalizedUrl"
          :style="{ height: `${previewHeight}px` }"
          sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-scripts"
          referrerpolicy="no-referrer"
        />
        <div class="norio-office-rich-link-block__preview-footer">
          <div class="norio-office-rich-link-block__preview-meta">
            <OfficeColorIcon name="wangye" :size="20" background-color="transparent" />
            <span class="norio-office-rich-link-block__preview-title">{{ title }}</span>
          </div>
          <a class="norio-office-rich-link-block__preview-open" :href="normalizedUrl" target="_blank" rel="noreferrer noopener" @click.stop>
            <OfficeIcon name="yulan" :size="18" color="#6b7280" background-color="transparent" />
          </a>
        </div>
      </div>

      <a
        v-else-if="displayMode === 'card'"
        class="norio-office-rich-link-block__card"
        :href="normalizedUrl"
        target="_blank"
        rel="noreferrer noopener"
        @click.stop
      >
        <div class="norio-office-rich-link-block__card-meta">
          <OfficeColorIcon name="wangye" :size="48" background-color="transparent" />
          <div class="norio-office-rich-link-block__card-text">
            <div class="norio-office-rich-link-block__card-title">{{ title }}</div>
            <div class="norio-office-rich-link-block__card-subtitle">{{ domainLabel }}</div>
          </div>
        </div>
        <OfficeIcon name="yulan" :size="18" color="#6b7280" background-color="transparent" />
      </a>

      <a
        v-else
        class="norio-office-rich-link-block__text"
        :href="normalizedUrl"
        target="_blank"
        rel="noreferrer noopener"
        @click.stop
      >
        <OfficeColorIcon name="wangye" :size="18" background-color="transparent" />
        <span>{{ title }}</span>
      </a>
    </template>

    <span v-if="selected && canEdit && isConfigured && displayMode === 'preview'" class="norio-office-rich-link-block__handle norio-office-rich-link-block__handle--tl" @mousedown="startResize($event, 'tl')" />
    <span v-if="selected && canEdit && isConfigured && displayMode === 'preview'" class="norio-office-rich-link-block__handle norio-office-rich-link-block__handle--tr" @mousedown="startResize($event, 'tr')" />
    <span v-if="selected && canEdit && isConfigured && displayMode === 'preview'" class="norio-office-rich-link-block__handle norio-office-rich-link-block__handle--bl" @mousedown="startResize($event, 'bl')" />
    <span v-if="selected && canEdit && isConfigured && displayMode === 'preview'" class="norio-office-rich-link-block__handle norio-office-rich-link-block__handle--br" @mousedown="startResize($event, 'br')" />
    <span v-if="selected && canEdit && isConfigured && displayMode === 'preview'" class="norio-office-rich-link-block__bottom-bar" @mousedown="startHeightResize" />

    <div v-if="isEditing && canEdit" class="norio-office-rich-link-block__dialog" @click="closeEditor">
      <div class="norio-office-rich-link-block__dialog-card" @click.stop>
        <label class="norio-office-rich-link-block__dialog-row">
          <span class="norio-office-rich-link-block__dialog-label">文本</span>
          <input
            v-model="editTitle"
            class="norio-office-rich-link-block__dialog-input"
            placeholder="输入文本"
            @keydown.enter.prevent="submitEdit"
          />
        </label>
        <label class="norio-office-rich-link-block__dialog-row">
          <span class="norio-office-rich-link-block__dialog-label">链接</span>
          <input
            v-model="editUrl"
            class="norio-office-rich-link-block__dialog-input"
            placeholder="粘贴或输入链接"
            @keydown.enter.prevent="submitEdit"
          />
        </label>
        <div class="norio-office-rich-link-block__dialog-actions">
          <button type="button" class="norio-office-rich-link-block__dialog-confirm" :disabled="!canSubmitEdit" @click="submitEdit">确认</button>
        </div>
      </div>
    </div>

    <div v-if="isFullscreenOpen" class="norio-office-rich-link-block__fullscreen" @click="closeFullscreen">
      <div class="norio-office-rich-link-block__fullscreen-card" @click.stop>
        <div class="norio-office-rich-link-block__fullscreen-toolbar">
          <div class="norio-office-rich-link-block__fullscreen-title">{{ title }}</div>
          <div class="norio-office-rich-link-block__fullscreen-actions">
            <a class="norio-office-rich-link-block__fullscreen-open" :href="normalizedUrl" target="_blank" rel="noreferrer noopener" @click.stop>
              在新窗口打开
            </a>
            <button type="button" class="norio-office-rich-link-block__fullscreen-close" @click="closeFullscreen">
              <OfficeIcon name="close" :size="16" color="#4b5563" background-color="transparent" />
            </button>
          </div>
        </div>
        <iframe
          class="norio-office-rich-link-block__fullscreen-iframe"
          :src="normalizedUrl"
          sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-scripts"
          referrerpolicy="no-referrer"
        />
      </div>
    </div>
  </NodeViewWrapper>
</template>
