import { Node } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'

import CountdownBlockView from '../components/CountdownBlockView.vue'

export const CountdownBlock = Node.create({
  name: 'countdownBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      targetTimestamp: {
        default: 0,
        parseHTML: (element) => Number.parseInt(element.getAttribute('data-target-timestamp') ?? '0', 10) || 0,
        renderHTML: (attributes) => ({
          'data-target-timestamp': String(attributes.targetTimestamp ?? 0),
        }),
      },
      mode: {
        default: 'duration',
        parseHTML: (element) => element.getAttribute('data-mode') || 'duration',
        renderHTML: (attributes) => ({
          'data-mode': String(attributes.mode ?? 'duration'),
        }),
      },
      color: {
        default: '#ff8b00',
        parseHTML: (element) => element.getAttribute('data-color') || '#ff8b00',
        renderHTML: (attributes) => ({
          'data-color': String(attributes.color ?? '#ff8b00'),
        }),
      },
      reminderEnabled: {
        default: true,
        parseHTML: (element) => element.getAttribute('data-reminder-enabled') !== 'false',
        renderHTML: (attributes) => ({
          'data-reminder-enabled': attributes.reminderEnabled === false ? 'false' : 'true',
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="countdown-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-type': 'countdown-block' }]
  },

  addNodeView() {
    return VueNodeViewRenderer(CountdownBlockView)
  },
})
