import { Node } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'

import MentionInlineView from '../components/MentionInlineView.vue'
import type { RichTextEditorMentionItem } from '../types'

export const Mention = Node.create({
  name: 'mention',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return {
      onClick: null as ((payload: RichTextEditorMentionItem) => void) | null,
    }
  },

  addAttributes() {
    return {
      id: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-mention-id') || '',
        renderHTML: (attributes) => ({
          'data-mention-id': String(attributes.id ?? ''),
        }),
      },
      name: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-mention-name') || '',
        renderHTML: (attributes) => ({
          'data-mention-name': String(attributes.name ?? ''),
        }),
      },
      type: {
        default: 1,
        parseHTML: (element) => Number.parseInt(element.getAttribute('data-mention-type') ?? '1', 10) === 2 ? 2 : 1,
        renderHTML: (attributes) => ({
          'data-mention-type': String(Number(attributes.type ?? 1) === 2 ? 2 : 1),
        }),
      },
      avatar: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-mention-avatar') || '',
        renderHTML: (attributes) => ({
          'data-mention-avatar': String(attributes.avatar ?? ''),
        }),
      },
      icon: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-mention-icon') || '',
        renderHTML: (attributes) => ({
          'data-mention-icon': String(attributes.icon ?? ''),
        }),
      },
      tag: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-mention-tag') || '',
        renderHTML: (attributes) => ({
          'data-mention-tag': String(attributes.tag ?? ''),
        }),
      },
      updatedAt: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-mention-updated-at') || '',
        renderHTML: (attributes) => ({
          'data-mention-updated-at': String(attributes.updatedAt ?? ''),
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-type="mention"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const name = String(HTMLAttributes['data-mention-name'] ?? HTMLAttributes.name ?? '')

    return [
      'span',
      {
        ...HTMLAttributes,
        'data-type': 'mention',
        class: 'norio-office-rich-mention-inline',
      },
      `@${name}`,
    ]
  },

  renderText({ node }) {
    return `@${String(node.attrs.name ?? '')}`
  },

  addNodeView() {
    return VueNodeViewRenderer(MentionInlineView)
  },
})
