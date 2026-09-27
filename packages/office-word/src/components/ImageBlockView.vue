<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type ComponentPublicInstance } from 'vue'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/vue-3'

import OfficeColorIcon from './OfficeColorIcon.vue'
import OfficeIcon from './OfficeIcon.vue'
import { normalizeWebUrl } from '../utils/url'
import { useNodeViewEditable } from '../composables/useNodeViewEditable'
import type { RichTextEditorUploadErrorHandler, RichTextEditorUploadResult } from '../types'

type ImageItem = {
	id: string
	assetId?: string
  src?: string
  alt?: string
  name?: string
  description?: string
  descriptionVisible?: boolean
  link?: string
  linkTarget?: '_blank' | '_self'
  rotation?: number
}

type ResizeCorner = 'tl' | 'tr' | 'bl' | 'br'

const props = defineProps<NodeViewProps>()

type UploadRequestDetail = {
  kind: 'image'
  file: File
  handled: boolean
  resolve: (result: RichTextEditorUploadResult) => void
  reject: (error: unknown) => void
}

type ImageUploadState = {
  status: 'uploading' | 'error'
  file: File
  message?: string
}

const inputRef = ref<HTMLInputElement | null>(null)
const alignDropdownRef = ref<HTMLElement | null>(null)
const linkTriggerRef = ref<HTMLButtonElement | null>(null)
const linkPopoverRef = ref<HTMLElement | null>(null)
const linkInputRef = ref<HTMLInputElement | null>(null)
const captionInputs = new Map<string, HTMLTextAreaElement>()
const selectedIndex = ref(0)
const pendingUploadIndex = ref<number | null>(null)
const uploadStates = ref<Record<string, ImageUploadState>>({})
const dragIndex = ref<number | null>(null)
const isResizing = ref(false)
const isHeightResizing = ref(false)
const isAlignMenuOpen = ref(false)
const viewerIndex = ref<number | null>(null)
const editImageId = ref<string | null>(null)
const editLinkValue = ref('')
const editLinkSamePage = ref(false)
const editLinkError = ref('')
const linkPopoverStyle = ref<Record<string, string>>({})
const linkTeleportTarget = ref<HTMLElement | 'body'>('body')
let resizeStartX = 0
let resizeStartWidth = 100
let resizeStartY = 0
let resizeStartHeight = 146
let resizeCorner: ResizeCorner = 'br'

const images = computed<ImageItem[]>(() => (Array.isArray(props.node.attrs.images) ? props.node.attrs.images : []))
const widthPercent = computed(() => Number(props.node.attrs.widthPercent ?? 100))
const align = computed(() => String(props.node.attrs.align ?? 'left'))
const blockHeight = computed(() => Number(props.node.attrs.height ?? 146))
const canEdit = useNodeViewEditable(props.editor)
const canInsertMore = computed(() => images.value.length < 4)
const hasSelectedImage = computed(() => images.value.length > 0 && selectedIndex.value >= 0 && selectedIndex.value < images.value.length)
const selectedImage = computed(() => (hasSelectedImage.value ? images.value[selectedIndex.value] : null))
const alignIconName = computed(() => {
  if (align.value === 'center') {
    return 'juzhongduiqi'
  }

  if (align.value === 'right') {
    return 'youduiqi'
  }

  return 'zuoduiqi'
})
const viewerImage = computed(() => {
  if (viewerIndex.value === null) {
    return null
  }

  return images.value[viewerIndex.value] ?? null
})

function createImageId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `image-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

async function resolveImageFile(file: File): Promise<RichTextEditorUploadResult> {
  return await new Promise<RichTextEditorUploadResult>((resolve, reject) => {
    const detail: UploadRequestDetail = {
      kind: 'image',
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
      reject(new Error('Missing uploadImage hook.'))
    }
  })
}

function emitUploadError(file: File, error: unknown) {
  const onUploadError = props.extension.options.onUploadError as RichTextEditorUploadErrorHandler | null | undefined
  onUploadError?.({ kind: 'image', fileName: file.name, error })
}

function getUploadErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : '上传失败，请重试。'
}

function getImageUploadState(index: number) {
  const image = images.value[index]
  if (!image) {
    return null
  }

  return uploadStates.value[image.id] ?? null
}

function setImageUploadState(imageId: string, state: ImageUploadState) {
  uploadStates.value = {
    ...uploadStates.value,
    [imageId]: state,
  }
}

function clearImageUploadState(imageId: string) {
  if (!uploadStates.value[imageId]) {
    return
  }

  const nextStates = { ...uploadStates.value }
  delete nextStates[imageId]
  uploadStates.value = nextStates
}

function selectNode() {
  if (!canEdit.value) {
    return
  }

  const position = props.getPos()
  if (typeof position === 'number') {
    props.editor.chain().focus().setNodeSelection(position).run()
  }
}

function setSelectedIndex(index: number) {
  if (images.value[index]?.id !== editImageId.value) closeLinkEditor()
  selectedIndex.value = index
  selectNode()
}

function updateImages(nextImages: ImageItem[]) {
  props.updateAttributes({ images: nextImages })
}

function openPicker(index: number) {
  if (!canEdit.value) {
    return
  }

  const uploadState = getImageUploadState(index)
  if (uploadState?.status === 'uploading') {
    return
  }

  pendingUploadIndex.value = index
  inputRef.value?.click()
  setSelectedIndex(index)
}

async function uploadImageToIndex(file: File, index: number) {
  const image = images.value[index]
  if (!image) {
    return
  }

  const imageId = image.id
  setSelectedIndex(index)
  setImageUploadState(imageId, { status: 'uploading', file })

  try {
    const uploadResult = await resolveImageFile(file)
    const nextImages = [...images.value]
    const currentIndex = nextImages.findIndex((item) => item.id === imageId)

    if (currentIndex === -1) {
      clearImageUploadState(imageId)
      return
    }

	nextImages[currentIndex] = {
		...nextImages[currentIndex],
		assetId: uploadResult.assetId,
		src: uploadResult.url,
      alt: uploadResult.alt || uploadResult.name || file.name,
      name: uploadResult.name || file.name,
      description: uploadResult.description ?? nextImages[currentIndex]?.description ?? '',
      link: nextImages[currentIndex]?.link ?? '',
      rotation: nextImages[currentIndex]?.rotation ?? 0,
    }
    updateImages(nextImages)
    clearImageUploadState(imageId)
  } catch (error) {
    setImageUploadState(imageId, {
      status: 'error',
      file,
      message: getUploadErrorMessage(error),
    })
    emitUploadError(file, error)
  }
}

function retryImageUpload(index: number) {
  const uploadState = getImageUploadState(index)
  if (!uploadState?.file || uploadState.status !== 'error') {
    return
  }

  void uploadImageToIndex(uploadState.file, index)
}

async function handleAddImages(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  const index = pendingUploadIndex.value

  if (!file || index === null || !file.type.startsWith('image/')) {
    target.value = ''
    pendingUploadIndex.value = null
    return
  }

  await uploadImageToIndex(file, index)
  target.value = ''
  pendingUploadIndex.value = null
}

function insertPlaceholderRight() {
  if (!canEdit.value || !hasSelectedImage.value || !canInsertMore.value) {
    return
  }

  const nextImages = [...images.value]
  nextImages.splice(selectedIndex.value + 1, 0, { id: createImageId(), rotation: 0 })
  updateImages(nextImages)
  selectedIndex.value = Math.min(selectedIndex.value + 1, nextImages.length - 1)
}

function removeSelectedImage() {
  if (!canEdit.value || !hasSelectedImage.value) {
    return
  }

  if (images.value.length === 1) {
    props.deleteNode()
    return
  }

  const nextImages = [...images.value]
  nextImages.splice(selectedIndex.value, 1)
  updateImages(nextImages)
  selectedIndex.value = Math.max(0, selectedIndex.value - 1)
}

function removeImageGroup() {
  if (!canEdit.value) {
    return
  }

  props.deleteNode()
}

function handleDragStart(index: number, event: DragEvent) {
  if (!canEdit.value || !images.value[index]?.src || getImageUploadState(index)?.status === 'uploading') {
    event.preventDefault()
    return
  }

  dragIndex.value = index
}

function handleImageDragOver(event: DragEvent) {
  if (dragIndex.value === null) return
  event.preventDefault()
  event.stopPropagation()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

function handleDrop(index: number, event: DragEvent) {
  // Only consume this group's reorder. Other groups use ProseMirror's node move.
  if (dragIndex.value === null) return
  event.preventDefault()
  event.stopPropagation()
  props.editor.view.dragging = null
  if (!canEdit.value || dragIndex.value === index) {
    dragIndex.value = null
    return
  }

  const nextImages = [...images.value]
  const [moved] = nextImages.splice(dragIndex.value, 1)
  nextImages.splice(index, 0, moved)
  updateImages(nextImages)
  selectedIndex.value = index
  dragIndex.value = null
}

function handleDragEnd() {
  dragIndex.value = null
}

function setAlign(nextAlign: 'left' | 'center' | 'right') {
  if (!canEdit.value) {
    return
  }

  props.updateAttributes({ align: nextAlign })
  isAlignMenuOpen.value = false
}

function closeAlignMenu() {
  isAlignMenuOpen.value = false
}

function toggleAlignMenu() {
  if (!canEdit.value) {
    return
  }

  closeLinkEditor()
  isAlignMenuOpen.value = !isAlignMenuOpen.value
}

function handleDocumentPointerDown(event: PointerEvent) {
  const linkTarget = event.target
  if (editImageId.value && (!(linkTarget instanceof Node) || (!linkPopoverRef.value?.contains(linkTarget) && !linkTriggerRef.value?.contains(linkTarget)))) {
    closeLinkEditor()
  }
  if (!isAlignMenuOpen.value) {
    return
  }

  const target = event.target
  if (!(target instanceof Node)) {
    closeAlignMenu()
    return
  }

  if (alignDropdownRef.value?.contains(target)) {
    return
  }

  closeAlignMenu()
}

function rotateSelectedImage() {
  if (!canEdit.value || !selectedImage.value) {
    return
  }

  const nextImages = [...images.value]
  const currentRotation = Number(selectedImage.value.rotation ?? 0)
  nextImages[selectedIndex.value] = {
    ...selectedImage.value,
    rotation: (currentRotation + 90) % 360,
  }
  updateImages(nextImages)
}

function updateImageById(id: string, attrs: Partial<ImageItem>) {
  if (!canEdit.value || !props.editor.isEditable || !images.value.some(image => image.id === id)) return
  updateImages(images.value.map(image => image.id === id ? { ...image, ...attrs } : image))
}

function showCaption(image: ImageItem) {
  return image.descriptionVisible ?? !!image.description
}

function resizeCaption(input: HTMLTextAreaElement) {
  input.style.height = 'auto'
  input.style.height = `${input.scrollHeight + input.offsetHeight - input.clientHeight}px`
}

function setCaptionInput(id: string, element: Element | ComponentPublicInstance | null) {
  if (element instanceof HTMLTextAreaElement) captionInputs.set(id, element)
  else captionInputs.delete(id)
}

async function openCaption() {
  const image = selectedImage.value
  if (!canEdit.value || !image?.src) return
  closeLinkEditor()
  closeAlignMenu()
  updateImageById(image.id, { descriptionVisible: true })
  await nextTick()
  const input = captionInputs.get(image.id)
  if (input) {
    resizeCaption(input)
    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)
  }
}

function handleCaptionInput(id: string, event: Event) {
  const input = event.target as HTMLTextAreaElement
  updateImageById(id, { description: input.value, descriptionVisible: true })
  resizeCaption(input)
}

function handleCaptionKeyDown(id: string, event: KeyboardEvent) {
  if (event.key !== 'Backspace' || event.isComposing || (event.target as HTMLTextAreaElement).value !== '') return
  event.preventDefault()
  updateImageById(id, { description: '', descriptionVisible: false })
  void nextTick(() => {
    const pos = props.getPos()
    if (typeof pos === 'number') props.editor.chain().focus().setNodeSelection(pos).run()
  })
}

function syncLinkPopoverPosition() {
  if (!editImageId.value || !linkTriggerRef.value) return
  const anchor = linkTriggerRef.value.getBoundingClientRect()
  const toolbar = linkTriggerRef.value.closest('.norio-office-rich-image-block__toolbar')?.getBoundingClientRect() ?? anchor
  const width = Math.min(320, window.innerWidth - 16)
  const height = linkPopoverRef.value?.offsetHeight || 184
  const below = toolbar.bottom + 8
  const top = below + height <= window.innerHeight - 8 ? below : toolbar.top - height - 8
  linkPopoverStyle.value = {
    left: `${Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8))}px`,
    top: `${Math.max(8, Math.min(top, window.innerHeight - height - 8))}px`,
    width: `${width}px`, maxHeight: `${window.innerHeight - 16}px`,
  }
}

function syncFullscreenTarget() {
  const fullscreen = document.fullscreenElement
  linkTeleportTarget.value = fullscreen instanceof HTMLElement && fullscreen.contains(props.editor.view.dom) ? fullscreen : 'body'
  void nextTick(syncLinkPopoverPosition)
}

function handleWindowResize() {
  syncLinkPopoverPosition()
  captionInputs.forEach(resizeCaption)
}

async function openLinkEditor() {
  const image = selectedImage.value
  if (!canEdit.value || !image?.src) return
  closeAlignMenu()
  editImageId.value = image.id
  editLinkValue.value = image.link ?? ''
  editLinkSamePage.value = image.linkTarget === '_self'
  editLinkError.value = ''
  syncLinkPopoverPosition()
  await nextTick()
  syncLinkPopoverPosition()
  linkInputRef.value?.focus()
  linkInputRef.value?.select()
}

function closeLinkEditor() {
  editImageId.value = null
  editLinkValue.value = ''
  editLinkError.value = ''
}

function confirmLinkEditor() {
  const id = editImageId.value
  if (!canEdit.value || !id) return
  const link = normalizeWebUrl(editLinkValue.value)
  if (editLinkValue.value.trim() && !link) {
    editLinkError.value = '请输入有效的 HTTP 或 HTTPS 网址'
    void nextTick(syncLinkPopoverPosition)
    return
  }
  updateImageById(id, { link, linkTarget: editLinkSamePage.value ? '_self' : '_blank' })
  closeLinkEditor()
}

function openViewer() {
  if (!selectedImage.value?.src) {
    return
  }

  viewerIndex.value = selectedIndex.value
}

function closeViewer() {
  viewerIndex.value = null
}

function showPrevImage() {
  if (viewerIndex.value === null || images.value.length <= 1) {
    return
  }

  viewerIndex.value = (viewerIndex.value - 1 + images.value.length) % images.value.length
}

function showNextImage() {
  if (viewerIndex.value === null || images.value.length <= 1) {
    return
  }

  viewerIndex.value = (viewerIndex.value + 1) % images.value.length
}

function startResize(event: PointerEvent, corner: ResizeCorner) {
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

  window.addEventListener('pointermove', handleResizeMove)
  window.addEventListener('pointerup', stopResize)
}

function startHeightResize(event: PointerEvent) {
  if (!canEdit.value) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  selectNode()

  isHeightResizing.value = true
  resizeStartY = event.clientY
  resizeStartHeight = blockHeight.value

  window.addEventListener('pointermove', handleHeightResizeMove)
  window.addEventListener('pointerup', stopHeightResize)
}

function handleResizeMove(event: PointerEvent) {
  if (!isResizing.value) {
    return
  }

  const deltaX = event.clientX - resizeStartX
  const deltaY = event.clientY - resizeStartY
  const horizontalFactor = resizeCorner === 'tl' || resizeCorner === 'bl' ? -1 : 1
  const verticalFactor = resizeCorner === 'tl' || resizeCorner === 'tr' ? -1 : 1
  const nextWidth = Math.max(30, Math.min(100, resizeStartWidth + (deltaX * horizontalFactor) / 8))
  const nextHeight = Math.max(146, Math.min(560, resizeStartHeight + deltaY * verticalFactor))
  props.updateAttributes({
    widthPercent: Math.round(nextWidth),
    height: Math.round(nextHeight),
  })
}

function handleHeightResizeMove(event: PointerEvent) {
  if (!isHeightResizing.value) {
    return
  }

  const delta = event.clientY - resizeStartY
  const nextHeight = Math.max(146, Math.min(560, resizeStartHeight + delta))
  props.updateAttributes({ height: Math.round(nextHeight) })
}

function stopResize() {
  isResizing.value = false
  window.removeEventListener('pointermove', handleResizeMove)
  window.removeEventListener('pointerup', stopResize)
}

function stopHeightResize() {
  isHeightResizing.value = false
  window.removeEventListener('pointermove', handleHeightResizeMove)
  window.removeEventListener('pointerup', stopHeightResize)
}

onBeforeUnmount(() => {
  stopResize()
  stopHeightResize()
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
  window.removeEventListener('scroll', syncLinkPopoverPosition, true)
  window.removeEventListener('resize', handleWindowResize)
  document.removeEventListener('fullscreenchange', syncFullscreenTarget)
})

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown, true)
  window.addEventListener('scroll', syncLinkPopoverPosition, true)
  window.addEventListener('resize', handleWindowResize)
  document.addEventListener('fullscreenchange', syncFullscreenTarget)
  syncFullscreenTarget()
  void nextTick(() => captionInputs.forEach(resizeCaption))
})

watch(() => props.selected, selected => { if (!selected) closeLinkEditor() })
watch(() => canEdit.value, editable => { if (!editable) closeLinkEditor() })
watch(() => [images.value, props.node.attrs.widthPercent], () => {
  if (editImageId.value && !images.value.some(image => image.id === editImageId.value)) closeLinkEditor()
  void nextTick(() => captionInputs.forEach(resizeCaption))
})

watch(
  () => images.value.length,
  (length) => {
    if (length <= 1) {
      return
    }

    const hasRotation = images.value.some((image) => Number(image.rotation ?? 0) !== 0)
    if (!hasRotation) {
      return
    }

    updateImages(
      images.value.map((image) => ({
        ...image,
        rotation: 0,
      })),
    )
  },
)

watch(
  () => images.value.map((image) => image.id).join('|'),
  () => {
    const imageIds = new Set(images.value.map((image) => image.id))
    const nextStates = Object.fromEntries(
      Object.entries(uploadStates.value).filter(([imageId]) => imageIds.has(imageId)),
    )

    if (Object.keys(nextStates).length !== Object.keys(uploadStates.value).length) {
      uploadStates.value = nextStates
    }
  },
)
</script>

<template>
  <NodeViewWrapper
    class="norio-office-rich-image-block"
    :class="{ 'norio-office-rich-image-block--selected': selected && canEdit }"
    :data-align="align"
    :style="{ width: `${widthPercent}%` }"
    @mousedown="selectNode"
  >
    <div v-if="selected && canEdit" class="norio-office-rich-image-block__toolbar">
      <div ref="alignDropdownRef" class="norio-office-rich-image-block__dropdown">
        <button type="button" class="norio-office-rich-image-block__tool" title="图片对齐方式" @click.stop="toggleAlignMenu">
          <OfficeIcon :name="alignIconName" :size="14" color="#4b5563" background-color="transparent" />
        </button>

        <div v-if="isAlignMenuOpen" class="norio-office-rich-image-block__align-menu">
          <button
            type="button"
            class="norio-office-rich-image-block__align-item"
            :class="{ 'norio-office-rich-image-block__align-item--active': align === 'left' }"
            title="左对齐"
            @click.stop="setAlign('left')"
          >
            <OfficeColorIcon v-if="align === 'left'" name="duihao" :size="16" background-color="transparent" />
            <span v-else class="norio-office-rich-image-block__align-check" />
            <OfficeIcon class="norio-office-rich-image-block__align-icon" name="zuoduiqi" :size="14" color="#4b5563" background-color="transparent" />
            <span>左对齐</span>
          </button>
          <button
            type="button"
            class="norio-office-rich-image-block__align-item"
            :class="{ 'norio-office-rich-image-block__align-item--active': align === 'center' }"
            title="居中对齐"
            @click.stop="setAlign('center')"
          >
            <OfficeColorIcon v-if="align === 'center'" name="duihao" :size="16" background-color="transparent" />
            <span v-else class="norio-office-rich-image-block__align-check" />
            <OfficeIcon class="norio-office-rich-image-block__align-icon" name="juzhongduiqi" :size="14" color="#4b5563" background-color="transparent" />
            <span>居中对齐</span>
          </button>
          <button
            type="button"
            class="norio-office-rich-image-block__align-item"
            :class="{ 'norio-office-rich-image-block__align-item--active': align === 'right' }"
            title="右对齐"
            @click.stop="setAlign('right')"
          >
            <OfficeColorIcon v-if="align === 'right'" name="duihao" :size="16" background-color="transparent" />
            <span v-else class="norio-office-rich-image-block__align-check" />
            <OfficeIcon class="norio-office-rich-image-block__align-icon" name="youduiqi" :size="14" color="#4b5563" background-color="transparent" />
            <span>右对齐</span>
          </button>
        </div>
      </div>

      <button
        v-if="hasSelectedImage && canInsertMore"
        type="button"
        class="norio-office-rich-image-block__tool"
        title="在右侧插入图片占位"
        @click.stop="insertPlaceholderRight"
      >
        <OfficeIcon name="charutupian" :size="16" color="#4b5563" background-color="transparent" />
      </button>

      <button v-if="selectedImage?.src" type="button" class="norio-office-rich-image-block__tool" title="放大查看图片" @click.stop="openViewer">
        <OfficeIcon name="yulan" :size="14" color="#4b5563" background-color="transparent" />
      </button>
      <button v-if="selectedImage?.src" type="button" class="norio-office-rich-image-block__tool" title="旋转图片 90 度" @click.stop="rotateSelectedImage">
        <OfficeIcon name="xuanzhuan" :size="14" color="#4b5563" background-color="transparent" />
      </button>
      <button v-if="selectedImage?.src" ref="linkTriggerRef" type="button" class="norio-office-rich-image-block__tool" title="设置图片链接" :aria-expanded="!!editImageId" @mousedown.prevent.stop @click.stop="openLinkEditor">
        <OfficeIcon name="link" :size="14" color="#4b5563" background-color="transparent" />
      </button>
      <button
        v-if="selectedImage?.src"
        type="button"
        class="norio-office-rich-image-block__tool"
        title="设置图片描述"
        @mousedown.prevent.stop
        @click.stop="openCaption"
      >
        <OfficeIcon name="comment" :size="14" color="#4b5563" background-color="transparent" />
      </button>

      <button type="button" class="norio-office-rich-image-block__tool" title="删除当前图片" @click.stop="removeSelectedImage">
        <OfficeIcon name="delete" :size="14" color="#4b5563" background-color="transparent" />
      </button>
      <button type="button" class="norio-office-rich-image-block__tool" title="删除图片组" @click.stop="removeImageGroup">
        <OfficeIcon name="rubber" :size="14" color="#4b5563" background-color="transparent" />
      </button>
    </div>

    <div class="norio-office-rich-image-block__body">
      <div class="norio-office-rich-image-block__grid" :style="{ gridTemplateColumns: `repeat(${Math.max(images.length, 1)}, minmax(0, 1fr))` }">
        <div
          v-for="(image, index) in images"
          :key="image.id"
          class="norio-office-rich-image-block__item"
          :class="{
            'norio-office-rich-image-block__item--selected': selected && canEdit && selectedIndex === index,
            'norio-office-rich-image-block__item--uploading': getImageUploadState(index)?.status === 'uploading',
            'norio-office-rich-image-block__item--upload-error': getImageUploadState(index)?.status === 'error',
          }"
          :style="{ minHeight: `${blockHeight}px` }"
          :draggable="canEdit && !!image.src && getImageUploadState(index)?.status !== 'uploading'"
          :data-drag-handle="canEdit ? '' : undefined"
          @mousedown="setSelectedIndex(index)"
          @click.stop="setSelectedIndex(index)"
          @dragstart="handleDragStart(index, $event)"
          @dragover="handleImageDragOver"
          @drop="handleDrop(index, $event)"
          @dragend="handleDragEnd"
        >
          <template v-if="image.src">
            <div class="norio-office-rich-image-block__image-stage" :style="{ height: `${blockHeight}px` }">
              <component
                :is="canEdit ? 'span' : 'a'"
                v-if="normalizeWebUrl(image.link || '')"
                class="norio-office-rich-image-block__image-link"
                draggable="false"
                :href="canEdit ? undefined : normalizeWebUrl(image.link || '')"
                :target="canEdit ? undefined : image.linkTarget === '_self' ? '_self' : '_blank'"
                :rel="canEdit ? undefined : 'noreferrer noopener'"
                :data-image-link="canEdit ? normalizeWebUrl(image.link || '') : undefined"
                :data-image-link-target="canEdit ? image.linkTarget === '_self' ? '_self' : '_blank' : undefined"
                @mousedown="!canEdit && $event.stopPropagation()"
                @click.stop="setSelectedIndex(index)"
              >
                <img
                  class="norio-office-rich-image-block__image"
                  draggable="false"
                  :src="image.src"
                  :alt="image.alt || ''"
                  :style="{ transform: `rotate(${Number(image.rotation ?? 0)}deg)` }"
                />
              </component>
              <img
                v-else
                class="norio-office-rich-image-block__image"
                draggable="false"
                :src="image.src"
                :alt="image.alt || ''"
                :style="{ transform: `rotate(${Number(image.rotation ?? 0)}deg)` }"
              />
            </div>
            <div v-if="showCaption(image)" class="norio-office-rich-image-block__caption" @mousedown.stop @click.stop @dragstart.prevent.stop>
              <textarea
                v-if="canEdit"
                :ref="el => setCaptionInput(image.id, el)"
                class="norio-office-rich-image-block__caption-input"
                :value="image.description || ''"
                rows="1"
                placeholder="添加图片描述"
                aria-label="图片描述"
                @focus="selectedIndex = index"
                @input="handleCaptionInput(image.id, $event)"
                @keydown.stop="handleCaptionKeyDown(image.id, $event)"
              />
              <div class="norio-office-rich-image-block__caption-desc" :hidden="canEdit">{{ image.description }}</div>
            </div>
          </template>
          <div v-else class="norio-office-rich-image-block__placeholder" :style="{ minHeight: `${blockHeight}px` }">
            <template v-if="getImageUploadState(index)?.status === 'uploading'">
              <div class="norio-office-rich-image-block__upload-state">
                <span class="norio-office-rich-upload-spinner" aria-hidden="true" />
                <div class="norio-office-rich-image-block__upload-title">图片上传中</div>
                <div class="norio-office-rich-image-block__upload-file">{{ getImageUploadState(index)?.file.name }}</div>
              </div>
            </template>
            <template v-else-if="getImageUploadState(index)?.status === 'error'">
              <div class="norio-office-rich-image-block__upload-state norio-office-rich-image-block__upload-state--error">
                <div class="norio-office-rich-image-block__upload-title">图片上传失败</div>
                <div class="norio-office-rich-image-block__upload-file">{{ getImageUploadState(index)?.message }}</div>
                <div class="norio-office-rich-image-block__placeholder-actions">
                  <button type="button" class="norio-office-rich-image-block__placeholder-button" title="重试上传" @click.stop="retryImageUpload(index)">
                    <span>重试</span>
                  </button>
                  <button type="button" class="norio-office-rich-image-block__placeholder-button" title="重新选择图片" @click.stop="openPicker(index)">
                    <span>重新选择</span>
                  </button>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="norio-office-rich-image-block__placeholder-title">
                <OfficeColorIcon name="tupian" :size="16" background-color="transparent" />
                <span>图片</span>
              </div>
              <div v-if="canEdit" class="norio-office-rich-image-block__placeholder-actions">
                <button type="button" class="norio-office-rich-image-block__placeholder-button" title="上传图片" @click.stop="openPicker(index)">
                  <OfficeIcon name="xiangshangcharu" :size="14" color="#4b5563" background-color="transparent" />
                  <span>上传图片</span>
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <span v-if="selected && canEdit" draggable="false" class="norio-office-rich-image-block__handle norio-office-rich-image-block__handle--tl" @dragstart.prevent.stop @pointerdown="startResize($event, 'tl')" />
    <span v-if="selected && canEdit" draggable="false" class="norio-office-rich-image-block__handle norio-office-rich-image-block__handle--tr" @dragstart.prevent.stop @pointerdown="startResize($event, 'tr')" />
    <span v-if="selected && canEdit" draggable="false" class="norio-office-rich-image-block__handle norio-office-rich-image-block__handle--bl" @dragstart.prevent.stop @pointerdown="startResize($event, 'bl')" />
    <span v-if="selected && canEdit" draggable="false" class="norio-office-rich-image-block__handle norio-office-rich-image-block__handle--br" @dragstart.prevent.stop @pointerdown="startResize($event, 'br')" />
    <span v-if="selected && canEdit" draggable="false" class="norio-office-rich-image-block__bottom-bar" @dragstart.prevent.stop @pointerdown="startHeightResize" />

    <input ref="inputRef" type="file" accept="image/*" hidden @change="handleAddImages" />
  </NodeViewWrapper>

  <Teleport to="body">
    <div v-if="viewerImage?.src" class="norio-office-rich-image-block__viewer" @click="closeViewer">
      <button
        v-if="images.length > 1"
        type="button"
        class="norio-office-rich-image-block__viewer-nav norio-office-rich-image-block__viewer-nav--prev"
        title="上一张"
        @click.stop="showPrevImage"
      >
        <OfficeIcon name="zuojiantou" :size="18" color="#ffffff" background-color="transparent" />
      </button>
      <div class="norio-office-rich-image-block__viewer-stage" @click.stop>
        <img class="norio-office-rich-image-block__viewer-image" :src="viewerImage.src" :alt="viewerImage.alt || ''" />
        <div class="norio-office-rich-image-block__viewer-meta">
          <div class="norio-office-rich-image-block__viewer-name">{{ viewerImage.name || viewerImage.alt || '图片' }}</div>
          <div v-if="viewerImage.description" class="norio-office-rich-image-block__viewer-desc">{{ viewerImage.description }}</div>
          <div class="norio-office-rich-image-block__viewer-count">{{ (viewerIndex ?? 0) + 1 }} / {{ images.length }}</div>
        </div>
      </div>
      <button
        v-if="images.length > 1"
        type="button"
        class="norio-office-rich-image-block__viewer-nav norio-office-rich-image-block__viewer-nav--next"
        title="下一张"
        @click.stop="showNextImage"
      >
        <OfficeIcon name="youjiantou" :size="18" color="#ffffff" background-color="transparent" />
      </button>
      <button type="button" class="norio-office-rich-image-block__viewer-close" title="关闭预览" @click.stop="closeViewer">
        <OfficeIcon name="close" :size="18" color="#ffffff" background-color="transparent" />
      </button>
    </div>

  </Teleport>

  <Teleport :to="linkTeleportTarget">
    <form
      v-if="editImageId && canEdit"
      ref="linkPopoverRef"
      class="norio-office-rich-image-block__link-popover"
      :style="linkPopoverStyle"
      role="dialog"
      aria-label="图片链接"
      @pointerdown.stop
      @mousedown.stop
      @click.stop
      @keydown.esc.prevent.stop="closeLinkEditor"
      @submit.prevent="confirmLinkEditor"
    >
      <input
        ref="linkInputRef"
        v-model="editLinkValue"
        type="text"
        class="norio-office-rich-image-block__link-input"
        placeholder="请输入网址"
        aria-label="图片链接网址"
        :aria-invalid="!!editLinkError"
        @input="editLinkError = ''"
      />
      <p v-if="editLinkError" class="norio-office-rich-image-block__link-error" role="alert">{{ editLinkError }}</p>
      <label class="norio-office-rich-image-block__link-target">
        <input v-model="editLinkSamePage" type="checkbox" />
        <span>在当前页面打开</span>
      </label>
      <div class="norio-office-rich-image-block__link-actions">
        <button type="button" @click="closeLinkEditor">取消</button>
        <button type="submit" class="norio-office-rich-image-block__link-confirm">确定</button>
      </div>
    </form>
  </Teleport>
</template>


