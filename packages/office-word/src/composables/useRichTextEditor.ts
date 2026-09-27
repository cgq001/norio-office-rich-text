import type { JSONContent } from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import FontFamily from '@tiptap/extension-font-family'
import FontSize from '@tiptap/extension-text-style/font-size'
import BackgroundColor from '@tiptap/extension-text-style/background-color'
import Color from '@tiptap/extension-text-style/color'
import { TextStyle } from '@tiptap/extension-text-style/text-style'
import BaseTableCell from '@tiptap/extension-table-cell'
import BaseTableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { useEditor } from '@tiptap/vue-3'
import { toRaw, unref, type Ref } from 'vue'

import { Indent } from '../extensions/indent'
import { ColumnsBlock } from '../extensions/columns-block'
import { ColumnsColumn } from '../extensions/columns-column'
import { CommentMark } from '../extensions/comment-mark'
import { CountdownBlock } from '../extensions/countdown-block'
import { FormulaBlock } from '../extensions/formula-block'
import { ImageBlock } from '../extensions/image-block'
import { LinkBlock } from '../extensions/link-block'
import { LocalFileBlock } from '../extensions/local-file-block'
import { Mention } from '../extensions/mention'
import { OfficeCodeBlock } from '../extensions/office-code-block'
import { QuoteStyle } from '../extensions/quote-style'
import { TextAlign } from '../extensions/text-align'
import { ThemedTable } from '../extensions/themed-table'
import { StyledHorizontalRule } from '../extensions/styled-horizontal-rule'
import { HighlightBlock } from '../extensions/highlight-block'
import { VideoBlock } from '../extensions/video-block'
import type {
  RichTextEditorCollaborationOptions,
  RichTextEditorLocalFilePayload,
  RichTextEditorMentionItem,
  RichTextEditorUploadErrorHandler,
  RichTextEditorUploadHook,
} from '../types'

type UseRichTextEditorOptions = {
  content: JSONContent
  editable: boolean
  placeholder: string
  collaboration?: RichTextEditorCollaborationOptions | null
  uploadImage?: RichTextEditorUploadHook | Ref<RichTextEditorUploadHook | null | undefined> | null
  uploadVideo?: RichTextEditorUploadHook | Ref<RichTextEditorUploadHook | null | undefined> | null
  onUploadError?: RichTextEditorUploadErrorHandler | Ref<RichTextEditorUploadErrorHandler | null | undefined> | null
  mention?: boolean | Ref<boolean | undefined> | null
  onLocalFileClick?: (payload: RichTextEditorLocalFilePayload) => void
  onLocalFileDownload?: (payload: { url: string; name: string; size?: number; mimeType?: string }) => void
  onMentionClick?: (payload: RichTextEditorMentionItem) => void
  onMentionTrigger?: () => void
  onMentionKeyDown?: (event: KeyboardEvent) => boolean
  onUpdate: (value: JSONContent) => void
}

const TableCell = BaseTableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-cell-background') || element.style.backgroundColor || null,
        renderHTML: (attributes) => {
          if (!attributes.backgroundColor) {
            return {}
          }

          return {
            'data-cell-background': attributes.backgroundColor,
            style: `background-color: ${attributes.backgroundColor};`,
          }
        },
      },
    }
  },
})

const TableHeader = BaseTableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-cell-background') || element.style.backgroundColor || null,
        renderHTML: (attributes) => {
          if (!attributes.backgroundColor) {
            return {}
          }

          return {
            'data-cell-background': attributes.backgroundColor,
            style: `background-color: ${attributes.backgroundColor};`,
          }
        },
      },
    }
  },
})

export function useRichTextEditor(options: UseRichTextEditorOptions) {
  const collaborationOptions = options.collaboration ? toRaw(options.collaboration) : null
  const collaborationDocument = collaborationOptions?.document ? toRaw(collaborationOptions.document) : null
  const collaborationField = collaborationOptions?.field?.trim() || 'content'
  const collaborationFragment = collaborationDocument?.getXmlFragment(collaborationField)
  const collaborationProvider = collaborationOptions?.provider ? toRaw(collaborationOptions.provider) : null
  const collaborationUser = collaborationOptions?.user ? toRaw(collaborationOptions.user) : null
  const collaborationInitialContent = collaborationOptions?.initialContent ?? null
  const shouldInitializeCollaborationContent = !!collaborationOptions?.initializeContent && !!collaborationInitialContent
  const isMentionEnabled = () => !!unref(options.mention)

  return useEditor({
    content: collaborationOptions ? undefined : options.content,
    editable: options.editable,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        dropcursor: {
          color: false,
          width: 2,
          class: 'ProseMirror-dropcursor norio-office-rich-dropcursor',
        },
        horizontalRule: false,
        underline: false,
        undoRedo: collaborationOptions ? false : undefined,
      }),
      ...(collaborationFragment
        ? [
            Collaboration.configure({
              fragment: collaborationFragment as never,
            }),
          ]
        : []),
      ...(collaborationFragment && collaborationProvider && collaborationUser
        ? [
            CollaborationCaret.configure({
              provider: collaborationProvider,
              user: collaborationUser,
            }),
          ]
        : []),
      ThemedTable.configure({
        resizable: true,
        allowTableNodeSelection: true,
        cellMinWidth: 70,
      }),
      TableRow,
      TableHeader,
      TableCell,
      StyledHorizontalRule,
      CommentMark,
      Indent,
      ColumnsBlock,
      ColumnsColumn,
      CountdownBlock,
      FormulaBlock,
      ImageBlock.configure({
        uploadImage: (payload) => {
          const uploadImage = unref(options.uploadImage)
          if (!uploadImage) {
            throw new Error('Missing uploadImage hook.')
          }

          return uploadImage(payload)
        },
        onUploadError: (payload) => {
          unref(options.onUploadError)?.(payload)
        },
      }),
      LinkBlock,
      LocalFileBlock.configure({
        onClick: options.onLocalFileClick ?? null,
        onDownload: options.onLocalFileDownload ?? null,
      }),
      Mention.configure({
        onClick: (payload: RichTextEditorMentionItem) => {
          if (isMentionEnabled()) {
            options.onMentionClick?.(payload)
          }
        },
      }),
      VideoBlock.configure({
        uploadVideo: (payload) => {
          const uploadVideo = unref(options.uploadVideo)
          if (!uploadVideo) {
            throw new Error('Missing uploadVideo hook.')
          }

          return uploadVideo(payload)
        },
        onUploadError: (payload) => {
          unref(options.onUploadError)?.(payload)
        },
      }),
      OfficeCodeBlock,
      HighlightBlock,
      TextStyle,
      FontFamily,
      FontSize,
      BackgroundColor,
      Color,
      Superscript,
      Subscript,
      TaskList,
      TaskItem.configure({
        nested: false,
      }),
      Underline,
      QuoteStyle,
      TextAlign,
      Placeholder.configure({
        placeholder: options.placeholder
      })
    ],
    editorProps: {
      attributes: {
        class: 'norio-office-rich-prosemirror'
      },
      handleKeyDown: (_view, event) => {
        if (isMentionEnabled() && options.onMentionKeyDown?.(event)) {
          return true
        }

        if (isMentionEnabled() && event.key === '@') {
          window.setTimeout(() => {
            options.onMentionTrigger?.()
          })
        }

        return false
      },
      handleTextInput: (_view, _from, _to, text) => {
        if (isMentionEnabled() && text.includes('@')) {
          window.setTimeout(() => {
            options.onMentionTrigger?.()
          })
        }

        return false
      },
    },
    onCreate: ({ editor }) => {
      if (!collaborationFragment || !shouldInitializeCollaborationContent) {
        return
      }

      const fragmentLength =
        typeof collaborationFragment === 'object'
        && collaborationFragment !== null
        && 'length' in collaborationFragment
        && typeof collaborationFragment.length === 'number'
          ? collaborationFragment.length
          : null

      if (fragmentLength !== 0) {
        return
      }

      editor.commands.setContent(collaborationInitialContent, { emitUpdate: false })
    },
    onUpdate: ({ editor }) => {
      options.onUpdate(editor.getJSON())
    }
  })
}
