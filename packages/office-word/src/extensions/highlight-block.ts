import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'

import HighlightBlockView from '../components/HighlightBlockView.vue'

const DEFAULT_HIGHLIGHT_BLOCK_TITLE = '高亮块'
const DEFAULT_HIGHLIGHT_BLOCK_EMOJI = '✍️'
const DEFAULT_HIGHLIGHT_BLOCK_BORDER_COLOR = '#f3c389'
const DEFAULT_HIGHLIGHT_BLOCK_BACKGROUND_COLOR = '#fff8ef'

export const HighlightBlock = Node.create({
  name: 'highlightBlock',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      titleEnabled: {
        default: true,
        parseHTML: (element) => element.getAttribute('data-title-enabled') !== 'false',
        renderHTML: (attributes) => ({
          'data-title-enabled': attributes.titleEnabled ? 'true' : 'false',
        }),
      },
      emojiEnabled: {
        default: true,
        parseHTML: (element) => element.getAttribute('data-emoji-enabled') !== 'false',
        renderHTML: (attributes) => ({
          'data-emoji-enabled': attributes.emojiEnabled ? 'true' : 'false',
        }),
      },
      title: {
        default: DEFAULT_HIGHLIGHT_BLOCK_TITLE,
        parseHTML: (element) => element.getAttribute('data-title') || DEFAULT_HIGHLIGHT_BLOCK_TITLE,
        renderHTML: (attributes) => ({
          'data-title': attributes.title || DEFAULT_HIGHLIGHT_BLOCK_TITLE,
        }),
      },
      emoji: {
        default: DEFAULT_HIGHLIGHT_BLOCK_EMOJI,
        parseHTML: (element) => element.getAttribute('data-emoji') || DEFAULT_HIGHLIGHT_BLOCK_EMOJI,
        renderHTML: (attributes) => ({
          'data-emoji': attributes.emoji || DEFAULT_HIGHLIGHT_BLOCK_EMOJI,
        }),
      },
      borderColor: {
        default: DEFAULT_HIGHLIGHT_BLOCK_BORDER_COLOR,
        parseHTML: (element) => element.getAttribute('data-border-color') || DEFAULT_HIGHLIGHT_BLOCK_BORDER_COLOR,
        renderHTML: (attributes) => ({
          'data-border-color': attributes.borderColor || DEFAULT_HIGHLIGHT_BLOCK_BORDER_COLOR,
        }),
      },
      backgroundColor: {
        default: DEFAULT_HIGHLIGHT_BLOCK_BACKGROUND_COLOR,
        parseHTML: (element) => element.getAttribute('data-background-color') || DEFAULT_HIGHLIGHT_BLOCK_BACKGROUND_COLOR,
        renderHTML: (attributes) => ({
          'data-background-color': attributes.backgroundColor || DEFAULT_HIGHLIGHT_BLOCK_BACKGROUND_COLOR,
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="highlight-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'highlight-block' }), 0]
  },

  addNodeView() {
    return VueNodeViewRenderer(HighlightBlockView)
  },
})
