<script setup lang="ts">
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/vue-3'

import OfficeColorIcon from './OfficeColorIcon.vue'
import OfficeIcon from './OfficeIcon.vue'
import { useNodeViewEditable } from '../composables/useNodeViewEditable'
import type { RichTextEditorUploadErrorHandler, RichTextEditorUploadResult } from '../types'

type VideoAlign = 'left' | 'center' | 'right'
type ResizeCorner = 'tl' | 'tr' | 'bl' | 'br'

const props = defineProps<NodeViewProps>()

type UploadRequestDetail = {
  kind: 'video'
  file: File
  handled: boolean
  resolve: (result: RichTextEditorUploadResult) => void
  reject: (error: unknown) => void
}

type VideoUploadState = {
  status: 'uploading' | 'error'
  file: File
  message?: string
}

const inputRef = ref<HTMLInputElement | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)
const alignDropdownRef = ref<HTMLElement | null>(null)
const uploadState = ref<VideoUploadState | null>(null)
const isAlignMenuOpen = ref(false)
const editFieldValue = ref('')
const isDescriptionDialogOpen = ref(false)
const isResizing = ref(false)
const isHeightResizing = ref(false)
let resizeStartX = 0
let resizeStartWidth = 100
let resizeStartY = 0
let resizeStartHeight = 220
let resizeCorner: ResizeCorner = 'br'
let player: Plyr | null = null

const src = computed(() => String(props.node.attrs.src ?? ''))
const name = computed(() => String(props.node.attrs.name ?? ''))
const description = computed(() => String(props.node.attrs.description ?? ''))
const mimeType = computed(() => String(props.node.attrs.mimeType ?? 'video/mp4'))
const align = computed<VideoAlign>(() => {
  const value = String(props.node.attrs.align ?? 'left')
  return value === 'center' || value === 'right' ? value : 'left'
})
const widthPercent = computed(() => Number(props.node.attrs.widthPercent ?? 100))
const blockHeight = computed(() => Number(props.node.attrs.height ?? 220))
const hasVideo = computed(() => src.value.length > 0)
const canEdit = useNodeViewEditable(props.editor)
const isUploading = computed(() => uploadState.value?.status === 'uploading')
const hasUploadError = computed(() => uploadState.value?.status === 'error')
const alignIconName = computed(() => {
  if (align.value === 'center') {
    return 'juzhongduiqi'
  }

  if (align.value === 'right') {
    return 'youduiqi'
  }

  return 'zuoduiqi'
})

function selectNode() {
  if (!canEdit.value) {
    return
  }

  const position = props.getPos()
  if (typeof position === 'number') {
    props.editor.commands.setNodeSelection(position)
  }
}

function openPicker() {
  if (!canEdit.value || isUploading.value) {
    return
  }

  inputRef.value?.click()
  selectNode()
}

async function resolveVideoFile(file: File): Promise<RichTextEditorUploadResult> {
  return await new Promise<RichTextEditorUploadResult>((resolve, reject) => {
    const detail: UploadRequestDetail = {
      kind: 'video',
      file,
      handled: false,
      resolve,
      reject,
    }

    props.editor.view.dom.dispatchEvent(
      new CustomEvent<UploadRequestDetail>('norio-office-rich-upload-request', {
        bubbles: true,
        detail,
      }),
    )

    if (!detail.handled) {
      reject(new Error('Missing uploadVideo hook.'))
    }
  })
}

function emitUploadError(file: File, error: unknown) {
  const onUploadError = props.extension.options.onUploadError as RichTextEditorUploadErrorHandler | null | undefined
  onUploadError?.({ kind: 'video', fileName: file.name, error })
}

function getUploadErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : '上传失败，请重试。'
}

async function uploadVideoFile(file: File) {
  uploadState.value = { status: 'uploading', file }

  try {
    const uploadResult = await resolveVideoFile(file)
		props.updateAttributes({
			assetId: uploadResult.assetId || '',
			src: uploadResult.url,
      name: uploadResult.name || file.name,
      description: uploadResult.description ?? description.value,
      mimeType: uploadResult.mimeType || file.type || 'video/mp4',
    })
    uploadState.value = null
  } catch (error) {
    uploadState.value = {
      status: 'error',
      file,
      message: getUploadErrorMessage(error),
    }
    emitUploadError(file, error)
  }
}

function retryVideoUpload() {
  if (!uploadState.value?.file || uploadState.value.status !== 'error') {
    return
  }

  void uploadVideoFile(uploadState.value.file)
}

async function handleAddVideo(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file || !file.type.startsWith('video/')) {
    target.value = ''
    return
  }

  await uploadVideoFile(file)
  target.value = ''
}

function setAlign(nextAlign: VideoAlign) {
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

function openDescriptionDialog() {
  if (!canEdit.value) {
    return
  }

  editFieldValue.value = description.value
  isDescriptionDialogOpen.value = true
}

function closeDescriptionDialog() {
  isDescriptionDialogOpen.value = false
  editFieldValue.value = ''
}

function confirmDescription() {
  if (!canEdit.value) {
    return
  }

  props.updateAttributes({
    description: editFieldValue.value.trim(),
  })
  closeDescriptionDialog()
}

function removeVideo() {
  if (!canEdit.value) {
    return
  }

  props.deleteNode()
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (isAlignMenuOpen.value) {
    const target = event.target
    if (!(target instanceof Node) || !alignDropdownRef.value?.contains(target)) {
      closeAlignMenu()
    }
  }
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
  resizeStartHeight = blockHeight.value

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
  resizeStartHeight = blockHeight.value

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
  const nextHeight = Math.max(180, Math.min(640, resizeStartHeight + deltaY * verticalFactor))
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
  const nextHeight = Math.max(180, Math.min(640, resizeStartHeight + delta))
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

async function syncPlayer() {
  player?.destroy()
  player = null

  await nextTick()

  if (!videoRef.value || !hasVideo.value) {
    return
  }

  player = new Plyr(videoRef.value, {
    controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'fullscreen'],
    tooltips: { controls: true, seek: true },
    i18n: {
      restart: '重新开始',
      rewind: '后退 {seektime} 秒',
      play: '播放',
      pause: '暂停',
      fastForward: '快进 {seektime} 秒',
      seek: '跳转',
      seekLabel: '{currentTime} / {duration}',
      played: '已播放',
      buffered: '已缓冲',
      currentTime: '当前时间',
      duration: '总时长',
      volume: '音量',
      mute: '静音',
      unmute: '取消静音',
      enableCaptions: '开启字幕',
      disableCaptions: '关闭字幕',
      download: '下载',
      enterFullscreen: '全屏',
      exitFullscreen: '退出全屏',
      frameTitle: '视频播放器：{title}',
      captions: '字幕',
      settings: '设置',
      pip: '画中画',
      menuBack: '返回上一级',
      speed: '播放速度',
      normal: '1.x',
      quality: '清晰度',
      loop: '循环播放',
      start: '开始',
      end: '结束',
      all: '全部',
      reset: '重置',
      disabled: '关闭',
      enabled: '开启',
      advertisement: '广告',
      qualityBadge: {
        2160: '4K',
        1440: '2K',
        1080: '1080p',
        720: '720p',
        576: '576p',
        480: '480p',
      },
    },
  })
  player.poster = ''
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown, true)
  void syncPlayer()
})

watch(src, () => {
  void syncPlayer()
})

onBeforeUnmount(() => {
  stopResize()
  stopHeightResize()
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
  player?.destroy()
  player = null
})
</script>

<template>
  <NodeViewWrapper
    class="norio-office-rich-video-block"
    :class="{
      'norio-office-rich-video-block--selected': selected && canEdit,
      'norio-office-rich-video-block--uploading': isUploading,
      'norio-office-rich-video-block--upload-error': hasUploadError,
    }"
    :data-align="align"
    :style="{ width: `${widthPercent}%` }"
    @mousedown="selectNode"
  >
    <div v-if="selected && canEdit" class="norio-office-rich-video-block__toolbar">
      <button
        type="button"
        class="norio-office-rich-video-block__tool"
        :disabled="isUploading"
        :title="hasVideo ? '替换视频' : '上传视频'"
        @click.stop="openPicker"
      >
        <OfficeIcon name="xiangshangcharu" :size="14" color="#4b5563" background-color="transparent" />
      </button>

      <button v-if="hasVideo" type="button" class="norio-office-rich-video-block__tool" title="视频描述" @click.stop="openDescriptionDialog">
        <OfficeIcon name="comment" :size="14" color="#4b5563" background-color="transparent" />
      </button>

      <div ref="alignDropdownRef" class="norio-office-rich-video-block__dropdown">
        <button type="button" class="norio-office-rich-video-block__tool" title="视频对齐方式" @click.stop="toggleAlignMenu">
          <OfficeIcon :name="alignIconName" :size="14" color="#4b5563" background-color="transparent" />
        </button>

        <div v-if="isAlignMenuOpen" class="norio-office-rich-video-block__align-menu">
          <button
            type="button"
            class="norio-office-rich-video-block__align-item"
            :class="{ 'norio-office-rich-video-block__align-item--active': align === 'left' }"
            @click.stop="setAlign('left')"
          >
            <OfficeColorIcon v-if="align === 'left'" name="duihao" :size="16" background-color="transparent" />
            <span v-else class="norio-office-rich-video-block__align-check" />
            <OfficeIcon class="norio-office-rich-video-block__align-icon" name="zuoduiqi" :size="14" color="#4b5563" background-color="transparent" />
            <span>左对齐</span>
          </button>
          <button
            type="button"
            class="norio-office-rich-video-block__align-item"
            :class="{ 'norio-office-rich-video-block__align-item--active': align === 'center' }"
            @click.stop="setAlign('center')"
          >
            <OfficeColorIcon v-if="align === 'center'" name="duihao" :size="16" background-color="transparent" />
            <span v-else class="norio-office-rich-video-block__align-check" />
            <OfficeIcon class="norio-office-rich-video-block__align-icon" name="juzhongduiqi" :size="14" color="#4b5563" background-color="transparent" />
            <span>居中对齐</span>
          </button>
          <button
            type="button"
            class="norio-office-rich-video-block__align-item"
            :class="{ 'norio-office-rich-video-block__align-item--active': align === 'right' }"
            @click.stop="setAlign('right')"
          >
            <OfficeColorIcon v-if="align === 'right'" name="duihao" :size="16" background-color="transparent" />
            <span v-else class="norio-office-rich-video-block__align-check" />
            <OfficeIcon class="norio-office-rich-video-block__align-icon" name="youduiqi" :size="14" color="#4b5563" background-color="transparent" />
            <span>右对齐</span>
          </button>
        </div>
      </div>

      <button type="button" class="norio-office-rich-video-block__tool" :disabled="isUploading" title="视频删除" @click.stop="removeVideo">
        <OfficeIcon name="delete" :size="14" color="#4b5563" background-color="transparent" />
      </button>
    </div>

    <div class="norio-office-rich-video-block__body">
      <template v-if="hasVideo">
        <video
          ref="videoRef"
          class="norio-office-rich-video-block__player"
          playsinline
          controls
          :style="{ height: `${blockHeight}px` }"
        >
          <source :src="src" :type="mimeType" />
        </video>
        <div v-if="description" class="norio-office-rich-video-block__caption">
          <div class="norio-office-rich-video-block__caption-desc">{{ description }}</div>
        </div>
        <div v-if="uploadState" class="norio-office-rich-video-block__upload-overlay">
          <div
            class="norio-office-rich-video-block__upload-state"
            :class="{ 'norio-office-rich-video-block__upload-state--error': hasUploadError }"
          >
            <span v-if="isUploading" class="norio-office-rich-upload-spinner" aria-hidden="true" />
            <div class="norio-office-rich-video-block__upload-title">{{ isUploading ? '视频上传中' : '视频上传失败' }}</div>
            <div class="norio-office-rich-video-block__upload-file">{{ uploadState.message || uploadState.file.name }}</div>
            <div v-if="hasUploadError" class="norio-office-rich-video-block__placeholder-actions">
              <button type="button" class="norio-office-rich-video-block__placeholder-button" title="重试上传" @click.stop="retryVideoUpload">
                <span>重试</span>
              </button>
              <button type="button" class="norio-office-rich-video-block__placeholder-button" title="重新选择视频" @click.stop="openPicker">
                <span>重新选择</span>
              </button>
            </div>
          </div>
        </div>
      </template>

      <div v-else class="norio-office-rich-video-block__placeholder" :style="{ minHeight: `${blockHeight}px` }">
        <template v-if="isUploading">
          <div class="norio-office-rich-video-block__upload-state">
            <span class="norio-office-rich-upload-spinner" aria-hidden="true" />
            <div class="norio-office-rich-video-block__upload-title">视频上传中</div>
            <div class="norio-office-rich-video-block__upload-file">{{ uploadState?.file.name }}</div>
          </div>
        </template>
        <template v-else-if="hasUploadError">
          <div class="norio-office-rich-video-block__upload-state norio-office-rich-video-block__upload-state--error">
            <div class="norio-office-rich-video-block__upload-title">视频上传失败</div>
            <div class="norio-office-rich-video-block__upload-file">{{ uploadState?.message }}</div>
            <div class="norio-office-rich-video-block__placeholder-actions">
              <button type="button" class="norio-office-rich-video-block__placeholder-button" title="重试上传" @click.stop="retryVideoUpload">
                <span>重试</span>
              </button>
              <button type="button" class="norio-office-rich-video-block__placeholder-button" title="重新选择视频" @click.stop="openPicker">
                <span>重新选择</span>
              </button>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="norio-office-rich-video-block__placeholder-title">
            <OfficeColorIcon name="shipin" :size="16" background-color="transparent" />
            <span>视频</span>
          </div>
          <div v-if="canEdit" class="norio-office-rich-video-block__placeholder-actions">
            <button type="button" class="norio-office-rich-video-block__placeholder-button" title="上传视频" @click.stop="openPicker">
              <OfficeIcon name="xiangshangcharu" :size="14" color="#4b5563" background-color="transparent" />
              <span>上传视频</span>
            </button>
          </div>
        </template>
      </div>
    </div>

    <span v-if="selected && canEdit" class="norio-office-rich-video-block__handle norio-office-rich-video-block__handle--tl" @mousedown="startResize($event, 'tl')" />
    <span v-if="selected && canEdit" class="norio-office-rich-video-block__handle norio-office-rich-video-block__handle--tr" @mousedown="startResize($event, 'tr')" />
    <span v-if="selected && canEdit" class="norio-office-rich-video-block__handle norio-office-rich-video-block__handle--bl" @mousedown="startResize($event, 'bl')" />
    <span v-if="selected && canEdit" class="norio-office-rich-video-block__handle norio-office-rich-video-block__handle--br" @mousedown="startResize($event, 'br')" />
    <span v-if="selected && canEdit" class="norio-office-rich-video-block__bottom-bar" @mousedown="startHeightResize" />

    <div v-if="isDescriptionDialogOpen && canEdit" class="norio-office-rich-video-block__dialog" @click="closeDescriptionDialog">
      <div class="norio-office-rich-video-block__dialog-card" @click.stop>
        <label class="norio-office-rich-video-block__dialog-row">
          <span class="norio-office-rich-video-block__dialog-label">描述</span>
          <input
            v-model="editFieldValue"
            class="norio-office-rich-video-block__dialog-input"
            placeholder="输入视频描述"
            @keydown.enter.prevent="confirmDescription"
          />
        </label>
        <div class="norio-office-rich-video-block__dialog-actions">
          <button type="button" class="norio-office-rich-video-block__dialog-confirm" @click="confirmDescription">确认</button>
        </div>
      </div>
    </div>

    <input ref="inputRef" type="file" accept="video/*" hidden @change="handleAddVideo" />
  </NodeViewWrapper>
</template>
