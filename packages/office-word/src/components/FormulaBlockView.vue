<script setup lang="ts">
import katex from 'katex'
import 'katex/dist/katex.min.css'

import { computed, ref } from 'vue'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/vue-3'

import FormulaEditorDialog from './FormulaEditorDialog.vue'
import { useNodeViewEditable } from '../composables/useNodeViewEditable'

const props = defineProps<NodeViewProps>()

const isEditing = ref(false)

const latex = computed(() => String(props.node.attrs.latex ?? ''))
const canEdit = useNodeViewEditable(props.editor)
const markup = computed(() => {
  const source = latex.value.trim()
  if (!source) {
    return ''
  }

  try {
    return katex.renderToString(source, {
      throwOnError: false,
      displayMode: true,
      strict: 'ignore',
    })
  } catch {
    return ''
  }
})
const errorMessage = computed(() => {
  if (!latex.value.trim() || markup.value) {
    return ''
  }

  return '公式渲染失败'
})

function openEditor() {
  if (!canEdit.value) {
    return
  }

  isEditing.value = true
}

function closeEditor() {
  isEditing.value = false
}

function updateFormula(nextLatex: string) {
  if (!canEdit.value) {
    return
  }

  props.updateAttributes({
    latex: nextLatex,
  })
  isEditing.value = false
}
</script>

<template>
  <NodeViewWrapper
    class="norio-office-rich-formula-block"
    :class="{ 'norio-office-rich-formula-block--selected': props.selected && canEdit }"
    data-drag-handle
    @dblclick.stop="openEditor"
  >
    <div v-if="markup" class="norio-office-rich-formula-block__content" v-html="markup" />
    <div v-else-if="errorMessage" class="norio-office-rich-formula-block__error">{{ errorMessage }}</div>
    <div v-else class="norio-office-rich-formula-block__placeholder">双击编辑公式</div>

    <FormulaEditorDialog
      :open="isEditing && canEdit"
      :value="latex"
      title="编辑 LaTeX 公式"
      submit-label="确定"
      @close="closeEditor"
      @submit="updateFormula"
    />
  </NodeViewWrapper>
</template>
