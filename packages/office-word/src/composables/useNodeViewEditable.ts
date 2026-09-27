import type { Editor } from '@tiptap/core'
import { onBeforeUnmount, onMounted, readonly, ref } from 'vue'

export function useNodeViewEditable(editor: Editor) {
  const editable = ref(editor.isEditable)
  let observer: MutationObserver | null = null

  function syncEditable() {
    const root = editor.view.dom.closest<HTMLElement>('.norio-office-rich-editor')
    editable.value = editor.isEditable && root?.dataset.editable !== 'false' && root?.dataset.presentation !== 'true'
  }

  onMounted(() => {
    editor.on('update', syncEditable)
    const root = editor.view.dom.closest('.norio-office-rich-editor')
    if (root) {
      // Mode switches do not emit document updates, so observe the editor shell too.
      observer = new MutationObserver(syncEditable)
      observer.observe(root, { attributes: true, attributeFilter: ['data-editable', 'data-presentation'] })
    }
    syncEditable()
  })

  onBeforeUnmount(() => {
    editor.off('update', syncEditable)
    observer?.disconnect()
  })

  return readonly(editable)
}
