import { Node } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'

import FormulaBlockView from '../components/FormulaBlockView.vue'

export const FormulaBlock = Node.create({
  name: 'formulaBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-latex') || '',
        renderHTML: (attributes) => ({
          'data-latex': String(attributes.latex ?? ''),
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="formula-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-type': 'formula-block' }]
  },

  addNodeView() {
    return VueNodeViewRenderer(FormulaBlockView)
  },
})
