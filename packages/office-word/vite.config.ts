import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    vue(),
    dts({
      entryRoot: 'src',
      include: ['src']
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'NorioOfficeRichText',
      cssFileName: 'style',
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.umd.cjs'),
      formats: ['es', 'umd']
    },
    rollupOptions: {
      external: (id) => {
        return id === 'vue'
          || id.startsWith('vue/')
          || id === 'lowlight'
          || id.startsWith('@tiptap/')
      },
      output: {
        exports: 'named',
        globals: {
          vue: 'Vue',
          '@tiptap/core': 'TiptapCore',
          '@tiptap/vue-3/menus': 'TiptapVue3Menus',
          '@tiptap/pm': 'TiptapPM',
          '@tiptap/pm/model': 'TiptapPMModel',
          '@tiptap/pm/state': 'TiptapPMState',
          '@tiptap/pm/tables': 'TiptapPMTables',
          '@tiptap/extension-collaboration': 'TiptapExtensionCollaboration',
          '@tiptap/extension-collaboration-caret': 'TiptapExtensionCollaborationCaret',
          '@tiptap/extension-code-block-lowlight': 'TiptapExtensionCodeBlockLowlight',
          '@tiptap/extension-font-family': 'TiptapExtensionFontFamily',
          '@tiptap/extension-horizontal-rule': 'TiptapExtensionHorizontalRule',
          '@tiptap/extension-placeholder': 'TiptapExtensionPlaceholder',
          '@tiptap/extension-subscript': 'TiptapExtensionSubscript',
          '@tiptap/extension-superscript': 'TiptapExtensionSuperscript',
          '@tiptap/extension-table': 'TiptapExtensionTable',
          '@tiptap/extension-table-cell': 'TiptapExtensionTableCell',
          '@tiptap/extension-table-header': 'TiptapExtensionTableHeader',
          '@tiptap/extension-table-row': 'TiptapExtensionTableRow',
          '@tiptap/extension-task-item': 'TiptapExtensionTaskItem',
          '@tiptap/extension-task-list': 'TiptapExtensionTaskList',
          '@tiptap/extension-text-style/font-size': 'TiptapExtensionTextStyleFontSize',
          '@tiptap/extension-text-style/background-color': 'TiptapExtensionTextStyleBackgroundColor',
          '@tiptap/extension-text-style/color': 'TiptapExtensionTextStyleColor',
          '@tiptap/extension-text-style/text-style': 'TiptapExtensionTextStyleTextStyle',
          '@tiptap/extension-text-style': 'TiptapExtensionTextStyle',
          '@tiptap/extension-underline': 'TiptapExtensionUnderline',
          '@tiptap/starter-kit': 'TiptapStarterKit',
          '@tiptap/vue-3': 'TiptapVue3',
          'lowlight': 'Lowlight',
        }
      }
    }
  }
})
