<script setup lang="ts">
import { onBeforeUnmount, ref, unref, watch, type Ref } from 'vue'
import type {
  RichTextEditorInstance,
  RichTextEditorOutlineItem,
  RichTextEditorOutlineState,
} from '../types'
import OutlinePanel from './OutlinePanel.vue'

const props = withDefaults(defineProps<{
  editor: RichTextEditorInstance | Ref<RichTextEditorInstance | null> | null
  open?: boolean
  placement?: 'left' | 'right'
  title?: string
  collapseTitle?: string
  emptyDescription?: string
  emptyTip?: string
  showCollapse?: boolean
}>(), {
  open: true,
  placement: 'right',
  title: '大纲',
  collapseTitle: '收起大纲',
  emptyDescription: '对文档内容应用“标题”样式，即可自动生成大纲。',
  emptyTip: '',
  showCollapse: false,
})

const emit = defineEmits<{
  toggle: []
  select: [pos: number]
  change: [state: RichTextEditorOutlineState]
}>()

const items = ref<RichTextEditorOutlineItem[]>([])
const activePos = ref<number | null>(null)
let stopOutlineChange: (() => void) | null = null

function resolveEditor() {
  return unref(props.editor)
}

function applyOutlineState(state: RichTextEditorOutlineState) {
  items.value = state.items
  activePos.value = state.activePos
  emit('change', state)
}

function syncFromEditor() {
  const editor = resolveEditor()
  applyOutlineState({
    items: editor?.getOutlineItems() ?? [],
    activePos: editor?.getActiveOutlinePos() ?? null,
  })
}

function bindEditor() {
  stopOutlineChange?.()
  stopOutlineChange = null

  const editor = resolveEditor()

  if (!editor) {
    syncFromEditor()
    return
  }

  stopOutlineChange = editor.onOutlineChange(applyOutlineState)
}

function selectOutlineItem(pos: number) {
  emit('select', pos)
  resolveEditor()?.focusOutlineItem(pos)
}

watch(() => resolveEditor(), bindEditor, { immediate: true })

onBeforeUnmount(() => {
  stopOutlineChange?.()
})
</script>

<template>
  <OutlinePanel
    standalone
    :open="open"
    :placement="placement"
    :title="title"
    :collapse-title="collapseTitle"
    :empty-description="emptyDescription"
    :empty-tip="emptyTip"
    :show-collapse="showCollapse"
    :items="items"
    :active-pos="activePos"
    @toggle="emit('toggle')"
    @select="selectOutlineItem"
  />
</template>
