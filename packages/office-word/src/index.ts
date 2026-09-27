import OfficeColorIcon from './components/OfficeColorIcon.vue'
import OfficeIcon from './components/OfficeIcon.vue'
import RichTextEditor from './components/RichTextEditor.vue'
import RichTextOutline from './components/RichTextOutline.vue'
import ScrollArea from './components/ScrollArea.vue'
import './style.css'

export { OfficeColorIcon, OfficeIcon, RichTextEditor, RichTextOutline, ScrollArea }
export { colorIconNames, monoIconNames } from './icons'
export {
  isRichTextCodeEnabled,
  isRichTextFeatureCodeEnabled,
  RICH_TEXT_EDITOR_EXPORT_CODES,
  RICH_TEXT_EDITOR_FEATURE_CODES,
  RICH_TEXT_EDITOR_INSERT_MENU_CODES,
  RICH_TEXT_EDITOR_TOOLBAR_ACTION_CODES,
  resolveRichTextOutlinePlacement,
} from './feature-codes'
export type {
  RichTextEditorCode,
  RichTextEditorExportItemKey,
  RichTextEditorFeatureCode,
  RichTextEditorFeatureItemKey,
  RichTextEditorInsertMenuItemKey,
  RichTextEditorToolbarActionKey,
} from './feature-codes'
export type {
  OfficeColorIconProps,
  OfficeIconProps,
  RichTextEditorAlign,
  RichTextEditorCollaborationAwareness,
  RichTextEditorCollaborationDocument,
  RichTextEditorCollaborationOptions,
  RichTextEditorCollaborationProvider,
  RichTextEditorCollaborationUser,
  RichTextEditorCommentCreatePayload,
  RichTextEditorCommentDeletePayload,
  RichTextEditorCommentImage,
  RichTextEditorCommentItem,
  RichTextEditorCommentMentionItem,
  RichTextEditorCommentMentionProvider,
  RichTextEditorCommentMentionProviderPayload,
  RichTextEditorCommentReplyPayload,
  RichTextEditorCommentResolvePayload,
  RichTextEditorCommentSubmitPayload,
  RichTextEditorCommentThread,
  RichTextEditorCommentUpdatePayload,
  RichTextEditorCommentUser,
  RichTextEditorCollectedFilePayload,
  RichTextEditorFilePayload,
  RichTextEditorImageExportOptions,
  RichTextEditorImagePayload,
  RichTextEditorInstance,
  RichTextEditorLocalFilePayload,
  RichTextEditorMessages,
  RichTextEditorMentionItem,
  RichTextEditorMentionProvider,
  RichTextEditorMentionProviderPayload,
  RichTextEditorMentionType,
  RichTextEditorOutlineChangeHandler,
  RichTextEditorOutlineItem,
  RichTextEditorOutlineState,
  RichTextEditorProps,
  RichTextEditorUploadHook,
  RichTextEditorUploadErrorHandler,
  RichTextEditorUploadErrorPayload,
  RichTextEditorUploadInput,
  RichTextEditorUploadKind,
  RichTextEditorUploadResult,
  RichTextEditorWatermarkOptions,
  RichTextEditorVideoPayload,
} from './types'
export default RichTextEditor
