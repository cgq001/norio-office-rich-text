import { Node } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'

import ImageBlockView from '../components/ImageBlockView.vue'
import type { RichTextEditorUploadErrorHandler, RichTextEditorUploadHook } from '../types'

type ImageBlockOptions = {
  uploadImage: RichTextEditorUploadHook | null
  onUploadError: RichTextEditorUploadErrorHandler | null
}

export const ImageBlock = Node.create<ImageBlockOptions>({
  name: 'imageBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return {
      uploadImage: null,
      onUploadError: null,
    }
  },

  addAttributes() {
    return {
      images: {
        default: [],
        parseHTML: (element) => {
          const raw = element.getAttribute('data-images')
          if (!raw) {
            return []
          }

          try {
            return JSON.parse(decodeURIComponent(raw))
          } catch {
            return []
          }
        },
        renderHTML: (attributes) => ({
          'data-images': encodeURIComponent(JSON.stringify(attributes.images ?? [])),
        }),
      },
      widthPercent: {
        default: 100,
        parseHTML: (element) => Number.parseInt(element.getAttribute('data-width-percent') ?? '100', 10) || 100,
        renderHTML: (attributes) => ({
          'data-width-percent': String(attributes.widthPercent ?? 100),
        }),
      },
      align: {
        default: 'left',
        parseHTML: (element) => element.getAttribute('data-align') || 'left',
        renderHTML: (attributes) => ({
          'data-align': String(attributes.align ?? 'left'),
        }),
      },
      height: {
        default: 146,
        parseHTML: (element) => Number.parseInt(element.getAttribute('data-height') ?? '146', 10) || 146,
        renderHTML: (attributes) => ({
          'data-height': String(attributes.height ?? 146),
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="image-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-type': 'image-block' }]
  },

  addNodeView() {
    return VueNodeViewRenderer(ImageBlockView)
  },
})
