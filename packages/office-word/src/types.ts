import type { JSONContent } from '@tiptap/core'
import type {
  RichTextEditorExportItemKey,
  RichTextEditorCode,
  RichTextEditorFeatureCode,
  RichTextEditorFeatureItemKey,
  RichTextEditorInsertMenuItemKey,
  RichTextEditorOutlinePlacement,
  RichTextEditorToolbarActionKey,
} from './feature-codes'

export type {
  RichTextEditorExportItemKey,
  RichTextEditorCode,
  RichTextEditorFeatureCode,
  RichTextEditorFeatureItemKey,
  RichTextEditorInsertMenuItemKey,
  RichTextEditorOutlinePlacement,
  RichTextEditorToolbarActionKey,
} from './feature-codes'

export type RichTextEditorProps = {
  modelValue?: JSONContent | null
  documentName?: string
  mode?: 'edit' | 'preview'
  showToolbar?: boolean
  watermark?: RichTextEditorWatermarkOptions | null
  showOutline?: boolean
  outlinePlacement?: RichTextEditorOutlinePlacement
  messages?: RichTextEditorMessages | null
  featureCodes?: RichTextEditorCode[] | null
  enabledFeatureItems?: RichTextEditorFeatureItemKey[] | null
  enabledExportItems?: RichTextEditorExportItemKey[] | null
  enabledInsertMenuItems?: RichTextEditorInsertMenuItemKey[] | null
  enabledToolbarActions?: RichTextEditorToolbarActionKey[] | null
  placeholder?: string
  mention?: boolean
  collaboration?: RichTextEditorCollaborationOptions | null
  comments?: RichTextEditorCommentThread[] | null
  commentUser?: RichTextEditorCommentUser | null
  showComments?: boolean
  commentMention?: boolean
  uploadImage?: RichTextEditorUploadHook | null
  uploadVideo?: RichTextEditorUploadHook | null
  uploadFile?: RichTextEditorUploadHook | null
  uploadCommentImage?: RichTextEditorUploadHook | null
  onUploadError?: RichTextEditorUploadErrorHandler | null
  commentMentionProvider?: RichTextEditorCommentMentionProvider | null
  onCommentMentionSearch?: RichTextEditorCommentMentionProvider | null
  mentionProvider?: RichTextEditorMentionProvider | null
  onMentionSearch?: RichTextEditorMentionProvider | null
}

export type RichTextEditorMessages = Partial<Record<string, string>>

export type RichTextEditorWatermarkOptions = {
  text: string
  color?: string
  fontSize?: number
  rotate?: number
  showInEdit?: boolean
}

export type RichTextEditorCollaborationDocument = {
  getXmlFragment: (field: string) => unknown
}

export type RichTextEditorCollaborationAwareness = {
  states: Map<number, unknown>
  on: (event: 'update', callback: (...args: unknown[]) => void) => void
  setLocalStateField: (field: string, value: unknown) => void
}

export type RichTextEditorCollaborationProvider = {
  doc?: unknown
  awareness: RichTextEditorCollaborationAwareness
}

export type RichTextEditorCollaborationUser = {
  name: string
  color: string
  [key: string]: unknown
}

export type RichTextEditorCollaborationOptions = {
  document: RichTextEditorCollaborationDocument
  field?: string
  provider?: RichTextEditorCollaborationProvider | null
  user?: RichTextEditorCollaborationUser | null
  initializeContent?: boolean
  initialContent?: JSONContent | null
}

export type RichTextEditorMentionType = 1 | 2

export type RichTextEditorMentionItem = {
  id: string
  name: string
  type: RichTextEditorMentionType
  avatar?: string
  icon?: string
  tag?: string
  updatedAt?: string
  [key: string]: unknown
}

export type RichTextEditorMentionProviderPayload = {
  query: string
  type?: RichTextEditorMentionType | 'all'
}

export type RichTextEditorMentionProvider = (
  payload: RichTextEditorMentionProviderPayload,
) => RichTextEditorMentionItem[] | Promise<RichTextEditorMentionItem[]>

export type RichTextEditorAlign = 'left' | 'center' | 'right'

export type RichTextEditorUploadKind = 'image' | 'video' | 'file'

export type RichTextEditorUploadInput = {
  file: File
  kind: RichTextEditorUploadKind
}

export type RichTextEditorUploadResult = {
	assetId?: string
	url: string
  name?: string
  size?: number
  mimeType?: string
  alt?: string
  description?: string
}

export type RichTextEditorUploadHook = (
  payload: RichTextEditorUploadInput,
) => RichTextEditorUploadResult | Promise<RichTextEditorUploadResult>

export type RichTextEditorUploadErrorPayload = {
  kind: RichTextEditorUploadKind
  fileName: string
  error: unknown
}

export type RichTextEditorUploadErrorHandler = (payload: RichTextEditorUploadErrorPayload) => void

export type RichTextEditorCommentUser = {
  id: string
  name: string
  avatar?: string
  color?: string
  [key: string]: unknown
}

export type RichTextEditorCommentImage = RichTextEditorUploadResult

export type RichTextEditorCommentMentionItem = RichTextEditorMentionItem

export type RichTextEditorCommentMentionProviderPayload = RichTextEditorMentionProviderPayload & {
  threadId?: string
  commentId?: string
  parentId?: string
  content: string
}

export type RichTextEditorCommentMentionProvider = (
  payload: RichTextEditorCommentMentionProviderPayload,
) => RichTextEditorCommentMentionItem[] | Promise<RichTextEditorCommentMentionItem[]>

export type RichTextEditorCommentItem = {
  id: string
  parentId?: string
  content: string
  author: RichTextEditorCommentUser
  createdAt: string
  updatedAt?: string
  images?: RichTextEditorCommentImage[]
  mentions?: RichTextEditorCommentMentionItem[]
}

export type RichTextEditorCommentThread = {
  id: string
  anchorText?: string
  status?: 'open' | 'resolved'
  comments: RichTextEditorCommentItem[]
}

export type RichTextEditorCommentCreatePayload = {
  threadId: string
  commentId: string
  anchorText: string
  content: string
  images: RichTextEditorCommentImage[]
  mentions: RichTextEditorCommentMentionItem[]
  author: RichTextEditorCommentUser
  createdAt: string
}

export type RichTextEditorCommentReplyPayload = {
  threadId: string
  commentId: string
  parentId?: string
  targetCommentId?: string
  targetUserId?: string
  targetUserName?: string
  content: string
  images: RichTextEditorCommentImage[]
  mentions: RichTextEditorCommentMentionItem[]
  author: RichTextEditorCommentUser
  createdAt: string
}

export type RichTextEditorCommentUpdatePayload = {
  threadId: string
  commentId: string
  content: string
  images?: RichTextEditorCommentImage[]
  mentions: RichTextEditorCommentMentionItem[]
  author?: RichTextEditorCommentUser
  updatedAt: string
}

export type RichTextEditorCommentSubmitPayload = {
  action: 'create' | 'reply' | 'update'
  threadId: string
  commentId: string
  targetCommentId?: string
  targetUserId?: string
  targetUserName?: string
  content: string
  images?: RichTextEditorCommentImage[]
  mentions: RichTextEditorCommentMentionItem[]
  author?: RichTextEditorCommentUser
  createdAt?: string
  updatedAt?: string
}

export type RichTextEditorCommentDeletePayload = {
  threadId: string
  commentId?: string
}

export type RichTextEditorCommentResolvePayload = {
  threadId: string
  resolved: boolean
}

export type RichTextEditorImagePayload = {
	assetId?: string
	src: string
  alt?: string
  name?: string
  description?: string
  descriptionVisible?: boolean
  link?: string
  linkTarget?: '_blank' | '_self'
  rotation?: number
}

export type RichTextEditorVideoPayload = {
	assetId?: string
	src: string
  name?: string
  description?: string
  mimeType?: string
  align?: RichTextEditorAlign
  widthPercent?: number
  height?: number
}

export type RichTextEditorFilePayload = {
	assetId?: string
	url: string
  name: string
  displayMode?: 'text' | 'card' | 'preview'
  align?: RichTextEditorAlign
  widthPercent?: number
  height?: number
}

export type RichTextEditorLocalFilePayload = {
	assetId?: string
	url: string
  name: string
  size?: number
  mimeType?: string
}

export type RichTextEditorCollectedFilePayload =
  | ({ kind: 'file' } & RichTextEditorFilePayload)
  | ({ kind: 'local-file' } & RichTextEditorLocalFilePayload)

export type RichTextEditorImageExportOptions = {
  type?: 'image/png' | 'image/jpeg'
  quality?: number
}

export type RichTextEditorOutlineItem = {
  pos: number
  level: number
  text: string
}

export type RichTextEditorOutlineState = {
  items: RichTextEditorOutlineItem[]
  activePos: number | null
}

export type RichTextEditorOutlineChangeHandler = (state: RichTextEditorOutlineState) => void

export type RichTextEditorInstance = {
  exportPdf: () => Promise<Blob | null>
  exportImage: (options?: RichTextEditorImageExportOptions) => Promise<Blob | null>
  exportHtml: () => string | null
  insertImage: (payload: RichTextEditorImagePayload | RichTextEditorImagePayload[]) => boolean
  insertVideo: (payload: RichTextEditorVideoPayload) => boolean
  insertFile: (payload: RichTextEditorFilePayload) => boolean
  insertLocalFile: (payload: RichTextEditorLocalFilePayload) => boolean
  insertMention: (payload: RichTextEditorMentionItem) => boolean
  openLocalFilePicker: () => void
  focus: () => void
  getJSON: () => JSONContent | null
  getText: () => string
  getImages: () => RichTextEditorImagePayload[]
  getVideos: () => RichTextEditorVideoPayload[]
  getFiles: () => RichTextEditorCollectedFilePayload[]
  getOutlineItems: () => RichTextEditorOutlineItem[]
  getActiveOutlinePos: () => number | null
  focusOutlineItem: (pos: number) => boolean
  onOutlineChange: (handler: RichTextEditorOutlineChangeHandler) => () => void
  focusCommentThread: (threadId: string) => boolean
}

export type OfficeIconProps = {
  name: string
  size?: number | string
  color?: string
  backgroundColor?: string
}

export type OfficeColorIconProps = {
  name: string
  size?: number | string
  backgroundColor?: string
}
