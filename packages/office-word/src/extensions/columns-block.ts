import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'

import ColumnsBlockView from '../components/ColumnsBlockView.vue'
import { createEqualColumnWidths, normalizeColumnWidths } from '../utils/columns'

export const ColumnsBlock = Node.create({
  name: 'columnsBlock',
  group: 'block',
  content: 'columnsColumn+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      widths: {
        default: createEqualColumnWidths(2),
        parseHTML: (element) => {
          const raw = element.getAttribute('data-widths')
          if (!raw) {
            return createEqualColumnWidths(element.childElementCount || 2)
          }

          try {
            return normalizeColumnWidths(JSON.parse(decodeURIComponent(raw)), element.childElementCount || 2)
          } catch {
            return createEqualColumnWidths(element.childElementCount || 2)
          }
        },
        renderHTML: (attributes) => ({
          'data-widths': encodeURIComponent(JSON.stringify(attributes.widths ?? createEqualColumnWidths(2))),
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="columns-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'columns-block' }), 0]
  },

  addNodeView() {
    return VueNodeViewRenderer(ColumnsBlockView)
  },
})
