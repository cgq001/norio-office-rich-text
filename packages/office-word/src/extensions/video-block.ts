import { Node } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'

import VideoBlockView from '../components/VideoBlockView.vue'
import type { RichTextEditorUploadErrorHandler, RichTextEditorUploadHook } from '../types'

type VideoBlockOptions = {
  uploadVideo: RichTextEditorUploadHook | null
  onUploadError: RichTextEditorUploadErrorHandler | null
}

export const VideoBlock = Node.create<VideoBlockOptions>({
  name: 'videoBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return {
      uploadVideo: null,
      onUploadError: null,
    }
  },

	addAttributes() {
		return {
			assetId: {
				default: '',
				parseHTML: (element) => element.getAttribute('data-asset-id') || '',
				renderHTML: (attributes) => ({
					'data-asset-id': String(attributes.assetId ?? ''),
				}),
			},
			src: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-src') || '',
        renderHTML: (attributes) => ({
          'data-src': String(attributes.src ?? ''),
        }),
      },
      name: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-name') || '',
        renderHTML: (attributes) => ({
          'data-name': String(attributes.name ?? ''),
        }),
      },
      description: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-description') || '',
        renderHTML: (attributes) => ({
          'data-description': String(attributes.description ?? ''),
        }),
      },
      mimeType: {
        default: 'video/mp4',
        parseHTML: (element) => element.getAttribute('data-mime-type') || 'video/mp4',
        renderHTML: (attributes) => ({
          'data-mime-type': String(attributes.mimeType ?? 'video/mp4'),
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
        default: 220,
        parseHTML: (element) => Number.parseInt(element.getAttribute('data-height') ?? '220', 10) || 220,
        renderHTML: (attributes) => ({
          'data-height': String(attributes.height ?? 220),
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="video-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-type': 'video-block' }]
  },

  addNodeView() {
    return VueNodeViewRenderer(VideoBlockView)
  },
})
