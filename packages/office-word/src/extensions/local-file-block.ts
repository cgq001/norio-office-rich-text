import { Node } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'

import LocalFileBlockView from '../components/LocalFileBlockView.vue'
import type { RichTextEditorLocalFilePayload } from '../types'

export const LocalFileBlock = Node.create({
  name: 'localFileBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return {
      onClick: null as ((payload: RichTextEditorLocalFilePayload) => void) | null,
      onDownload: null as ((payload: RichTextEditorLocalFilePayload) => void) | null,
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
			url: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-url') || '',
        renderHTML: (attributes) => ({
          'data-url': String(attributes.url ?? ''),
        }),
      },
      name: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-name') || '',
        renderHTML: (attributes) => ({
          'data-name': String(attributes.name ?? ''),
        }),
      },
      size: {
        default: 0,
        parseHTML: (element) => Number.parseInt(element.getAttribute('data-size') ?? '0', 10) || 0,
        renderHTML: (attributes) => ({
          'data-size': String(attributes.size ?? 0),
        }),
      },
      mimeType: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-mime-type') || '',
        renderHTML: (attributes) => ({
          'data-mime-type': String(attributes.mimeType ?? ''),
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="local-file-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-type': 'local-file-block' }]
  },

  addNodeView() {
    return VueNodeViewRenderer(LocalFileBlockView)
  },
})
