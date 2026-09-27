import { Node } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'

import LinkBlockView from '../components/LinkBlockView.vue'

export const LinkBlock = Node.create({
  name: 'linkBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      title: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-title') || '',
        renderHTML: (attributes) => ({
          'data-title': String(attributes.title ?? ''),
        }),
      },
      url: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-url') || '',
        renderHTML: (attributes) => ({
          'data-url': String(attributes.url ?? ''),
        }),
      },
      displayMode: {
        default: 'preview',
        parseHTML: (element) => element.getAttribute('data-display-mode') || 'preview',
        renderHTML: (attributes) => ({
          'data-display-mode': String(attributes.displayMode ?? 'preview'),
        }),
      },
      align: {
        default: 'left',
        parseHTML: (element) => element.getAttribute('data-align') || 'left',
        renderHTML: (attributes) => ({
          'data-align': String(attributes.align ?? 'left'),
        }),
      },
      widthPercent: {
        default: 100,
        parseHTML: (element) => Number.parseInt(element.getAttribute('data-width-percent') ?? '100', 10) || 100,
        renderHTML: (attributes) => ({
          'data-width-percent': String(attributes.widthPercent ?? 100),
        }),
      },
      height: {
        default: 420,
        parseHTML: (element) => Number.parseInt(element.getAttribute('data-height') ?? '420', 10) || 420,
        renderHTML: (attributes) => ({
          'data-height': String(attributes.height ?? 420),
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="link-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-type': 'link-block' }]
  },

  addNodeView() {
    return VueNodeViewRenderer(LinkBlockView)
  },
})
