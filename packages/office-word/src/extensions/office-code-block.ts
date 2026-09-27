import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { common, createLowlight } from 'lowlight'

import OfficeCodeBlockView from '../components/OfficeCodeBlockView.vue'

const lowlight = createLowlight(common)

export const OfficeCodeBlock = CodeBlockLowlight.configure({
  lowlight,
}).extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      language: {
        default: 'plain_text',
        parseHTML: (element) => element.getAttribute('data-language') || 'plain_text',
        renderHTML: (attributes) => {
          const language = attributes.language || 'plain_text'
          return language === 'plain_text'
            ? { 'data-language': language }
            : {
                'data-language': language,
                class: `language-${language}`,
              }
        },
      },
      wrapLines: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-wrap-lines') === 'true',
        renderHTML: (attributes) => ({
          'data-wrap-lines': attributes.wrapLines ? 'true' : 'false',
        }),
      },
      darkTheme: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-dark-theme') === 'true',
        renderHTML: (attributes) => ({
          'data-dark-theme': attributes.darkTheme ? 'true' : 'false',
        }),
      },
      fixedHeight: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-fixed-height') === 'true',
        renderHTML: (attributes) => ({
          'data-fixed-height': attributes.fixedHeight ? 'true' : 'false',
        }),
      },
    }
  },

  addNodeView() {
    return VueNodeViewRenderer(OfficeCodeBlockView)
  },
})
