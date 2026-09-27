export const RICH_TEXT_EDITOR_FEATURE_CODES = {
  comments: 'comments',
  outlineLeft: 'outlineLeft',
  outlineRight: 'outlineRight',
  watermark: 'watermark',
  collaboration: 'collaboration',
  mention: 'mention',
} as const

export type RichTextEditorFeatureCode =
  (typeof RICH_TEXT_EDITOR_FEATURE_CODES)[keyof typeof RICH_TEXT_EDITOR_FEATURE_CODES]

export type RichTextEditorLegacyFeatureItemKey =
  | 'comments'
  | 'outline'
  | 'watermark'
  | 'collaboration'
  | 'mention'

export type RichTextEditorFeatureItemKey = RichTextEditorFeatureCode | RichTextEditorLegacyFeatureItemKey

export type RichTextEditorOutlinePlacement = 'left' | 'right'

export const RICH_TEXT_EDITOR_EXPORT_CODES = {
  pdf: 'pdf',
  html: 'html',
  image: 'image',
  print: 'print',
} as const

export type RichTextEditorExportItemKey =
  (typeof RICH_TEXT_EDITOR_EXPORT_CODES)[keyof typeof RICH_TEXT_EDITOR_EXPORT_CODES]

export const RICH_TEXT_EDITOR_INSERT_MENU_CODES = {
  image: 'image',
  video: 'video',
  table: 'table',
  localFile: 'local-file',
  columns: 'columns',
  highlightBlock: 'highlight-block',
  date: 'date',
  codeBlock: 'code-block',
  formula: 'formula',
  blockquote: 'blockquote',
  emoji: 'emoji',
  link: 'link',
  divider: 'divider',
  countdown: 'countdown',
  markdownImport: 'markdown-import',
} as const

export type RichTextEditorInsertMenuItemKey =
  (typeof RICH_TEXT_EDITOR_INSERT_MENU_CODES)[keyof typeof RICH_TEXT_EDITOR_INSERT_MENU_CODES]

export const RICH_TEXT_EDITOR_TOOLBAR_ACTION_CODES = {
  blockquote: 'blockquote',
} as const

export type RichTextEditorToolbarActionKey =
  (typeof RICH_TEXT_EDITOR_TOOLBAR_ACTION_CODES)[keyof typeof RICH_TEXT_EDITOR_TOOLBAR_ACTION_CODES]

export type RichTextEditorCode =
  | RichTextEditorFeatureItemKey
  | RichTextEditorExportItemKey
  | RichTextEditorInsertMenuItemKey
  | RichTextEditorToolbarActionKey

export function isRichTextCodeEnabled(code: string, codes?: readonly string[] | null) {
  if (!codes) {
    return true
  }

  return codes.includes(code)
}

export function isRichTextFeatureCodeEnabled(
  code: RichTextEditorFeatureItemKey,
  featureCodes?: readonly RichTextEditorCode[] | null,
) {
  return isRichTextCodeEnabled(code, featureCodes)
}

export function resolveRichTextOutlinePlacement(
  preferredPlacement: RichTextEditorOutlinePlacement,
  featureCodes?: readonly RichTextEditorCode[] | null,
): RichTextEditorOutlinePlacement | null {
  if (!featureCodes) {
    return preferredPlacement
  }

  const hasLegacyOutline = featureCodes.includes('outline')
  const canUseLeft = hasLegacyOutline || featureCodes.includes(RICH_TEXT_EDITOR_FEATURE_CODES.outlineLeft)
  const canUseRight = hasLegacyOutline || featureCodes.includes(RICH_TEXT_EDITOR_FEATURE_CODES.outlineRight)

  if (canUseLeft && canUseRight) {
    return preferredPlacement
  }

  if (canUseLeft) {
    return 'left'
  }

  if (canUseRight) {
    return 'right'
  }

  return null
}
