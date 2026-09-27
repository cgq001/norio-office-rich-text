<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { TextSelection } from '@tiptap/pm/state'
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/vue-3'

import OfficeIcon from './OfficeIcon.vue'
import { useNodeViewEditable } from '../composables/useNodeViewEditable'
import { createEqualColumnWidths, MAX_COLUMNS, MIN_COLUMN_WIDTH, normalizeColumnWidths } from '../utils/columns'

const props = defineProps<NodeViewProps>()

type ElementLike = HTMLElement | { $el?: Element | null } | null

const contentRef = ref<ElementLike>(null)
const hoveredDividerIndex = ref<number | null>(null)
const draggingDividerIndex = ref<number | null>(null)
const dividerCenters = ref<number[]>([])

let resizeObserver: ResizeObserver | null = null
let dragState:
  | {
      index: number
      startX: number
      leftWidth: number
      rightWidth: number
      totalWidth: number
    }
  | null = null

const columnCount = computed(() => props.node.childCount)
const widths = computed(() => normalizeColumnWidths(props.node.attrs.widths, columnCount.value))
const canEdit = useNodeViewEditable(props.editor)
const canAddMoreColumns = computed(() => columnCount.value < MAX_COLUMNS)
const layoutStyle = computed(() => ({
  gridTemplateColumns: widths.value.map((width) => `minmax(0, ${width}fr)`).join(' '),
}))

function getBlockPos() {
  if (typeof props.getPos !== 'function') {
    return null
  }

  const position = props.getPos()
  return typeof position === 'number' ? position : null
}

function getColumnElements() {
  const contentElement = resolveContentElement()
  if (!contentElement) {
    return []
  }

  return Array.from(contentElement.querySelectorAll(':scope > [data-type="columns-column"]')) as HTMLElement[]
}

function resolveContentElement() {
  if (contentRef.value instanceof HTMLElement) {
    return contentRef.value
  }

  const element = contentRef.value?.$el
  return element instanceof HTMLElement ? element : null
}

function refreshDividerMetrics() {
  const contentElement = resolveContentElement()
  if (!contentElement) {
    dividerCenters.value = []
    return
  }

  const columns = getColumnElements()
  const contentRect = contentElement.getBoundingClientRect()
  const nextCenters: number[] = []

  for (let index = 0; index < columns.length - 1; index += 1) {
    const leftRect = columns[index].getBoundingClientRect()
    const rightRect = columns[index + 1].getBoundingClientRect()
    nextCenters.push(((leftRect.right + rightRect.left) / 2) - contentRect.left)
  }

  dividerCenters.value = nextCenters
}

function insertColumnAfter(index: number) {
  if (!canEdit.value || !canAddMoreColumns.value) {
    return
  }

  const blockPos = getBlockPos()
  if (blockPos === null) {
    return
  }

  const { state, view } = props.editor
  const blockNode = state.doc.nodeAt(blockPos)
  const columnType = state.schema.nodes.columnsColumn
  const paragraphType = state.schema.nodes.paragraph

  if (!blockNode || !columnType || !paragraphType) {
    return
  }

  const insertIndex = index + 1
  const nextColumn = columnType.create(undefined, [paragraphType.create()])
  let insertPos = blockPos + 1
  for (let childIndex = 0; childIndex < insertIndex; childIndex += 1) {
    insertPos += blockNode.child(childIndex).nodeSize
  }

  const tr = state.tr.insert(insertPos, nextColumn)
  tr.setNodeMarkup(blockPos, undefined, {
    ...blockNode.attrs,
    widths: createEqualColumnWidths(blockNode.childCount + 1),
  })
  tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(insertPos + 1, tr.doc.content.size)), 1))
  view.dispatch(tr.scrollIntoView())
}

function handleDividerEnter(index: number) {
  if (!canEdit.value) {
    return
  }

  hoveredDividerIndex.value = index
}

function handleDividerLeave(index: number) {
  if (draggingDividerIndex.value !== index) {
    hoveredDividerIndex.value = null
  }
}

function stopResize() {
  dragState = null
  draggingDividerIndex.value = null
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', stopResize)
  window.removeEventListener('pointercancel', stopResize)
}

function handlePointerMove(event: PointerEvent) {
  if (!dragState) {
    return
  }

  const pairTotal = dragState.leftWidth + dragState.rightWidth
  const delta = ((event.clientX - dragState.startX) / Math.max(dragState.totalWidth, 1)) * 100
  const nextWidths = widths.value.slice()
  const minLeft = MIN_COLUMN_WIDTH
  const maxLeft = pairTotal - MIN_COLUMN_WIDTH
  const leftWidth = Math.min(Math.max(dragState.leftWidth + delta, minLeft), maxLeft)
  const rightWidth = pairTotal - leftWidth

  nextWidths[dragState.index] = leftWidth
  nextWidths[dragState.index + 1] = rightWidth
  props.updateAttributes({
    widths: normalizeColumnWidths(nextWidths, columnCount.value),
  })
}

function startResize(index: number, event: PointerEvent) {
  if (!canEdit.value) {
    return
  }

  event.preventDefault()
  event.stopPropagation()

  const columns = getColumnElements()
  if (!columns[index] || !columns[index + 1]) {
    return
  }

  dragState = {
    index,
    startX: event.clientX,
    leftWidth: widths.value[index] ?? 0,
    rightWidth: widths.value[index + 1] ?? 0,
    totalWidth: columns.reduce((sum, column) => sum + column.getBoundingClientRect().width, 0),
  }

  draggingDividerIndex.value = index
  hoveredDividerIndex.value = index
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', stopResize)
  window.addEventListener('pointercancel', stopResize)
}

watch(
  () => [props.node.childCount, JSON.stringify(props.node.attrs.widths)],
  () => {
    void nextTick(refreshDividerMetrics)
  },
)

onMounted(() => {
  void nextTick(refreshDividerMetrics)

  const contentElement = resolveContentElement()
  if (typeof ResizeObserver !== 'undefined' && contentElement) {
    resizeObserver = new ResizeObserver(() => {
      refreshDividerMetrics()
    })
    resizeObserver.observe(contentElement)
  }

  window.addEventListener('resize', refreshDividerMetrics, { passive: true })
})

onBeforeUnmount(() => {
  stopResize()
  resizeObserver?.disconnect()
  window.removeEventListener('resize', refreshDividerMetrics)
})
</script>

<template>
  <NodeViewWrapper class="norio-office-rich-columns">
    <div class="norio-office-rich-columns__surface">
      <NodeViewContent
        ref="contentRef"
        as="div"
        class="norio-office-rich-columns__content"
        :style="layoutStyle"
      />

      <div v-if="canEdit && dividerCenters.length" class="norio-office-rich-columns__overlay" aria-hidden="true">
        <div
          v-for="(center, index) in dividerCenters"
          :key="`columns-divider-${index}`"
          class="norio-office-rich-columns__divider-hitbox"
          :style="{ left: `${center}px` }"
          @mouseenter="handleDividerEnter(index)"
          @mouseleave="handleDividerLeave(index)"
        >
          <button
            v-if="canAddMoreColumns"
            type="button"
            class="norio-office-rich-columns__add-button"
            :class="{
              'norio-office-rich-columns__add-button--active': draggingDividerIndex === index,
            }"
            tabindex="-1"
            @mousedown.prevent
            @click.stop="insertColumnAfter(index)"
          >
            <span class="norio-office-rich-columns__add-tooltip">新增分栏</span>
            <OfficeIcon name="add" :size="16" color="#ffffff" background-color="transparent" />
          </button>

          <button
            type="button"
            class="norio-office-rich-columns__divider"
            :class="{
              'norio-office-rich-columns__divider--active': hoveredDividerIndex === index || draggingDividerIndex === index,
            }"
            tabindex="-1"
            @pointerdown="startResize(index, $event)"
          />
        </div>
      </div>
    </div>
  </NodeViewWrapper>
</template>
