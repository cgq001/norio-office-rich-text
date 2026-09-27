import { Node, mergeAttributes } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

import { createEqualColumnWidths } from '../utils/columns'

function isColumnEmpty(node: import('@tiptap/pm/model').Node) {
  return node.textContent.trim().length === 0
}

export const ColumnsColumn = Node.create({
  name: 'columnsColumn',
  content: 'block+',
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-type="columns-column"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'columns-column', class: 'norio-office-rich-columns__column' }), 0]
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const { state, view } = this.editor
        const { selection, schema } = state

        if (!selection.empty || selection.$from.parentOffset !== 0) {
          return false
        }

        let blockDepth = -1
        let columnDepth = -1

        for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
          const nodeName = selection.$from.node(depth).type.name
          if (nodeName === 'columnsColumn' && columnDepth < 0) {
            columnDepth = depth
          }
          if (nodeName === 'columnsBlock') {
            blockDepth = depth
            break
          }
        }

        if (blockDepth < 0 || columnDepth < 0) {
          return false
        }

        const blockNode = selection.$from.node(blockDepth)
        const columnNode = selection.$from.node(columnDepth)
        if (!isColumnEmpty(columnNode)) {
          return false
        }

        const blockPos = selection.$from.before(blockDepth)
        const columnPos = selection.$from.before(columnDepth)
        const columnIndex = selection.$from.index(blockDepth)
        const tr = state.tr

        if (blockNode.childCount <= 1) {
          const paragraph = schema.nodes.paragraph?.create()
          if (!paragraph) {
            return false
          }

          tr.replaceWith(blockPos, blockPos + blockNode.nodeSize, paragraph)
          tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(blockPos + 1, tr.doc.content.size)), 1))
          view.dispatch(tr.scrollIntoView())
          return true
        }

        tr.delete(columnPos, columnPos + columnNode.nodeSize)
        tr.setNodeMarkup(blockPos, undefined, {
          ...blockNode.attrs,
          widths: createEqualColumnWidths(blockNode.childCount - 1),
        })

        const nextBlock = tr.doc.nodeAt(blockPos)
        if (nextBlock) {
          const targetIndex = Math.max(0, columnIndex - 1)
          let targetPos = blockPos + 1

          for (let index = 0; index < targetIndex; index += 1) {
            targetPos += nextBlock.child(index).nodeSize
          }

          tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(targetPos + 1, tr.doc.content.size)), 1))
        }

        view.dispatch(tr.scrollIntoView())
        return true
      },
    }
  },
})
