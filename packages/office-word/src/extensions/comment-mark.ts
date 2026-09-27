import { Mark } from '@tiptap/core'

export const CommentMark = Mark.create({
  name: 'commentMark',

  inclusive: false,

  addAttributes() {
    return {
      threadId: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-comment-thread-id') || '',
        renderHTML: (attributes) => ({
          'data-comment-thread-id': String(attributes.threadId ?? ''),
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-comment-thread-id]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      {
        ...HTMLAttributes,
        class: 'norio-office-rich-comment-mark',
      },
      0,
    ]
  },
})
