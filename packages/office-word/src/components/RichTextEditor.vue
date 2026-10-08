<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRef, useId, watch, type ComponentPublicInstance } from 'vue'
import type { JSONContent } from '@tiptap/core'
import { EditorContent } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import { createTable } from '@tiptap/extension-table'
import { NodeSelection, TextSelection, type Transaction } from '@tiptap/pm/state'
import { Fragment, Slice, type Node as ProseMirrorNode } from '@tiptap/pm/model'
import { CellSelection, TableMap, findTable, selectionCell } from '@tiptap/pm/tables'

import ColorPalettePanel from './ColorPalettePanel.vue'
import BlockColorPanel, { type BlockColorKind } from './BlockColorPanel.vue'
import TextSelectionMenu, { type TextSelectionAction } from './TextSelectionMenu.vue'
import EmojiPickerPanel from './EmojiPickerPanel.vue'
import FormulaEditorDialog from './FormulaEditorDialog.vue'
import OfficeColorIcon from './OfficeColorIcon.vue'
import OfficeIcon from './OfficeIcon.vue'
import OutlinePanel from './OutlinePanel.vue'
import ScrollArea from './ScrollArea.vue'
import TableThemePanel from './TableThemePanel.vue'
import editorExportStyles from '../style.css?raw'
import katexExportStyles from 'katex/dist/katex.min.css?raw'
import { useRichTextEditor } from '../composables/useRichTextEditor'
import { isRichTextCodeEnabled, isRichTextFeatureCodeEnabled, resolveRichTextOutlinePlacement } from '../feature-codes'
import { defaultEditorMessages, resolveEditorMessages } from '../locales/editor'
import { getMentionAvatarStyle, getMentionAvatarText } from '../utils/mention'
import type {
  RichTextEditorExportItemKey,
  RichTextEditorInsertMenuItemKey,
  RichTextEditorToolbarActionKey,
} from '../feature-codes'
import type {
  RichTextEditorFilePayload,
  RichTextEditorCollectedFilePayload,
  RichTextEditorCommentCreatePayload,
  RichTextEditorCommentDeletePayload,
  RichTextEditorCommentImage,
  RichTextEditorCommentItem,
  RichTextEditorCommentMentionItem,
  RichTextEditorCommentMentionProviderPayload,
  RichTextEditorCommentReplyPayload,
  RichTextEditorCommentResolvePayload,
  RichTextEditorCommentSubmitPayload,
  RichTextEditorCommentThread,
  RichTextEditorCommentUpdatePayload,
  RichTextEditorCommentUser,
  RichTextEditorImageExportOptions,
  RichTextEditorImagePayload,
  RichTextEditorInstance,
  RichTextEditorLocalFilePayload,
  RichTextEditorMentionItem,
  RichTextEditorMentionProviderPayload,
  RichTextEditorMentionType,
  RichTextEditorOutlineChangeHandler,
  RichTextEditorOutlineItem,
  RichTextEditorOutlineState,
  RichTextEditorProps,
  RichTextEditorUploadErrorPayload,
  RichTextEditorUploadResult,
  RichTextEditorWatermarkOptions,
  RichTextEditorVideoPayload,
} from '../types'
import { parseMarkdownToContent } from '../utils/markdown-import'
import { normalizeTableTheme, type TableThemeColors } from '../utils/table-theme'
import { colorGrid, standardColors } from '../utils/color-palette'
import { dividerDefaultColor, dividerStyles, normalizeDividerColor, normalizeDividerStyle } from '../utils/divider'

const props = withDefaults(defineProps<RichTextEditorProps>(), {
  modelValue: null,
  documentName: '',
  editable: true,
  mode: 'edit',
  showToolbar: true,
  watermark: null,
  showOutline: true,
  outlinePlacement: 'right',
  messages: null,
  featureCodes: null,
  enabledFeatureItems: null,
  placeholder: '',
  mention: false,
  uploadImage: null,
  uploadVideo: null,
  uploadFile: null,
  uploadCommentImage: null,
  onUploadError: null,
  comments: null,
  commentUser: null,
  showComments: false,
  commentMention: true,
  commentMentionProvider: null,
  onCommentMentionSearch: null,
})

const emit = defineEmits<{
  'update:modelValue': [value: JSONContent]
  change: [value: JSONContent]
  'local-file-upload': [value: RichTextEditorLocalFilePayload]
  'local-file-click': [value: RichTextEditorLocalFilePayload]
  'local-file-download': [value: RichTextEditorLocalFilePayload]
  'upload-error': [value: RichTextEditorUploadErrorPayload]
  'mention-item-click': [value: RichTextEditorMentionItem]
  'mention-submit': [value: RichTextEditorMentionItem]
  'outline-change': [value: RichTextEditorOutlineState]
  'comment-create': [value: RichTextEditorCommentCreatePayload]
  'comment-reply': [value: RichTextEditorCommentReplyPayload]
  'comment-update': [value: RichTextEditorCommentUpdatePayload]
  'comment-delete': [value: RichTextEditorCommentDeletePayload]
  'comment-resolve': [value: RichTextEditorCommentResolvePayload]
  'comment-select': [value: RichTextEditorCommentThread]
  'comment-submit': [value: RichTextEditorCommentSubmitPayload]
  'comment-mention-search': [value: RichTextEditorCommentMentionProviderPayload]
  'comment-mention-item-click': [value: RichTextEditorCommentMentionItem]
  'comment-mention-submit': [value: RichTextEditorCommentMentionItem]
}>()

const uploadImageRef = toRef(props, 'uploadImage')
const uploadVideoRef = toRef(props, 'uploadVideo')
const uploadFileRef = toRef(props, 'uploadFile')
const uploadCommentImageRef = toRef(props, 'uploadCommentImage')
const uploadErrorRef = toRef(props, 'onUploadError')

type EditorUploadKind = 'image' | 'video' | 'file'
type EditorUploadTaskStatus = 'uploading' | 'error'

type EditorUploadTask = {
  id: string
  kind: EditorUploadKind
  fileName: string
  status: EditorUploadTaskStatus
  message?: string | undefined
  retry: () => void
}

type PendingCommentThread = {
  id: string
  anchorText: string
}

const rootRef = ref<HTMLElement | null>(null)
const pageRef = ref<HTMLElement | null>(null)
const commentPanelRef = ref<HTMLElement | null>(null)
const commentMentionPanelRef = ref<HTMLElement | null>(null)
const insertMenuRef = ref<HTMLElement | null>(null)
const insertMenuPanelRef = ref<HTMLElement | null>(null)
const slashMenuRef = ref<HTMLElement | null>(null)
const markdownImportInputRef = ref<HTMLInputElement | null>(null)
const localFileInputRef = ref<HTMLInputElement | null>(null)
const imageUploadInputRef = ref<HTMLInputElement | null>(null)
const videoUploadInputRef = ref<HTMLInputElement | null>(null)
const commentImageInputRef = ref<HTMLInputElement | null>(null)
const statusbarExportMenuRef = ref<HTMLElement | null>(null)
const emojiToolbarMenuRef = ref<HTMLElement | null>(null)
const columnsMenuItemRef = ref<HTMLElement | null>(null)
const countdownMenuItemRef = ref<HTMLElement | null>(null)
const insertMenuScrollTop = ref(0)
const countdownDateTriggerRef = ref<HTMLElement | null>(null)
const countdownPickerRef = ref<HTMLElement | null>(null)
const countdownBubbleMenuRef = ref<HTMLElement | null>(null)
const countdownBubbleEditButtonRef = ref<HTMLElement | null>(null)
const alignMenuRef = ref<HTMLElement | null>(null)
const blockSideMenuRef = ref<HTMLElement | null>(null)
const blockSideSurfaceBorderTriggerRef = ref<HTMLElement | null>(null)
const blockSideSurfaceFillTriggerRef = ref<HTMLElement | null>(null)
const blockSideHighlightSettingsTriggerRef = ref<HTMLElement | null>(null)
const tableActionColorMenuRef = ref<HTMLElement | null>(null)
const tableThemeMenuRef = ref<HTMLElement | null>(null)
const blockSideTableThemeTriggerRef = ref<HTMLElement | null>(null)
const blockSideDividerStyleTriggerRef = ref<HTMLElement | null>(null)
const blockSideDividerColorTriggerRef = ref<HTMLElement | null>(null)
const headingMenuRef = ref<HTMLElement | null>(null)
const fontFamilyMenuRef = ref<HTMLElement | null>(null)
const scriptMenuRef = ref<HTMLElement | null>(null)
const fontSizeMenuRef = ref<HTMLElement | null>(null)
const colorMenuRef = ref<HTMLElement | null>(null)
const blockSidePropertiesTriggerRef = ref<HTMLElement | null>(null)
const blockSideColorTriggerRef = ref<HTMLElement | null>(null)
const blockSideCustomColorTriggerRef = ref<HTMLElement | null>(null)
const highlightMenuRef = ref<HTMLElement | null>(null)
const quoteMenuRef = ref<HTMLElement | null>(null)
const mentionPanelRef = ref<HTMLElement | null>(null)
const isFullscreen = ref(false)
const isPresentationMode = ref(false)
const isOutlineOpen = ref(false)
const outlineTriggerRef = ref<HTMLButtonElement | null>(null)
const outlinePanelId = `norio-office-rich-outline-${useId()}`
const viewportWidth = ref(typeof window === 'undefined' ? 780 : window.innerWidth)
const viewportHeight = ref(typeof window === 'undefined' ? 900 : window.innerHeight)
const isInsertMenuOpen = ref(false)
const slashQuery = ref<string | null>(null)
const slashRange = ref<{ from: number; to: number } | null>(null)
const isSlashEmojiPickerOpen = ref(false)
const slashDismissedAt = ref<string | null>(null)
const selectedSlashIndex = ref(0)
const slashMenuPosition = ref({ left: 8, top: 8, maxHeight: 320 })
const isAlignMenuOpen = ref(false)
const isTableActionColorMenuOpen = ref(false)
const isTableThemeMenuOpen = ref(false)
const tableThemeMenuHeight = ref(360)
const tableThemeMenuViewportVersion = ref(0)
const isHeadingMenuOpen = ref(false)
const isFontFamilyMenuOpen = ref(false)
const isScriptMenuOpen = ref(false)
const isFontSizeMenuOpen = ref(false)
const isColorMenuOpen = ref(false)
const isHighlightMenuOpen = ref(false)
const isQuoteMenuOpen = ref(false)
const isExportMenuOpen = ref(false)
const isEmojiToolbarMenuOpen = ref(false)
const isMentionPanelOpen = ref(false)
const isMentionLoading = ref(false)
const mentionQuery = ref('')
const mentionActiveType = ref<RichTextEditorMentionType | 'all'>('all')
const mentionItems = ref<RichTextEditorMentionItem[]>([])
const selectedMentionIndex = ref(0)
const mentionRange = ref<{ from: number; to: number } | null>(null)
const mentionPanelPosition = ref({ left: 0, top: 0 })
const pendingMediaInsertRange = ref<{ from: number; to: number } | null>(null)
const uploadTasks = ref<EditorUploadTask[]>([])
const selectedCommentThreadId = ref<string | null>(null)
const commentDrafts = ref<Record<string, string>>({})
const commentImageDrafts = ref<Record<string, RichTextEditorCommentImage[]>>({})
const commentMentionDrafts = ref<Record<string, RichTextEditorCommentMentionItem[]>>({})
const editingCommentKey = ref<string | null>(null)
const editingCommentDraft = ref('')
const editingCommentMentions = ref<RichTextEditorCommentMentionItem[]>([])
const pendingCommentImageTarget = ref<string | null>(null)
const pendingCommentThread = ref<PendingCommentThread | null>(null)
const previewCommentImage = ref<RichTextEditorCommentImage | null>(null)
const commentReplyTargets = ref<Record<string, string>>({})
const commentCardElements = new Map<string, HTMLElement>()
const isCommentMentionPanelOpen = ref(false)
const isCommentMentionLoading = ref(false)
const commentMentionQuery = ref('')
const commentMentionActiveType = ref<RichTextEditorMentionType | 'all'>('all')
const commentMentionItems = ref<RichTextEditorCommentMentionItem[]>([])
const selectedCommentMentionIndex = ref(0)
const commentMentionPanelPosition = ref({ left: 0, top: 0 })
const commentMentionContext = ref<{
  mode: 'draft' | 'edit'
  threadId: string
  parentId?: string
  commentId?: string
  textarea: HTMLTextAreaElement
  range: { from: number; to: number; query: string }
} | null>(null)
const selectionStateVersion = ref(0)
const exportingType = ref<'pdf' | 'image' | 'html' | 'print' | null>(null)
const zoom = ref(100)
const pageBaseWidth = 1060
const pageBaseHeight = 1120
const mentionPanelWidth = 360
const mentionPanelHeight = 420
const mentionPanelViewportMargin = 8
const mentionPanelTriggerGap = 4
type HeadingOption = {
  key: string
  label: string
  level?: 1 | 2 | 3 | 4 | 5 | 6
}

const headingOptions: HeadingOption[] = [
  { key: 'paragraph', label: '正文' },
  { key: 'h1', label: '标题一', level: 1 },
  { key: 'h2', label: '标题二', level: 2 },
  { key: 'h3', label: '标题三', level: 3 },
  { key: 'h4', label: '标题四', level: 4 },
  { key: 'h5', label: '标题五', level: 5 },
  { key: 'h6', label: '标题六', level: 6 },
]

type FontSizeOption = {
  label: string
  value: string
}

type FontFamilyOption = {
  label: string
  value: string
}

type InsertQuickItem = {
  key: string
  label: string
  type: 'text' | 'icon'
  iconName?: string
  action: string
}

type InsertMenuItem = {
  key: RichTextEditorInsertMenuItemKey
  label: string
  colorIconName?: string
  monoIconName?: string
  action: string
  comingSoon?: boolean
}

type ExportMenuItem = {
  key: RichTextEditorExportItemKey
  label: string
  iconName: string
  loadingLabel: string
  onClick: () => void
}

type MarqueePoint = {
  x: number
  y: number
}

type MarqueeRect = {
  left: number
  top: number
  width: number
  height: number
}

type MarqueeTopLevelBlock = {
  pos: number
  from: number
  to: number
  node: ProseMirrorNode
  dom: HTMLElement
  rect: MarqueeRect
}

type DragInsertIndicator = {
  left: number
  top: number
  width: number
  range: {
    from: number
    to: number
  }
}

type BlockSideMenuMode = 'insert' | 'actions' | 'transform' | 'add-above' | 'add-below'
type BlockSideSubmenuMode = 'properties' | 'add-above' | 'add-below' | 'color' | 'table-theme' | 'divider-style' | 'divider-color' | 'highlight-border' | 'highlight-fill' | 'highlight-settings' | 'quote-border' | 'quote-background'
const blockSideSurfaceColorModes = ['highlight-border', 'highlight-fill', 'quote-border', 'quote-background']
const blockSideStackedMenuModes = ['properties', 'color', 'add-above', 'add-below', ...blockSideSurfaceColorModes]

type BlockSideControl = MarqueeTopLevelBlock & {
  isEmpty: boolean
  iconName?: string
  textIcon?: string
  label: string
}

type BlockClipboardPayload = {
  json?: JSONContent[]
  html: string
  text: string
}

const blockClipboardMime = 'application/x-office-word-blocks+json'

type BlockDragState = {
  from: number
  to: number
  content: JSONContent
}

type BlockDragGhost = {
  html: string
  left: number
  top: number
  width: number
  height: number
  sourceWidth: number
  sourceHeight: number
  scale: number
  offsetX: number
  offsetY: number
}

type ImageBlockItem = {
	id: string
	assetId?: string
  src?: string
  alt?: string
  name?: string
  description?: string
  descriptionVisible?: boolean
  link?: string
  linkTarget?: '_blank' | '_self'
  rotation?: number
}

type MentionTab = {
  key: RichTextEditorMentionType | 'all'
  label: string
}

const tableGridRows = 8
const tableGridCols = 10
const columnGridCount = 4
const mentionTabs: MentionTab[] = [
  { key: 'all', label: '全部' },
  { key: 1, label: '人' },
  { key: 2, label: '文档' },
]
const activeInsertSubmenu = ref<string | null>(null)
const isFormulaDialogOpen = ref(false)
const formulaDraft = ref('')
const hoveredTableRows = ref(0)
const hoveredTableCols = ref(0)
const hoveredColumnsCount = ref(0)
const countdownInsertMode = ref<'deadline' | 'duration'>('deadline')
const countdownDeadlineInput = ref('')
const countdownDurationDays = ref('0')
const countdownDurationHours = ref('0')
const countdownDurationMinutes = ref('1')
const countdownDurationSeconds = ref('0')
const isCountdownDeadlinePickerOpen = ref(false)
const isCountdownBlockEditOpen = ref(false)
const countdownPickerPlacement = ref<'top' | 'bottom'>('bottom')
const countdownCalendarYear = ref(new Date().getFullYear())
const countdownCalendarMonth = ref(new Date().getMonth())
const countdownTimeInput = ref('00:00')
const countdownWeekdayLabels = ['一', '二', '三', '四', '五', '六', '日']
const tablePreviewLabel = computed(() =>
  hoveredTableRows.value > 0 && hoveredTableCols.value > 0 ? `${hoveredTableRows.value} x ${hoveredTableCols.value}` : '插入表格',
)
const columnsPreviewLabel = computed(() => `选择${hoveredColumnsCount.value}栏`)
const columnsSubmenuLabel = computed(() => (hoveredColumnsCount.value > 0 ? `选择${hoveredColumnsCount.value}栏` : '选择栏数'))
function getInsertSubmenuStyle(anchor: HTMLElement | null) {
  insertMenuScrollTop.value

  if (!insertMenuPanelRef.value || !anchor) {
    return undefined
  }

  const panelRect = insertMenuPanelRef.value.getBoundingClientRect()
  const anchorRect = anchor.getBoundingClientRect()

  return {
    top: `${anchorRect.top - panelRect.top + anchorRect.height / 2}px`,
  }
}

const columnsSubmenuStyle = computed(() => getInsertSubmenuStyle(columnsMenuItemRef.value))
const countdownSubmenuStyle = computed(() => getInsertSubmenuStyle(countdownMenuItemRef.value))
const countdownDeadlineDate = computed(() => {
  const value = countdownDeadlineInput.value
  const parsed = value ? new Date(value) : null
  return parsed && Number.isFinite(parsed.getTime()) ? parsed : null
})
const countdownDeadlineDisplay = computed(() => {
  const date = countdownDeadlineDate.value
  if (!date) {
    return '请选择时间'
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}/${month}/${day} ${hours}:${minutes}`
})
const countdownMinimumDateTime = computed(() => new Date(createDefaultCountdownDeadline()))
const countdownTimeMin = computed(() => {
  const selected = countdownDeadlineDate.value
  const minimum = countdownMinimumDateTime.value
  if (!selected) {
    return '00:00'
  }

  const isSameDay =
    selected.getFullYear() === minimum.getFullYear() &&
    selected.getMonth() === minimum.getMonth() &&
    selected.getDate() === minimum.getDate()

  if (!isSameDay) {
    return '00:00'
  }

  return `${String(minimum.getHours()).padStart(2, '0')}:${String(minimum.getMinutes()).padStart(2, '0')}`
})
const countdownYearOptions = computed(() => Array.from({ length: 200 }, (_, index) => 1900 + index))
const countdownMonthOptions = computed(() => Array.from({ length: 12 }, (_, index) => index))
const countdownCalendarCells = computed(() => {
  const year = countdownCalendarYear.value
  const month = countdownCalendarMonth.value
  const firstDay = new Date(year, month, 1)
  const startWeekday = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()
  const selected = countdownDeadlineDate.value
  const today = new Date()
  const minimum = countdownMinimumDateTime.value
  const cells: Array<{
    key: string
    year: number
    month: number
    day: number
    label: number
    isCurrentMonth: boolean
    isToday: boolean
    isSelected: boolean
    isDisabled: boolean
  }> = []

  for (let index = 0; index < 42; index += 1) {
    let cellYear = year
    let cellMonth = month
    let cellDay = 0
    let isCurrentMonth = true

    if (index < startWeekday) {
      cellMonth = month - 1
      if (cellMonth < 0) {
        cellMonth = 11
        cellYear -= 1
      }
      cellDay = daysInPrevMonth - startWeekday + index + 1
      isCurrentMonth = false
    } else if (index >= startWeekday + daysInMonth) {
      cellMonth = month + 1
      if (cellMonth > 11) {
        cellMonth = 0
        cellYear += 1
      }
      cellDay = index - startWeekday - daysInMonth + 1
      isCurrentMonth = false
    } else {
      cellDay = index - startWeekday + 1
    }

    const isToday =
      today.getFullYear() === cellYear &&
      today.getMonth() === cellMonth &&
      today.getDate() === cellDay
    const isDisabled = new Date(cellYear, cellMonth, cellDay, 23, 59, 59, 999).getTime() < minimum.getTime()
    const isSelected = !!selected &&
      selected.getFullYear() === cellYear &&
      selected.getMonth() === cellMonth &&
      selected.getDate() === cellDay

    cells.push({
      key: `${cellYear}-${cellMonth}-${cellDay}`,
      year: cellYear,
      month: cellMonth,
      day: cellDay,
      label: cellDay,
      isCurrentMonth,
      isToday,
      isSelected,
      isDisabled,
    })
  }

  return cells
})
const activeTableElement = ref<HTMLTableElement | null>(null)
const activeTableWrapperElement = ref<HTMLElement | null>(null)
const activeCountdownBlockElement = ref<HTMLElement | null>(null)
const activeCountdownBlockPos = ref<number | null>(null)
const activeTableMetrics = ref<{ left: number; top: number; width: number; height: number } | null>(null)
const tableColumnHandles = ref<Array<{ index: number; left: number; width: number }>>([])
const tableRowHandles = ref<Array<{ index: number; top: number; height: number }>>([])
const tableColumnAddPoints = ref<Array<{ key: string; insertIndex: number; left: number }>>([])
const tableRowAddPoints = ref<Array<{ key: string; insertIndex: number; top: number }>>([])
const selectedTableColumnIndex = ref<number | null>(null)
const selectedTableRowIndex = ref<number | null>(null)

const fontSizeOptions: FontSizeOption[] = [
  { label: '初号', value: '42px' },
  { label: '小初', value: '36px' },
  { label: '一号', value: '28px' },
  { label: '小一', value: '26px' },
  { label: '二号', value: '24px' },
  { label: '小二', value: '22px' },
  { label: '三号', value: '21px' },
  { label: '小三', value: '20px' },
  { label: '四号', value: '18px' },
  { label: '小四', value: '16px' },
  { label: '五号', value: '14px' },
  { label: '小五', value: '12px' },
]

const fontFamilyOptions: FontFamilyOption[] = [
  { label: '默认', value: '' },
  { label: '微软雅黑', value: '"Microsoft YaHei", "PingFang SC", sans-serif' },
  { label: '宋体', value: '"SimSun", serif' },
  { label: '黑体', value: '"SimHei", sans-serif' },
  { label: '楷体', value: '"KaiTi", serif' },
  { label: '仿宋', value: '"FangSong", serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Monospace', value: '"Consolas", "SFMono-Regular", monospace' },
]

const insertQuickItems: InsertQuickItem[] = [
  { key: 'paragraph', label: 'T', type: 'text', action: 'paragraph' },
  { key: 'h1', label: 'H1', type: 'text', action: 'heading-1' },
  { key: 'h2', label: 'H2', type: 'text', action: 'heading-2' },
  { key: 'h3', label: 'H3', type: 'text', action: 'heading-3' },
  { key: 'h4', label: 'H4', type: 'text', action: 'heading-4' },
  { key: 'h5', label: 'H5', type: 'text', action: 'heading-5' },
  { key: 'h6', label: 'H6', type: 'text', action: 'heading-6' },
  { key: 'bullet', label: '无序列表', type: 'icon', iconName: 'wuxuliebiao', action: 'bullet-list' },
  { key: 'ordered', label: '有序列表', type: 'icon', iconName: 'youxuliebiao', action: 'ordered-list' },
  { key: 'task', label: '待办', type: 'icon', iconName: 'To-do', action: 'task-list' },
]

const insertGeneralItems: InsertMenuItem[] = [
  { key: 'image', label: '图片', colorIconName: 'tupian', action: 'image' },
  { key: 'video', label: '视频', colorIconName: 'shipin', action: 'video' },
  { key: 'table', label: '表格', colorIconName: 'biaoge', action: 'table', comingSoon: true },
  { key: 'local-file', label: '本地文件', colorIconName: 'file', action: 'local-file' },
  { key: 'columns', label: '分栏', colorIconName: 'fenlan', action: 'columns' },
  { key: 'highlight-block', label: '高亮块', colorIconName: 'gaoliangkuai1', action: 'highlight-block' },
  { key: 'code-block', label: '代码块', colorIconName: 'daimakuai', action: 'code-block' },
  { key: 'formula', label: '公式', colorIconName: 'jisuangongshi', action: 'formula' },
  { key: 'blockquote', label: '引用', colorIconName: 'yinyong', action: 'blockquote' },
  { key: 'emoji', label: '表情符号', action: 'emoji' },
  { key: 'link', label: '超链接', colorIconName: 'wangye', action: 'link' },
  { key: 'divider', label: '分隔线', colorIconName: 'fengexian', action: 'divider' },
]

const insertAppItems: InsertMenuItem[] = [
  { key: 'countdown', label: '倒计时', colorIconName: 'daojishi', action: 'countdown' },
]

const insertExternalItems: InsertMenuItem[] = [
  { key: 'markdown-import', label: 'Markdown导入', colorIconName: 'markdown', action: 'markdown-import' },
]

const blockSideGeneralInsertActions = [
  ...insertGeneralItems.filter((item) => !['local-file', 'markdown-import'].includes(item.action)),
  ...insertAppItems,
]

const blockTransformActions = insertQuickItems
const blockPropertyActions = [
  { key: 'align-left', label: '左对齐', iconName: 'zuoduiqi', action: 'align-left' },
  { key: 'align-center', label: '居中对齐', iconName: 'juzhongduiqi', action: 'align-center' },
  { key: 'align-right', label: '右对齐', iconName: 'youduiqi', action: 'align-right' },
  { key: 'indent-more', label: '增加缩进', iconName: 'yousuojin', action: 'indent-more' },
  { key: 'indent-less', label: '减少缩进', iconName: 'zuosuojin', action: 'indent-less' },
] as const

const blockSideTransformableTypes = new Set(['paragraph', 'heading', 'bulletList', 'orderedList', 'taskList'])
const blockSideAlignIndentTypes = new Set(['paragraph', 'heading', 'bulletList', 'orderedList'])
const blockSideTextColorTypes = new Set(['paragraph', 'heading', 'bulletList', 'orderedList', 'taskList', 'blockquote', 'highlightBlock'])

const activeFeatureCodes = computed(() => props.featureCodes ?? props.enabledFeatureItems)
const activeExportCodes = computed(() => props.featureCodes ?? props.enabledExportItems)
const activeInsertMenuCodes = computed(() => props.featureCodes ?? props.enabledInsertMenuItems)
const activeToolbarActionCodes = computed(() => props.featureCodes ?? props.enabledToolbarActions)

function isFeatureWhitelisted(key: Parameters<typeof isRichTextFeatureCodeEnabled>[0]) {
  return isRichTextFeatureCodeEnabled(key, activeFeatureCodes.value)
}

const messages = computed(() => resolveEditorMessages(props.messages))

function t(key: string) {
  return messages.value[key] ?? defaultEditorMessages[key] ?? key
}

function getInsertItemLabel(key: RichTextEditorInsertMenuItemKey) {
  switch (key) {
    case 'image':
      return t('insert.image')
    case 'video':
      return t('insert.video')
    case 'table':
      return t('insert.table')
    case 'local-file':
      return t('insert.localFile')
    case 'columns':
      return t('insert.columns')
    case 'highlight-block':
      return t('insert.highlightBlock')
    case 'date':
      return t('insert.date')
    case 'code-block':
      return t('insert.codeBlock')
    case 'formula':
      return t('insert.formula')
    case 'blockquote':
      return t('insert.blockquote')
    case 'emoji':
      return t('insert.emoji')
    case 'link':
      return t('insert.link')
    case 'divider':
      return t('insert.divider')
    case 'countdown':
      return t('insert.countdown')
    case 'markdown-import':
      return t('insert.markdownImport')
    default:
      return key
  }
}

const quoteBorderColors = ['#C084FC', '#F472B6', '#FB7185', '#F97316', '#F59E0B', '#10B981', '#14B8A6', '#3B82F6', '#6366F1', '#64748B']
const quoteBackgroundColors = ['#FCF5FF', '#FDF2F8', '#FFF1F2', '#FFF7ED', '#FFFBEB', '#ECFDF5', '#F0FDFA', '#EFF6FF', '#EEF2FF', '#F8FAFC']
const blockSideQuoteBorderColors = [...quoteBorderColors, '#06B6D4', '#84CC16', '#EAB308', '#94A3B8', '#334155']
const blockSideQuoteBackgroundColors = [...quoteBackgroundColors, '#ECFEFF', '#F7FEE7', '#FEFCE8', '#F1F5F9', '#E2E8F0']
const highlightBlockDefaultBorderColor = '#f3c389'
const highlightBlockDefaultBackgroundColor = '#fff8ef'

const recentColors = ref<string[]>(['#38A169', '#1DA1F2'])
const recentHighlightColors = ref<string[]>(['#FFF3C4', '#D8F4E5'])
const outlineItems = ref<RichTextEditorOutlineItem[]>([])
const activeOutlinePos = ref<number | null>(null)
const outlineChangeListeners = new Set<RichTextEditorOutlineChangeHandler>()
let lastOutlineStateKey = ''
const presentationPointerX = ref(0)
const presentationPointerY = ref(0)
const marqueeGestureStart = ref<MarqueePoint | null>(null)
const marqueeGestureCurrent = ref<MarqueePoint | null>(null)
const isMarqueeSelecting = ref(false)
const selectedMarqueeBlockPositions = ref<number[]>([])
const dragInsertIndicator = ref<DragInsertIndicator | null>(null)
const hoveredBlockSideControl = ref<BlockSideControl | null>(null)
const activeBlockSideControl = ref<BlockSideControl | null>(null)
const isBlockSideInteractionActive = ref(false)
const isEditorTyping = ref(false)
const isEditorComposing = ref(false)
const hasNativeEditorSelection = ref(false)
const isTextSelectionBubbleVisible = ref(false)
const isTableSelectionBubbleVisible = ref(false)
let editorTypingTimer: ReturnType<typeof setTimeout> | null = null
const blockSideMenuMode = ref<BlockSideMenuMode | null>(null)
const blockSideMenuAnchorPoint = ref<{ left: number; top: number } | null>(null)
const blockSideSubmenuMode = ref<BlockSideSubmenuMode | null>(null)
const blockSideTableThemePos = ref<number | null>(null)
const blockSideTargetPos = ref<number | null>(null)
const blockSideCustomColorKind = ref<BlockColorKind | null>(null)
watch(blockSideSubmenuMode, () => {
  blockSideCustomColorKind.value = null
})
const blockClipboardPayload = ref<BlockClipboardPayload | null>(null)
let pendingBlockCopy: { payload: BlockClipboardPayload; written: boolean } | null = null
const blockDragState = ref<BlockDragState | null>(null)
const blockDragGhost = ref<BlockDragGhost | null>(null)
const tableCellPaletteColors: Array<string | null> = [
  null,
  '#F3F4F6',
  '#FDE2E2',
  '#FCEFD8',
  '#FEF3C7',
  '#D9F99D',
  '#DCFCE7',
  '#DBEAFE',
  '#E9D5FF',
  '#E5E7EB',
  '#D1D5DB',
  '#F8B4B4',
  '#FCD9BD',
  '#FDE68A',
  '#BEF264',
  '#86EFAC',
  '#A5B4FC',
  '#C4B5FD',
]

const initialContent = computed<JSONContent>(() => {
  if (props.modelValue) {
    return props.modelValue
  }

  if (props.collaboration && isFeatureWhitelisted('collaboration')) {
    return {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
        },
      ],
    }
  }

  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: '分隔符苟富贵下饭',
          },
        ],
      },
    ],
  }
})

const isPreviewMode = computed(() => isPresentationMode.value || props.mode === 'preview')
const editorEditable = computed(() => props.editable && !isPreviewMode.value)
const isToolbarVisible = computed(() => props.showToolbar && !isPreviewMode.value)
const isCommentFeatureEnabled = computed(() => isFeatureWhitelisted('comments'))
const activeOutlinePlacement = computed(() =>
  props.showOutline ? resolveRichTextOutlinePlacement(props.outlinePlacement, activeFeatureCodes.value) : null,
)
const resolvedOutlinePlacement = computed(() => activeOutlinePlacement.value ?? props.outlinePlacement)
const isOutlineFeatureEnabled = computed(() => !!activeOutlinePlacement.value)
const isWatermarkFeatureEnabled = computed(() => isFeatureWhitelisted('watermark'))
const isCollaborationFeatureEnabled = computed(() => isFeatureWhitelisted('collaboration'))
const enabledCollaboration = computed(() => (isCollaborationFeatureEnabled.value ? props.collaboration : null))
const isMentionEnabled = computed(() => props.mention && isFeatureWhitelisted('mention'))
const isCommentMentionEnabled = computed(() => props.commentMention !== false && isFeatureWhitelisted('mention'))
const normalizedComments = computed<RichTextEditorCommentThread[]>(() =>
  (isCommentFeatureEnabled.value ? (props.comments ?? []) : [])
    .filter((thread): thread is RichTextEditorCommentThread => !!thread && typeof thread.id === 'string' && !!thread.id.trim())
    .map((thread) => ({
      ...thread,
      comments: Array.isArray(thread.comments) ? thread.comments : [],
    })),
)
const visibleComments = computed(() => normalizedComments.value.filter((thread) => thread.status !== 'resolved'))
const activeCommentUser = computed<RichTextEditorCommentUser | null>(() => {
  if (props.commentUser?.id && props.commentUser.name) {
    return props.commentUser
  }

  const collaborationUser = enabledCollaboration.value?.user

  if (!collaborationUser) {
    return null
  }

  const source = collaborationUser as Record<string, unknown>
  const id = String(source.id ?? source.userId ?? source.clientUniqueCode ?? collaborationUser.name ?? '').trim()
  const name = String(source.name ?? source.userName ?? source.displayName ?? id).trim()

  if (!id || !name) {
    return null
  }

  return {
    ...source,
    id,
    name,
    color: typeof source.color === 'string' && source.color ? source.color : '#4c7dff',
  }
})
const commentPanelThreads = computed<RichTextEditorCommentThread[]>(() => {
  const threads = [...visibleComments.value]
  const pendingThread = pendingCommentThread.value

  if (pendingThread && !threads.some((thread) => thread.id === pendingThread.id)) {
    threads.unshift({
      id: pendingThread.id,
      anchorText: pendingThread.anchorText,
      status: 'open',
      comments: [],
    })
  }

  return threads
})
const shouldShowCommentsPanel = computed(() => isCommentFeatureEnabled.value && props.showComments)
const commentPanelTitle = computed(() => `评论 (${visibleComments.value.length})`)
const selectedCommentThread = computed<RichTextEditorCommentThread | null>(() => {
  if (selectedCommentThreadId.value) {
    const matched = commentPanelThreads.value.find((thread) => thread.id === selectedCommentThreadId.value)

    if (matched) {
      return matched
    }
  }

  return commentPanelThreads.value[0] ?? null
})
const filteredInsertGeneralItems = computed(() =>
  insertGeneralItems
    .filter((item) => isRichTextCodeEnabled(item.key, activeInsertMenuCodes.value))
    .map((item) => ({ ...item, label: getInsertItemLabel(item.key) })),
)
const filteredInsertAppItems = computed(() =>
  insertAppItems
    .filter((item) => isRichTextCodeEnabled(item.key, activeInsertMenuCodes.value))
    .map((item) => ({ ...item, label: getInsertItemLabel(item.key) })),
)
const filteredInsertExternalItems = computed(() =>
  insertExternalItems
    .filter((item) => isRichTextCodeEnabled(item.key, activeInsertMenuCodes.value))
    .map((item) => ({ ...item, label: getInsertItemLabel(item.key) })),
)
const slashCommands = computed(() => [
  ...insertQuickItems.map(item => ({ key: item.key, label: item.key === 'paragraph' ? '正文' : item.label, action: item.action, iconName: item.iconName ?? '', isColorIcon: false, group: 'basic' })),
  ...filteredInsertGeneralItems.value.filter(item => item.action !== 'local-file').map(item => ({ key: item.key, label: item.label, action: item.action, iconName: item.colorIconName ?? item.monoIconName ?? (item.key === 'emoji' ? 'smile' : ''), isColorIcon: !!item.colorIconName, group: 'common' })),
  ...filteredInsertAppItems.value.map(item => ({ key: item.key, label: item.label, action: item.action, iconName: item.colorIconName ?? item.monoIconName ?? '', isColorIcon: !!item.colorIconName, group: 'common' })),
  ...filteredInsertGeneralItems.value.filter(item => item.action === 'local-file').map(item => ({ key: item.key, label: item.label, action: item.action, iconName: item.colorIconName ?? item.monoIconName ?? '', isColorIcon: !!item.colorIconName, group: 'more' })),
  ...filteredInsertExternalItems.value.map(item => ({ key: item.key, label: item.label, action: item.action, iconName: item.colorIconName ?? item.monoIconName ?? '', isColorIcon: !!item.colorIconName, group: 'more' })),
])
const visibleSlashCommands = computed(() => {
  const query = (slashQuery.value ?? '').toLocaleLowerCase()
  return slashCommands.value.filter(item =>
    query ? `${item.label} ${item.key} ${item.action}`.toLocaleLowerCase().includes(query) : item.group !== 'more')
    .map((item, index) => ({ ...item, index }))
})
const visibleSlashBasicCommands = computed(() => visibleSlashCommands.value.filter(item => item.group === 'basic'))
const visibleSlashCommonCommands = computed(() => visibleSlashCommands.value.filter(item => item.group === 'common'))
const visibleSlashMoreCommands = computed(() => visibleSlashCommands.value.filter(item => item.group === 'more'))
const isSlashMenuOpen = computed(() => editorEditable.value && slashRange.value !== null && slashQuery.value !== null)
const isSlashPopupOpen = computed(() => isSlashMenuOpen.value || isSlashEmojiPickerOpen.value)
const slashMenuStyle = computed(() => ({
  left: `${slashMenuPosition.value.left}px`,
  top: `${slashMenuPosition.value.top}px`,
  maxHeight: `${slashMenuPosition.value.maxHeight}px`,
}))
const hasInsertMenuItems = computed(() =>
  filteredInsertGeneralItems.value.length > 0
  || filteredInsertAppItems.value.length > 0
  || filteredInsertExternalItems.value.length > 0,
)
const isEmojiToolbarEnabled = computed(() => isRichTextCodeEnabled('emoji', activeInsertMenuCodes.value))
const isBlockquoteToolbarEnabled = computed(() => isRichTextCodeEnabled('blockquote', activeToolbarActionCodes.value))
const exportMenuItems = computed<ExportMenuItem[]>(() => {
  const items: ExportMenuItem[] = [
    {
      key: 'pdf',
      label: t('export.pdf'),
      iconName: 'pdfdaochu',
      loadingLabel: t('export.pdf.loading'),
      onClick: exportAsPdf,
    },
    {
      key: 'html',
      label: t('export.html'),
      iconName: 'wangye',
      loadingLabel: t('export.html.loading'),
      onClick: exportAsHtml,
    },
    {
      key: 'image',
      label: t('export.image'),
      iconName: 'tupiandaochu',
      loadingLabel: t('export.image.loading'),
      onClick: exportAsImage,
    },
  ]

  return items.filter((item) => isRichTextCodeEnabled(item.key, activeExportCodes.value))
})
const isPrintEnabled = computed(() => isRichTextCodeEnabled('print', activeExportCodes.value))
const hasExportMenuItems = computed(() => exportMenuItems.value.length > 0)
const countdownSettingsTitle = computed(() => t('countdown.settingsTitle'))
const formulaDialogTitle = computed(() => t('formula.insertTitle'))
const insertLabel = computed(() => t('insert.label'))
const insertSectionGeneralLabel = computed(() => t('insert.section.general'))
const insertSectionAppsLabel = computed(() => t('insert.section.apps'))
const insertSectionExternalLabel = computed(() => t('insert.section.external'))
const quoteToggleLabel = computed(() => (editor.value?.isActive('blockquote') ? t('quote.cancel') : t('quote.apply')))
const quoteBorderColorLabel = computed(() => t('quote.borderColor'))
const quoteBackgroundColorLabel = computed(() => t('quote.backgroundColor'))
const exportLabel = computed(() => t('export.label'))
const printLabel = computed(() => (exportingType.value === 'print' ? t('print.loading') : t('print.label')))
const outlineLabel = computed(() => t('outline.label'))
const outlineCollapseTitle = computed(() => t('outline.collapse'))
const outlineEmptyDescription = computed(() => t('outline.empty.description'))
const outlineEmptyTip = computed(() => t('outline.empty.tip'))
const wordCountLabel = computed(() => `字数： ${characterCount.value}`)
const lineCountLabel = computed(() => `行数： ${lineCount.value}`)
const presentationLabel = computed(() => (isPresentationMode.value ? t('status.presentation.exit') : t('status.presentation.enter')))
const fullscreenLabel = computed(() => (isFullscreen.value ? t('status.fullscreen.exit') : t('status.fullscreen.enter')))
const previewFitScale = computed(() => {
  if (!isPreviewMode.value) {
    return 1
  }

  const availableWidth = Math.max(320, viewportWidth.value - 32)
  return Math.min(1, availableWidth / pageBaseWidth)
})
const presentationPointerStyle = computed(() => ({
  left: `${presentationPointerX.value}px`,
  top: `${presentationPointerY.value}px`,
}))
const marqueeSelectionRect = computed<MarqueeRect | null>(() => {
  if (!pageRef.value || !marqueeGestureStart.value || !marqueeGestureCurrent.value) {
    return null
  }

  const pageRect = pageRef.value.getBoundingClientRect()
  const scale = zoomScale.value || 1
  const left = (Math.min(marqueeGestureStart.value.x, marqueeGestureCurrent.value.x) - pageRect.left) / scale
  const top = (Math.min(marqueeGestureStart.value.y, marqueeGestureCurrent.value.y) - pageRect.top) / scale
  const right = (Math.max(marqueeGestureStart.value.x, marqueeGestureCurrent.value.x) - pageRect.left) / scale
  const bottom = (Math.max(marqueeGestureStart.value.y, marqueeGestureCurrent.value.y) - pageRect.top) / scale

  const clampedLeft = Math.max(0, Math.min(pageBaseWidth, left))
  const clampedTop = Math.max(0, Math.min(Math.max(pageRef.value.scrollHeight, pageBaseHeight), top))
  const clampedRight = Math.max(0, Math.min(pageBaseWidth, right))
  const clampedBottom = Math.max(0, Math.min(Math.max(pageRef.value.scrollHeight, pageBaseHeight), bottom))

  return {
    left: Math.min(clampedLeft, clampedRight),
    top: Math.min(clampedTop, clampedBottom),
    width: Math.max(0, Math.abs(clampedRight - clampedLeft)),
    height: Math.max(0, Math.abs(clampedBottom - clampedTop)),
  }
})
const selectedMarqueeBlocks = computed<MarqueeTopLevelBlock[]>(() => {
  if (!editor.value || !pageRef.value || !selectedMarqueeBlockPositions.value.length) {
    return []
  }

  const positionSet = new Set(selectedMarqueeBlockPositions.value)
  const pageRect = pageRef.value.getBoundingClientRect()
  const scale = zoomScale.value || 1
  const blocks: MarqueeTopLevelBlock[] = []

  editor.value.state.doc.forEach((node, offset) => {
    if (!positionSet.has(offset)) {
      return
    }

    const dom = editor.value?.view.nodeDOM(offset)
    if (!(dom instanceof HTMLElement)) {
      return
    }

    const rect = dom.getBoundingClientRect()
    blocks.push({
      pos: offset,
      from: offset,
      to: offset + node.nodeSize,
      node,
      dom,
      rect: {
        left: (rect.left - pageRect.left) / scale,
        top: (rect.top - pageRect.top) / scale,
        width: rect.width / scale,
        height: rect.height / scale,
      },
    })
  })

  return blocks.sort((left, right) => left.pos - right.pos)
})
const hasMarqueeSelection = computed(() => selectedMarqueeBlocks.value.length > 0)
const visibleMentionItems = computed(() => {
  if (mentionActiveType.value === 'all') {
    return mentionItems.value
  }

  return mentionItems.value.filter((item) => item.type === mentionActiveType.value)
})
const selectedMentionItem = computed(() => visibleMentionItems.value[selectedMentionIndex.value] ?? null)
const mentionPanelStyle = computed(() => ({
  left: `${mentionPanelPosition.value.left}px`,
  top: `${mentionPanelPosition.value.top}px`,
}))
const visibleCommentMentionItems = computed(() => {
  if (commentMentionActiveType.value === 'all') {
    return commentMentionItems.value
  }

  return commentMentionItems.value.filter((item) => item.type === commentMentionActiveType.value)
})
const selectedCommentMentionItem = computed(() => visibleCommentMentionItems.value[selectedCommentMentionIndex.value] ?? null)
const commentMentionPanelStyle = computed(() => ({
  left: `${commentMentionPanelPosition.value.left}px`,
  top: `${commentMentionPanelPosition.value.top}px`,
}))

const editor = useRichTextEditor({
  content: initialContent.value,
  editable: editorEditable.value,
  placeholder: props.placeholder,
  collaboration: enabledCollaboration.value,
  uploadImage: uploadImageRef,
  uploadVideo: uploadVideoRef,
  onUploadError: handleUploadError,
  mention: isMentionEnabled,
  onLocalFileClick: (payload) => {
    emit('local-file-click', payload)
  },
  onLocalFileDownload: (payload) => {
    emit('local-file-download', payload)
  },
  onMentionClick: (payload) => {
    if (isMentionEnabled.value) {
      emit('mention-item-click', payload)
    }
  },
  onMentionTrigger: () => {
    if (isMentionEnabled.value) {
      openMentionPanel()
    }
  },
  onMentionKeyDown: (event) => handleMentionKeyDown(event),
  onUpdate: (value) => {
    emit('update:modelValue', value)
    emit('change', value)
  },
})

let mentionRequestId = 0

function normalizeMentionItem(item: RichTextEditorMentionItem): RichTextEditorMentionItem | null {
  const id = String(item?.id ?? '').trim()
  const name = String(item?.name ?? '').trim()
  const type = Number(item?.type ?? 1) === 2 ? 2 : 1

  if (!id || !name) {
    return null
  }

  return {
    ...item,
    id,
    name,
    type,
    avatar: item.avatar ? String(item.avatar) : undefined,
    icon: item.icon ? String(item.icon) : undefined,
    tag: item.tag ? String(item.tag) : undefined,
    updatedAt: item.updatedAt ? String(item.updatedAt) : undefined,
  }
}

function getMentionPayload(item: RichTextEditorMentionItem): RichTextEditorMentionItem {
  return {
    ...item,
    type: Number(item.type) === 2 ? 2 : 1,
  }
}

function getMentionFallbackText(item: RichTextEditorMentionItem) {
  return item.type === 1 ? getMentionAvatarText(item.name) : '文'
}

function getMentionFallbackStyle(item: RichTextEditorMentionItem) {
  return item.type === 1 ? getMentionAvatarStyle(item.id) : undefined
}

function getMentionQueryRange() {
  if (!editor.value) {
    return null
  }

  const { selection, doc } = editor.value.state
  if (!selection.empty) {
    return null
  }

  const current = selection.$from
  if (!current.parent.isTextblock) {
    return null
  }

  const blockStart = current.start()
  const beforeCursor = doc.textBetween(blockStart, current.pos, '\n', '\n')
  const atIndex = beforeCursor.lastIndexOf('@')

  if (atIndex < 0) {
    return null
  }

  const query = beforeCursor.slice(atIndex + 1)
  if (/[\s@]/.test(query)) {
    return null
  }

  return {
    from: blockStart + atIndex,
    to: current.pos,
    query,
  }
}

function syncMentionPanelPosition() {
  if (!editor.value || !mentionRange.value || !pageRef.value) {
    return
  }

  const coords = editor.value.view.coordsAtPos(mentionRange.value.from)
  const pageRect = pageRef.value.getBoundingClientRect()
  const scale = zoomScale.value || 1
  const panelWidth = mentionPanelRef.value?.offsetWidth || mentionPanelWidth
  const panelHeight = mentionPanelRef.value?.offsetHeight || mentionPanelHeight
  const scaledPanelWidth = panelWidth * scale
  const scaledPanelHeight = panelHeight * scale
  const viewportWidthValue = window.innerWidth || viewportWidth.value
  const viewportHeightValue = window.innerHeight || viewportHeight.value
  const maxViewportLeft = Math.max(
    mentionPanelViewportMargin,
    viewportWidthValue - scaledPanelWidth - mentionPanelViewportMargin,
  )
  const maxViewportTop = Math.max(
    mentionPanelViewportMargin,
    viewportHeightValue - scaledPanelHeight - mentionPanelViewportMargin,
  )
  const preferredViewportTop = coords.bottom + mentionPanelTriggerGap
  const flippedViewportTop = coords.top - scaledPanelHeight - mentionPanelTriggerGap
  const shouldFlipUp = preferredViewportTop + scaledPanelHeight > viewportHeightValue - mentionPanelViewportMargin
    && flippedViewportTop >= mentionPanelViewportMargin
  const viewportLeft = Math.max(
    mentionPanelViewportMargin,
    Math.min(maxViewportLeft, coords.left),
  )
  const viewportTop = Math.max(
    mentionPanelViewportMargin,
    Math.min(maxViewportTop, shouldFlipUp ? flippedViewportTop : preferredViewportTop),
  )

  mentionPanelPosition.value = {
    left: Math.max(
      mentionPanelViewportMargin,
      Math.min(
        pageBaseWidth - panelWidth - mentionPanelViewportMargin,
        (viewportLeft - pageRect.left) / scale,
      ),
    ),
    top: Math.max(
      mentionPanelViewportMargin,
      (viewportTop - pageRect.top) / scale,
    ),
  }
}

async function fetchMentionItems(payload: RichTextEditorMentionProviderPayload) {
  if (!isMentionEnabled.value) {
    return
  }

  const requestId = ++mentionRequestId
  isMentionLoading.value = true

  try {
    const provider = props.onMentionSearch ?? props.mentionProvider
    const rawItems = provider ? await provider(payload) : []

    if (requestId !== mentionRequestId) {
      return
    }

    mentionItems.value = (Array.isArray(rawItems) ? rawItems : [])
      .map(normalizeMentionItem)
      .filter((item): item is RichTextEditorMentionItem => !!item)
    selectedMentionIndex.value = 0
  } catch {
    if (requestId === mentionRequestId) {
      mentionItems.value = []
      selectedMentionIndex.value = 0
    }
  } finally {
    if (requestId === mentionRequestId) {
      isMentionLoading.value = false
    }
  }
}

function closeMentionPanel() {
  isMentionPanelOpen.value = false
  mentionRange.value = null
  mentionQuery.value = ''
  mentionItems.value = []
  selectedMentionIndex.value = 0
  mentionRequestId += 1
  isMentionLoading.value = false
}

function openMentionPanel() {
  if (!isMentionEnabled.value || !editor.value || !editorEditable.value) {
    return
  }

  const range = getMentionQueryRange()
  if (!range) {
    closeMentionPanel()
    return
  }

  mentionRange.value = {
    from: range.from,
    to: range.to,
  }
  mentionQuery.value = range.query
  mentionActiveType.value = 'all'
  isMentionPanelOpen.value = true
  syncMentionPanelPosition()
  void nextTick(syncMentionPanelPosition)
  void fetchMentionItems({
    query: range.query,
    type: mentionActiveType.value,
  })
}

function syncMentionState() {
  if (!isMentionEnabled.value) {
    if (isMentionPanelOpen.value || mentionRange.value || mentionItems.value.length || isMentionLoading.value) {
      closeMentionPanel()
    }
    return
  }

  if (!isMentionPanelOpen.value) {
    return
  }

  const range = getMentionQueryRange()
  if (!range) {
    closeMentionPanel()
    return
  }

  mentionRange.value = {
    from: range.from,
    to: range.to,
  }
  syncMentionPanelPosition()
  void nextTick(syncMentionPanelPosition)

  if (range.query !== mentionQuery.value) {
    mentionQuery.value = range.query
    void fetchMentionItems({
      query: range.query,
      type: mentionActiveType.value,
    })
  }
}

function setMentionTab(type: RichTextEditorMentionType | 'all') {
  if (!isMentionEnabled.value) {
    return
  }

  mentionActiveType.value = type
  selectedMentionIndex.value = 0
  void fetchMentionItems({
    query: mentionQuery.value,
    type,
  })
}

function selectMentionItem(item: RichTextEditorMentionItem, index: number) {
  if (!isMentionEnabled.value) {
    return
  }

  selectedMentionIndex.value = index
  emit('mention-item-click', getMentionPayload(item))
}

function moveMentionSelection(delta: number) {
  const count = visibleMentionItems.value.length
  if (!count) {
    return
  }

  selectedMentionIndex.value = (selectedMentionIndex.value + delta + count) % count
}

function insertMentionItem(item: RichTextEditorMentionItem) {
  if (!isMentionEnabled.value || !editor.value || !mentionRange.value) {
    return false
  }

  const payload = getMentionPayload(item)
  const inserted = editor.value
    .chain()
    .focus()
    .deleteRange(mentionRange.value)
    .insertContent([
      {
        type: 'mention',
        attrs: payload,
      },
      {
        type: 'text',
        text: ' ',
      },
    ])
    .run()

  if (inserted) {
    emit('mention-submit', payload)
    closeMentionPanel()
  }

  return inserted
}

function insertExternalMention(payload: RichTextEditorMentionItem) {
  const item = normalizeMentionItem(payload)
  if (!isMentionEnabled.value || !item || !editor.value) {
    return false
  }

  return editor.value
    .chain()
    .focus()
    .insertContent([
      {
        type: 'mention',
        attrs: getMentionPayload(item),
      },
      {
        type: 'text',
        text: ' ',
      },
    ])
    .run()
}

function submitSelectedMention() {
  if (!isMentionEnabled.value || !selectedMentionItem.value) {
    return
  }

  insertMentionItem(selectedMentionItem.value)
}

function handleMentionKeyDown(event: KeyboardEvent) {
  if (!isMentionEnabled.value || !isMentionPanelOpen.value) {
    return false
  }

  if (event.key === 'Escape') {
    closeMentionPanel()
    return true
  }

  if (event.key === 'ArrowDown') {
    moveMentionSelection(1)
    return true
  }

  if (event.key === 'ArrowUp') {
    moveMentionSelection(-1)
    return true
  }

  if (event.key === 'Enter' && selectedMentionItem.value) {
    submitSelectedMention()
    return true
  }

  return false
}

let commentMentionRequestId = 0

function normalizeCommentMentionItem(item: RichTextEditorMentionItem): RichTextEditorCommentMentionItem | null {
  return normalizeMentionItem(item)
}

function getCommentMentionPayload(item: RichTextEditorCommentMentionItem): RichTextEditorCommentMentionItem {
  return getMentionPayload(item)
}

function getCommentMentionText(item: RichTextEditorCommentMentionItem) {
  return `@${item.name}`
}

function getCommentMentionKey(item: RichTextEditorCommentMentionItem) {
  return `${item.type}:${item.id}`
}

function mergeCommentMentions(
  mentions: RichTextEditorCommentMentionItem[],
  item: RichTextEditorCommentMentionItem,
) {
  const payload = getCommentMentionPayload(item)
  const key = getCommentMentionKey(payload)
  const next = mentions.filter((mention) => getCommentMentionKey(mention) !== key)
  return [...next, payload]
}

function pruneCommentMentions(content: string, mentions: RichTextEditorCommentMentionItem[]) {
  return mentions.filter((mention) => content.includes(getCommentMentionText(mention)))
}

function getCommentDraftMentions(threadId: string, parentId?: string) {
  return commentMentionDrafts.value[getCommentDraftKey(threadId, parentId)] ?? []
}

function setCommentDraftMentions(threadId: string, mentions: RichTextEditorCommentMentionItem[], parentId?: string) {
  const draftKey = getCommentDraftKey(threadId, parentId)
  commentMentionDrafts.value = {
    ...commentMentionDrafts.value,
    [draftKey]: mentions,
  }
}

function getCommentMentionQueryRange(textarea: HTMLTextAreaElement) {
  const selectionStart = textarea.selectionStart ?? 0
  const selectionEnd = textarea.selectionEnd ?? selectionStart

  if (selectionStart !== selectionEnd) {
    return null
  }

  const beforeCursor = textarea.value.slice(0, selectionStart)
  const atIndex = beforeCursor.lastIndexOf('@')

  if (atIndex < 0) {
    return null
  }

  const query = beforeCursor.slice(atIndex + 1)
  if (/[\s@]/.test(query)) {
    return null
  }

  return {
    from: atIndex,
    to: selectionStart,
    query,
  }
}

function syncCommentMentionPanelPosition() {
  const context = commentMentionContext.value
  if (!context) {
    return
  }

  const rect = context.textarea.getBoundingClientRect()
  const panelWidth = commentMentionPanelRef.value?.offsetWidth || mentionPanelWidth
  const panelHeight = commentMentionPanelRef.value?.offsetHeight || mentionPanelHeight
  const viewportWidthValue = window.innerWidth || viewportWidth.value
  const viewportHeightValue = window.innerHeight || viewportHeight.value
  const preferredTop = rect.bottom + mentionPanelTriggerGap
  const flippedTop = rect.top - panelHeight - mentionPanelTriggerGap
  const shouldFlipUp = preferredTop + panelHeight > viewportHeightValue - mentionPanelViewportMargin
    && flippedTop >= mentionPanelViewportMargin

  commentMentionPanelPosition.value = {
    left: Math.max(
      mentionPanelViewportMargin,
      Math.min(viewportWidthValue - panelWidth - mentionPanelViewportMargin, rect.left),
    ),
    top: Math.max(
      mentionPanelViewportMargin,
      Math.min(
        viewportHeightValue - panelHeight - mentionPanelViewportMargin,
        shouldFlipUp ? flippedTop : preferredTop,
      ),
    ),
  }
}

function closeCommentMentionPanel() {
  isCommentMentionPanelOpen.value = false
  commentMentionContext.value = null
  commentMentionQuery.value = ''
  commentMentionItems.value = []
  selectedCommentMentionIndex.value = 0
  commentMentionRequestId += 1
  isCommentMentionLoading.value = false
}

async function fetchCommentMentionItems(payload: RichTextEditorCommentMentionProviderPayload) {
  if (!isCommentMentionEnabled.value) {
    return
  }

  emit('comment-mention-search', payload)
  const requestId = ++commentMentionRequestId
  isCommentMentionLoading.value = true

  try {
    const provider = props.onCommentMentionSearch ?? props.commentMentionProvider
    const rawItems = provider ? await provider(payload) : []

    if (requestId !== commentMentionRequestId) {
      return
    }

    commentMentionItems.value = (Array.isArray(rawItems) ? rawItems : [])
      .map(normalizeCommentMentionItem)
      .filter((item): item is RichTextEditorCommentMentionItem => !!item)
    selectedCommentMentionIndex.value = 0
  } catch {
    if (requestId === commentMentionRequestId) {
      commentMentionItems.value = []
      selectedCommentMentionIndex.value = 0
    }
  } finally {
    if (requestId === commentMentionRequestId) {
      isCommentMentionLoading.value = false
    }
  }
}

function syncCommentMentionPanel(
  textarea: HTMLTextAreaElement | null,
  context: Omit<NonNullable<typeof commentMentionContext.value>, 'textarea' | 'range'>,
) {
  if (!isCommentMentionEnabled.value || !textarea || !editorEditable.value) {
    closeCommentMentionPanel()
    return
  }

  const range = getCommentMentionQueryRange(textarea)
  if (!range) {
    closeCommentMentionPanel()
    return
  }

  const content = context.mode === 'edit'
    ? editingCommentDraft.value
    : getCommentDraft(context.threadId, context.parentId)

  commentMentionContext.value = {
    ...context,
    textarea,
    range,
  }
  commentMentionQuery.value = range.query
  commentMentionActiveType.value = 'all'
  isCommentMentionPanelOpen.value = true
  syncCommentMentionPanelPosition()
  void nextTick(syncCommentMentionPanelPosition)
  void fetchCommentMentionItems({
    query: range.query,
    type: commentMentionActiveType.value,
    threadId: context.threadId,
    commentId: context.commentId,
    parentId: context.parentId,
    content,
  })
}

function updateCommentMentionPanelFromInput() {
  const context = commentMentionContext.value
  if (!context) {
    return
  }

  const range = getCommentMentionQueryRange(context.textarea)
  if (!range) {
    closeCommentMentionPanel()
    return
  }

  const content = context.mode === 'edit'
    ? editingCommentDraft.value
    : getCommentDraft(context.threadId, context.parentId)

  commentMentionContext.value = {
    ...context,
    range,
  }
  syncCommentMentionPanelPosition()
  void nextTick(syncCommentMentionPanelPosition)

  if (range.query !== commentMentionQuery.value) {
    commentMentionQuery.value = range.query
    void fetchCommentMentionItems({
      query: range.query,
      type: commentMentionActiveType.value,
      threadId: context.threadId,
      commentId: context.commentId,
      parentId: context.parentId,
      content,
    })
  }
}

function setCommentMentionTab(type: RichTextEditorMentionType | 'all') {
  if (!isCommentMentionEnabled.value || !commentMentionContext.value) {
    return
  }

  const context = commentMentionContext.value
  const content = context.mode === 'edit'
    ? editingCommentDraft.value
    : getCommentDraft(context.threadId, context.parentId)

  commentMentionActiveType.value = type
  selectedCommentMentionIndex.value = 0
  void fetchCommentMentionItems({
    query: commentMentionQuery.value,
    type,
    threadId: context.threadId,
    commentId: context.commentId,
    parentId: context.parentId,
    content,
  })
}

function selectCommentMentionItem(item: RichTextEditorCommentMentionItem, index: number) {
  if (!isCommentMentionEnabled.value) {
    return
  }

  selectedCommentMentionIndex.value = index
  emit('comment-mention-item-click', getCommentMentionPayload(item))
}

function moveCommentMentionSelection(delta: number) {
  const count = visibleCommentMentionItems.value.length
  if (!count) {
    return
  }

  selectedCommentMentionIndex.value = (selectedCommentMentionIndex.value + delta + count) % count
}

function insertCommentMentionItem(item: RichTextEditorCommentMentionItem) {
  const context = commentMentionContext.value

  if (!isCommentMentionEnabled.value || !context) {
    return false
  }

  const payload = getCommentMentionPayload(item)
  const current = context.mode === 'edit'
    ? editingCommentDraft.value
    : getCommentDraft(context.threadId, context.parentId)
  const mentionText = `${getCommentMentionText(payload)} `
  const next = `${current.slice(0, context.range.from)}${mentionText}${current.slice(context.range.to)}`
  const cursor = context.range.from + mentionText.length

  if (context.mode === 'edit') {
    editingCommentDraft.value = next
    editingCommentMentions.value = mergeCommentMentions(editingCommentMentions.value, payload)
  } else {
    setCommentDraft(context.threadId, next, context.parentId)
    setCommentDraftMentions(
      context.threadId,
      mergeCommentMentions(getCommentDraftMentions(context.threadId, context.parentId), payload),
      context.parentId,
    )
  }

  emit('comment-mention-submit', payload)
  closeCommentMentionPanel()

  void nextTick(() => {
    context.textarea.focus()
    context.textarea.setSelectionRange(cursor, cursor)
  })

  return true
}

function submitSelectedCommentMention() {
  if (!isCommentMentionEnabled.value || !selectedCommentMentionItem.value) {
    return
  }

  insertCommentMentionItem(selectedCommentMentionItem.value)
}

function handleCommentMentionKeyDown(event: KeyboardEvent) {
  if (!isCommentMentionEnabled.value || !isCommentMentionPanelOpen.value) {
    return false
  }

  if (event.key === 'Escape') {
    closeCommentMentionPanel()
    return true
  }

  if (event.key === 'ArrowDown') {
    moveCommentMentionSelection(1)
    return true
  }

  if (event.key === 'ArrowUp') {
    moveCommentMentionSelection(-1)
    return true
  }

  if ((event.key === 'Enter' || event.key === 'Tab') && selectedCommentMentionItem.value) {
    submitSelectedCommentMention()
    return true
  }

  return false
}

function getOutlineHeadingText(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized || '未命名标题'
}

function collectOutlineItems(): RichTextEditorOutlineItem[] {
  if (!editor.value) {
    return []
  }

  const items: RichTextEditorOutlineItem[] = []

  editor.value.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') {
      return
    }

    items.push({
      pos,
      level: Math.min(6, Math.max(1, Number(node.attrs.level ?? 1))),
      text: getOutlineHeadingText(node.textContent),
    })
  })

  return items
}

function findActiveOutlinePos(items: RichTextEditorOutlineItem[]) {
  if (!editor.value) {
    return null
  }

  const selectionPos = editor.value.state.selection.from
  let currentPos: number | null = null

  for (const item of items) {
    if (item.pos > selectionPos) {
      break
    }

    currentPos = item.pos
  }

  return currentPos
}

function getOutlineState(): RichTextEditorOutlineState {
  return {
    items: outlineItems.value.map((item) => ({ ...item })),
    activePos: activeOutlinePos.value,
  }
}

function notifyOutlineChange() {
  const state = getOutlineState()
  const stateKey = JSON.stringify(state)

  if (stateKey === lastOutlineStateKey) {
    return
  }

  lastOutlineStateKey = stateKey
  emit('outline-change', state)
  outlineChangeListeners.forEach((handler) => handler(state))
}

function syncOutlineState() {
  const items = collectOutlineItems()
  outlineItems.value = items
  activeOutlinePos.value = findActiveOutlinePos(items)
  notifyOutlineChange()
}

function syncViewportWidth() {
  viewportWidth.value = window.innerWidth
  viewportHeight.value = window.innerHeight
}

function syncLocalizedUiLabels() {
  if (!rootRef.value) {
    return
  }

  const insertButtonLabel = rootRef.value.querySelector(
    '.norio-office-rich-toolbar__group--insert .norio-office-rich-toolbar__button--select .norio-office-rich-toolbar__label',
  )
  if (insertButtonLabel) {
    insertButtonLabel.textContent = insertLabel.value
  }

  const insertSectionTitles = rootRef.value.querySelectorAll('.norio-office-rich-insert-menu__title')
  let sectionIndex = 0

  if (filteredInsertGeneralItems.value.length && insertSectionTitles[sectionIndex]) {
    insertSectionTitles[sectionIndex].textContent = insertSectionGeneralLabel.value
    sectionIndex += 1
  }

  if (filteredInsertAppItems.value.length && insertSectionTitles[sectionIndex]) {
    insertSectionTitles[sectionIndex].textContent = insertSectionAppsLabel.value
    sectionIndex += 1
  }

  if (filteredInsertExternalItems.value.length && insertSectionTitles[sectionIndex]) {
    insertSectionTitles[sectionIndex].textContent = insertSectionExternalLabel.value
  }

  const quoteCurrentButton = rootRef.value.querySelector('.norio-office-rich-toolbar__menu--quote .norio-office-rich-color-menu__current')
  if (quoteCurrentButton) {
    quoteCurrentButton.textContent = quoteToggleLabel.value
  }

  const quoteLabels = rootRef.value.querySelectorAll('.norio-office-rich-toolbar__menu--quote .norio-office-rich-color-menu__label')
  if (quoteLabels[0]) {
    quoteLabels[0].textContent = quoteBorderColorLabel.value
  }
  if (quoteLabels[1]) {
    quoteLabels[1].textContent = quoteBackgroundColorLabel.value
  }

  const presentationStatusLabel = rootRef.value.querySelector('.norio-office-rich-statusbar__label--presentation')
  if (presentationStatusLabel) {
    presentationStatusLabel.textContent = presentationLabel.value
  }

  const fullscreenStatusLabel = rootRef.value.querySelector('.norio-office-rich-statusbar__label--fullscreen')
  if (fullscreenStatusLabel) {
    fullscreenStatusLabel.textContent = fullscreenLabel.value
  }

  const statusCount = rootRef.value.querySelector('.norio-office-rich-statusbar__word-count span')
  if (statusCount) {
    statusCount.textContent = wordCountLabel.value
  }

  const statusLineCount = rootRef.value.querySelector('.norio-office-rich-statusbar__line-count span')
  if (statusLineCount) {
    statusLineCount.textContent = lineCountLabel.value
  }
}

const zoomScale = computed(() => (zoom.value / 100) * previewFitScale.value)
const pageStageStyle = computed(() => ({
  '--norio-office-rich-page-width': `${pageBaseWidth}px`,
  '--norio-office-rich-page-height': `${pageBaseHeight}px`,
  '--norio-office-rich-page-scale': String(zoomScale.value),
}))
const normalizedWatermark = computed<Required<RichTextEditorWatermarkOptions> | null>(() => {
  if (!isWatermarkFeatureEnabled.value) {
    return null
  }

  const text = String(props.watermark?.text ?? '').trim()

  if (!text) {
    return null
  }

  return {
    text,
    color: props.watermark?.color || 'rgba(15, 23, 42, 0.12)',
    fontSize: Math.max(12, Math.min(96, Number(props.watermark?.fontSize ?? 18) || 18)),
    rotate: Math.max(-90, Math.min(90, Number(props.watermark?.rotate ?? -24) || -24)),
    showInEdit: props.watermark?.showInEdit ?? true,
  }
})
const shouldShowWatermark = computed(() => {
  if (!normalizedWatermark.value) {
    return false
  }

  return !editorEditable.value || normalizedWatermark.value.showInEdit
})
const watermarkStyle = computed(() => {
  const watermark = normalizedWatermark.value

  if (!watermark) {
    return {}
  }

  return {
    '--norio-office-rich-watermark-color': watermark.color,
    '--norio-office-rich-watermark-font-size': `${watermark.fontSize}px`,
    '--norio-office-rich-watermark-rotate': `${watermark.rotate}deg`,
  }
})
const watermarkTiles = Array.from({ length: 96 }, (_, index) => index)

const shouldHideBlockSideControls = computed(() => {
  selectionStateVersion.value
  const selection = editor.value?.state.selection
  const hasRangeSelection = selection && !(selection instanceof NodeSelection) && !selection.empty
  const hasNodeBubble = selection instanceof NodeSelection
    && ['imageBlock', 'videoBlock', 'linkBlock', 'table'].includes(selection.node.type.name)
  return !editorEditable.value || isBlockSideInteractionActive.value || isEditorTyping.value || isEditorComposing.value
    || hasNativeEditorSelection.value || isTextSelectionBubbleVisible.value || isTableSelectionBubbleVisible.value
    || isSlashPopupOpen.value
    || !!marqueeGestureStart.value || hasMarqueeSelection.value || !!hasRangeSelection || hasNodeBubble
})
const visibleBlockSideControl = computed(() =>
  shouldHideBlockSideControls.value ? null : activeBlockSideControl.value ?? hoveredBlockSideControl.value,
)
watch(shouldHideBlockSideControls, (hidden) => {
  if (!hidden) return
  closeBlockSideMenu()
  hoveredBlockSideControl.value = null
}, { flush: 'sync' })
watch(isTableSelectionBubbleVisible, (visible) => {
  if (visible) return
  isTableActionColorMenuOpen.value = false
  isTableThemeMenuOpen.value = false
})
const visibleBlockTransformActions = computed(() => {
  const control = visibleBlockSideControl.value
  return control && canShowBlockTransforms(control) ? blockTransformActions : []
})
const currentBlockTransformAction = computed(() => {
  const node = visibleBlockSideControl.value?.node
  if (!node) return null
  if (node.type.name === 'heading') return `heading-${node.attrs.level}`
  const actions: Record<string, string> = {
    paragraph: 'paragraph', bulletList: 'bullet-list', orderedList: 'ordered-list', taskList: 'task-list',
  }
  return actions[node.type.name] ?? null
})
const visibleBlockPropertyActions = computed(() => {
  const control = visibleBlockSideControl.value
  return control && canShowBlockSideAlignIndent(control) ? blockPropertyActions : []
})
const shouldShowBlockSideSubmenu = computed(() => {
  const control = visibleBlockSideControl.value
  if (!control || !blockSideSubmenuMode.value) {
    return false
  }

  if (blockSideSubmenuMode.value === 'properties') {
    return visibleBlockPropertyActions.value.length > 0
  }

  if (blockSideSubmenuMode.value === 'color') {
    return canShowBlockSideColor(control)
  }

  if (blockSideSubmenuMode.value === 'table-theme') {
    return control.node.type.name === 'table' && blockSideTableThemePos.value !== null
  }

  if (blockSideSubmenuMode.value === 'divider-style' || blockSideSubmenuMode.value === 'divider-color') {
    return control.node.type.name === 'horizontalRule'
  }

  if (blockSideSubmenuMode.value?.startsWith('highlight-')) {
    return control.node.type.name === 'highlightBlock' && blockSideTargetPos.value !== null
  }

  if (blockSideSubmenuMode.value?.startsWith('quote-')) {
    return control.node.type.name === 'blockquote' && blockSideTargetPos.value !== null
  }

  return true
})
const blockSideMenuWidth = 246
const blockSideMenuGap = 8
const blockSideMenuMaxHeight = 510
const blockSideMeasuredMenuHeight = ref(0)
let blockSideMenuResizeObserver: ResizeObserver | null = null
watch(blockSideMenuRef, (menu) => {
  blockSideMenuResizeObserver?.disconnect()
  blockSideMenuResizeObserver = null
  blockSideMeasuredMenuHeight.value = 0
  if (!menu) return
  const measure = () => {
    const height = menu.getBoundingClientRect().height / (zoomScale.value || 1)
    if (height > 0) blockSideMeasuredMenuHeight.value = height
  }
  measure()
  blockSideMenuResizeObserver = new ResizeObserver(measure)
  blockSideMenuResizeObserver.observe(menu)
}, { flush: 'post' })
const blockSideAppearanceStacked = computed(() => {
  tableThemeMenuViewportVersion.value
  return Math.min(viewportWidth.value, rootRef.value?.clientWidth ?? viewportWidth.value) < (blockSideMenuWidth + 528 + 32) * zoomScale.value
})
const blockSideControlGap = 10
const blockSideControlHeight = 26
const blockSideControlEmptyWidth = 26
const blockSideControlContentWidth = 48
const blockDragGhostMaxWidth = 560
const blockDragGhostMaxHeight = 220
const blockSideMainMenuHeight = computed(() => {
  if (blockSideMeasuredMenuHeight.value) return blockSideMeasuredMenuHeight.value
  if (blockSideMenuMode.value === 'actions') {
    return 380
  }

  if (blockSideMenuMode.value === 'insert') {
    return 680
  }

  return blockSideMenuMaxHeight
})
const blockSideSubmenuWidth = computed(() => (['color', 'divider-color', ...blockSideSurfaceColorModes].includes(blockSideSubmenuMode.value ?? '') ? 264 : blockSideMenuWidth))
const blockSideSubmenuHeight = computed(() => {
  if (blockSideSubmenuMode.value === 'properties') {
    return Math.max(56, visibleBlockPropertyActions.value.length * 48)
  }

  if (blockSideSubmenuMode.value === 'color' || blockSideSubmenuMode.value === 'divider-color') {
    return blockSideSubmenuMode.value === 'color' ? 290 : 438
  }

  if (blockSideSubmenuMode.value === 'divider-style') return 134
  if (blockSideSurfaceColorModes.includes(blockSideSubmenuMode.value ?? '')) return 180
  if (blockSideSubmenuMode.value === 'highlight-settings') return 64

  return 680
})

const blockSideControlPoint = computed(() => {
  tableThemeMenuViewportVersion.value
  const control = visibleBlockSideControl.value
  if (!control) {
    return null
  }

  const lineHeight = control.node.isTextblock ? Number.parseFloat(getComputedStyle(control.dom).lineHeight) : blockSideControlHeight
  const anchorHeight = control.isEmpty ? control.rect.height : Math.min(control.rect.height, lineHeight || blockSideControlHeight)
  const controlWidth = control.isEmpty ? blockSideControlEmptyWidth : blockSideControlContentWidth
  const content = editor.value?.view.dom
  const contentRect = content?.getBoundingClientRect()
  const contentPoint = contentRect ? getPageLocalPoint(contentRect.left, contentRect.top) : null
  // Anchor to the content column, not the indented or aligned block's left edge.
  const contentLeft = content && contentPoint
    ? contentPoint.x + (Number.parseFloat(getComputedStyle(content).paddingLeft) || 0)
    : control.rect.left
  return {
    left: Math.max(contentLeft - (pageRef.value?.clientLeft ?? 0) - controlWidth - blockSideControlGap, 8),
    top: Math.max(control.rect.top - (pageRef.value?.clientTop ?? 0) + (anchorHeight - blockSideControlHeight) / 2, 8),
  }
})

const blockSideControlStyle = computed(() => {
  const point = blockSideControlPoint.value
  return point ? { left: `${point.left}px`, top: `${point.top}px` } : {}
})

function getEditorViewportRect() {
  const main = rootRef.value?.querySelector('.norio-office-rich-editor__main')
  if (main instanceof HTMLElement) {
    const rect = main.getBoundingClientRect()
    const left = Math.max(0, rect.left)
    const top = Math.max(0, rect.top)
    const right = Math.min(viewportWidth.value, rect.right)
    const bottom = Math.min(viewportHeight.value, rect.bottom)
    return new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top))
  }

  return {
    left: 0,
    top: 0,
    right: viewportWidth.value,
    bottom: viewportHeight.value,
    width: viewportWidth.value,
    height: viewportHeight.value,
  } as DOMRect
}

function getMaxPageLocalMenuHeight(height: number) {
  if (!pageRef.value) {
    return height
  }

  const pageRect = pageRef.value.getBoundingClientRect()
  const viewportRect = getEditorViewportRect()
  const scale = zoomScale.value || 1
  const availableHeight = Math.max((viewportRect.bottom - viewportRect.top - 16) / scale, 120)
  return Math.min(height, availableHeight)
}

function clampPagePointToViewport(left: number, top: number, width = blockSideMenuWidth, height = blockSideMenuMaxHeight, constrainHeight = true) {
  if (!pageRef.value) {
    return { left, top }
  }

  const pageRect = pageRef.value.getBoundingClientRect()
  const viewportRect = getEditorViewportRect()
  const scale = zoomScale.value || 1
  const clampedHeight = constrainHeight ? getMaxPageLocalMenuHeight(height) : height
  const originLeft = pageRect.left + pageRef.value.clientLeft * scale
  const originTop = pageRect.top + pageRef.value.clientTop * scale
  const minLeft = (viewportRect.left + 8 - originLeft) / scale
  const maxLeft = (viewportRect.right - 8 - originLeft) / scale - width
  const minTop = (viewportRect.top + 8 - originTop) / scale
  const maxTop = (viewportRect.bottom - 8 - originTop) / scale - clampedHeight

  return {
    left: Math.min(Math.max(left, Math.min(minLeft, maxLeft)), Math.max(minLeft, maxLeft)),
    top: constrainHeight
      ? Math.min(Math.max(top, Math.min(minTop, maxTop)), Math.max(minTop, maxTop))
      : Math.max(minTop, Math.min(top, Math.max(minTop, maxTop))),
  }
}

const blockSideMenuPoint = computed(() => {
  tableThemeMenuViewportVersion.value
  const control = visibleBlockSideControl.value
  const controlPoint = blockSideMenuMode.value === 'actions'
    ? blockSideMenuAnchorPoint.value ?? blockSideControlPoint.value
    : blockSideControlPoint.value
  if (!control || !controlPoint) {
    return null
  }

  const controlWidth = control.isEmpty ? blockSideControlEmptyWidth : blockSideControlContentWidth
  const controlLeft = controlPoint.left
  const controlTop = controlPoint.top
  const leftCandidate = controlLeft - blockSideMenuWidth - blockSideMenuGap
  const rightCandidate = controlLeft + controlWidth + blockSideMenuGap
  const pageRect = pageRef.value?.getBoundingClientRect()
  const scale = zoomScale.value || 1
  const hasLeftSpace = pageRect ? pageRect.left + leftCandidate * scale >= 8 : leftCandidate >= 8

  return clampPagePointToViewport(
    hasLeftSpace ? leftCandidate : rightCandidate,
    blockSideMenuMode.value === 'actions'
      ? controlTop + (blockSideControlHeight - blockSideMainMenuHeight.value) / 2
      : control.isEmpty ? controlTop + blockSideControlHeight + blockSideMenuGap : controlTop,
    blockSideMenuWidth,
    blockSideMainMenuHeight.value,
    false,
  )
})

const blockSideMenuStyle = computed(() => {
  if (!blockSideMenuPoint.value) {
    return {}
  }

  return {
    left: `${blockSideMenuPoint.value.left}px`,
    top: `${blockSideMenuPoint.value.top}px`,
  }
})

const blockSideSubmenuStyle = computed(() => {
  tableThemeMenuViewportVersion.value
  const control = visibleBlockSideControl.value
  const mainPoint = blockSideMenuPoint.value
  if (!control || !mainPoint || !pageRef.value) {
    return {}
  }

  const pageRect = pageRef.value.getBoundingClientRect()
  const scale = zoomScale.value || 1
  const submenuWidth = blockSideSubmenuWidth.value
  if (blockSideAppearanceStacked.value && blockSideStackedMenuModes.includes(blockSideSubmenuMode.value ?? '')) {
    return getBlockSideStackedMenuStyle(submenuWidth, blockSideSubmenuHeight.value + 42)
  }
  if (['properties', 'color', 'divider-style', 'divider-color', 'highlight-settings', ...blockSideSurfaceColorModes].includes(blockSideSubmenuMode.value ?? '')) {
    const trigger = {
      properties: blockSidePropertiesTriggerRef.value,
      color: blockSideColorTriggerRef.value,
      'divider-style': blockSideDividerStyleTriggerRef.value,
      'divider-color': blockSideDividerColorTriggerRef.value,
      'highlight-border': blockSideSurfaceBorderTriggerRef.value,
      'highlight-fill': blockSideSurfaceFillTriggerRef.value,
      'quote-border': blockSideSurfaceBorderTriggerRef.value,
      'quote-background': blockSideSurfaceFillTriggerRef.value,
      'highlight-settings': blockSideHighlightSettingsTriggerRef.value,
    }[blockSideSubmenuMode.value as 'properties' | 'color' | 'divider-style' | 'divider-color' | 'highlight-border' | 'highlight-fill' | 'highlight-settings' | 'quote-border' | 'quote-background']
    const anchor = trigger?.getBoundingClientRect()
    if (!anchor) return {}
    return getBlockSideAnchoredMenuStyle(anchor, submenuWidth, blockSideSubmenuHeight.value)
  }
  const mainViewportRight = pageRect.left + (mainPoint.left + blockSideMenuWidth) * scale
  const submenuFitsRight = mainViewportRight + submenuWidth * scale <= getEditorViewportRect().right - 8
  const left = submenuFitsRight
    ? mainPoint.left + blockSideMenuWidth
    : mainPoint.left - submenuWidth
  const top = ['add-above', 'add-below'].includes(blockSideSubmenuMode.value ?? '') ? mainPoint.top : mainPoint.top + 42
  const point = clampPagePointToViewport(left, top, submenuWidth, blockSideSubmenuHeight.value)

  return {
    left: `${point.left}px`,
    top: `${point.top}px`,
    width: `${submenuWidth}px`,
    maxHeight: `${getMaxPageLocalMenuHeight(blockSideSubmenuHeight.value)}px`,
  }
})

function getBlockSideStackedMenuStyle(menuWidth: number, menuHeight: number) {
  const point = blockSideMenuPoint.value
  if (!pageRef.value || !point) return {}
  const page = pageRef.value.getBoundingClientRect()
  const scale = zoomScale.value || 1
  const viewport = getEditorViewportRect()
  const leftEdge = Math.max(0, viewport.left) + 8
  const rightEdge = Math.min(viewportWidth.value, viewport.right) - 8
  const topEdge = Math.max(0, viewport.top) + 8
  const bottomEdge = Math.min(viewportHeight.value, viewport.bottom) - 8
  const width = Math.min(menuWidth, Math.max(0, (rightEdge - leftEdge) / scale))
  const maxHeight = Math.max(0, (bottomEdge - topEdge) / scale)
  const left = Math.max(leftEdge, Math.min(page.left + point.left * scale, rightEdge - width * scale))
  const top = Math.max(topEdge, Math.min(page.top + point.top * scale, bottomEdge - Math.min(menuHeight, maxHeight) * scale))
  return { left: `${(left - page.left) / scale}px`, top: `${(top - page.top) / scale}px`, width: `${width}px`, maxHeight: `${maxHeight}px` }
}

function getBlockSideAnchoredMenuStyle(anchor: DOMRect, menuWidth: number, menuHeight: number) {
  if (!pageRef.value) return {}
  const pageRect = pageRef.value.getBoundingClientRect()
  const scale = zoomScale.value || 1
  const viewport = getEditorViewportRect()
  const leftEdge = Math.max(0, viewport.left) + 8
  const rightEdge = Math.min(viewportWidth.value, viewport.right) - 8
  const topEdge = Math.max(0, viewport.top) + 8
  const bottomEdge = Math.min(viewportHeight.value, viewport.bottom) - 8
  const width = Math.min(menuWidth, Math.max(0, (rightEdge - leftEdge) / scale))
  const maxHeight = Math.max(0, (bottomEdge - topEdge) / scale)
  const height = Math.min(menuHeight, maxHeight)
  const right = anchor.right + blockSideMenuGap * scale
  const preferredLeft = right + width * scale <= rightEdge ? right : anchor.left - (width + blockSideMenuGap) * scale
  const left = Math.max(leftEdge, Math.min(preferredLeft, rightEdge - width * scale))
  const top = Math.max(topEdge, Math.min(anchor.top, bottomEdge - height * scale))
  return {
    left: `${(left - pageRect.left) / scale}px`, top: `${(top - pageRect.top) / scale}px`,
    width: `${width}px`, maxHeight: `${maxHeight}px`,
  }
}

const blockSideCustomColorStyle = computed(() => {
  tableThemeMenuViewportVersion.value
  if (blockSideAppearanceStacked.value) return getBlockSideStackedMenuStyle(264, 460)
  const anchor = blockSideCustomColorTriggerRef.value?.getBoundingClientRect()
  return anchor ? getBlockSideAnchoredMenuStyle(anchor, 264, 400) : {}
})

const blockDragGhostStyle = computed(() => {
  const ghost = blockDragGhost.value
  if (!ghost) {
    return {}
  }

  return {
    left: `${ghost.left}px`,
    top: `${ghost.top}px`,
    width: `${ghost.width}px`,
    height: `${ghost.height}px`,
    '--norio-office-rich-block-drag-ghost-scale': String(ghost.scale),
    '--norio-office-rich-block-drag-ghost-source-width': `${ghost.sourceWidth}px`,
    '--norio-office-rich-block-drag-ghost-source-height': `${ghost.sourceHeight}px`,
  }
})

const characterCount = computed(() => {
  const text = editor.value?.getText() ?? ''
  return text.replace(/\s+/g, '').length
})

const lineCount = computed(() => {
  const text = editor.value?.getText() ?? ''
  return Math.max(1, text.split(/\n+/).filter(Boolean).length)
})

const headingLevel = computed(() => {
  selectionStateVersion.value
  if (!editor.value) {
    return '正文'
  }

  for (const option of headingOptions) {
    if (!option.level) {
      continue
    }

    if (editor.value.isActive('heading', { level: option.level })) {
      return `标题 ${option.level}`
    }
  }

  return '正文'
})

const scriptDisplay = computed(() => {
  selectionStateVersion.value
  if (editor.value?.isActive('superscript')) {
    return { icon: 'shangbiao', text: '' }
  }

  if (editor.value?.isActive('subscript')) {
    return { icon: 'xiabiao', text: '' }
  }

  return { icon: '', text: 'AV' }
})

const currentFontSize = computed(() => {
  selectionStateVersion.value
  const fontSize = editor.value?.getAttributes('textStyle').fontSize as string | undefined
  if (!fontSize) {
    return '小四'
  }

  const matched = fontSizeOptions.find((option) => option.value === fontSize)
  return matched?.label ?? fontSize.replace('px', '')
})

const currentFontFamily = computed(() => {
  selectionStateVersion.value
  const fontFamily = editor.value?.getAttributes('textStyle').fontFamily as string | undefined
  if (!fontFamily) {
    return '默认'
  }

  const matched = fontFamilyOptions.find((option) => option.value === fontFamily)
  return matched?.label ?? '默认'
})

const currentTextAlign = computed<'left' | 'center' | 'right'>(() => {
  selectionStateVersion.value
  if (editor.value?.isActive('heading')) {
    const align = editor.value.getAttributes('heading').textAlign as 'left' | 'center' | 'right' | undefined
    return align || 'left'
  }

  const align = editor.value?.getAttributes('paragraph').textAlign as 'left' | 'center' | 'right' | undefined
  return align || 'left'
})

const currentTextColor = computed(() => {
  selectionStateVersion.value
  const color = editor.value?.getAttributes('textStyle').color as string | undefined
  return color || '#333333'
})

const currentHighlightColor = computed(() => {
  selectionStateVersion.value
  const color = editor.value?.getAttributes('textStyle').backgroundColor as string | undefined
  return color || '#FFF3C4'
})

const currentQuoteBorderColor = computed(() => {
  const color = editor.value?.getAttributes('blockquote').quoteBorderColor as string | undefined
  return color || quoteBorderColors[0]
})

const currentQuoteBackgroundColor = computed(() => {
  const color = editor.value?.getAttributes('blockquote').quoteBackgroundColor as string | undefined
  return color || quoteBackgroundColors[0]
})

const currentTableSelection = computed(() => {
  selectionStateVersion.value
  if (!editor.value?.isActive('table')) {
    return {
      isCellSelection: false,
      isRowSelection: false,
      isColumnSelection: false,
    }
  }

  const selection = editor.value.state.selection
  const isCellSelection = selection instanceof CellSelection
  const isRowSelection = isCellSelection && selection.isRowSelection()
  const isColumnSelection = isCellSelection && selection.isColSelection()

  return {
    isCellSelection,
    isRowSelection,
    isColumnSelection,
  }
})

const currentTableCellBackgroundColor = computed<string | null>(() => {
  selectionStateVersion.value
  if (!editor.value?.isActive('table')) {
    return null
  }

  try {
    const $cell = selectionCell(editor.value.state)
    return ($cell.nodeAfter?.attrs.backgroundColor as string | undefined) || null
  } catch {
    return null
  }
})

const currentTableTheme = computed(() => {
  selectionStateVersion.value
  return normalizeTableTheme(editor.value?.getAttributes('table').tableTheme)
})

const blockSideTableTheme = computed(() => {
  selectionStateVersion.value
  const pos = blockSideTableThemePos.value
  const node = pos === null ? null : editor.value?.state.doc.nodeAt(pos)
  return node?.type.name === 'table' ? normalizeTableTheme(node.attrs.tableTheme) : null
})

const blockSideTableThemeStyle = computed(() => {
  selectionStateVersion.value
  tableThemeMenuViewportVersion.value
  if (blockSideSubmenuMode.value !== 'table-theme' || !blockSideTableThemeTriggerRef.value || !pageRef.value) return {}
  const anchor = blockSideTableThemeTriggerRef.value.getBoundingClientRect()
  const page = pageRef.value.getBoundingClientRect()
  const editorViewport = getEditorViewportRect()
  const leftEdge = Math.max(0, editorViewport.left) + 8
  const rightEdge = Math.min(viewportWidth.value, editorViewport.right) - 8
  const topEdge = Math.max(0, editorViewport.top) + 8
  const bottomEdge = Math.min(viewportHeight.value, editorViewport.bottom) - 8
  const scale = zoomScale.value || 1
  const width = Math.min(360, (rightEdge - leftEdge) / scale)
  const maxHeight = Math.max(120, (bottomEdge - topEdge) / scale)
  const height = Math.min(tableThemeMenuHeight.value, maxHeight)
  const right = anchor.right + 8 * scale
  const preferredLeft = right + width * scale <= rightEdge ? right : anchor.left - (width + 8) * scale
  const left = Math.max(leftEdge, Math.min(preferredLeft, rightEdge - width * scale))
  const top = Math.max(topEdge, Math.min(anchor.top, bottomEdge - height * scale))
  return {
    left: `${(left - page.left) / scale}px`, top: `${(top - page.top) / scale}px`,
    width: `${width}px`, maxHeight: `${maxHeight}px`,
  }
})

const tableThemeMenuStyle = computed(() => {
  selectionStateVersion.value
  tableThemeMenuViewportVersion.value
  if (!isTableThemeMenuOpen.value || !tableThemeMenuRef.value) return {}
  const anchor = tableThemeMenuRef.value.getBoundingClientRect()
  const editorViewport = getEditorViewportRect()
  const viewport = {
    left: Math.max(0, editorViewport.left),
    right: Math.min(viewportWidth.value, editorViewport.right),
    top: Math.max(0, editorViewport.top),
    bottom: Math.min(viewportHeight.value, editorViewport.bottom),
  }
  const scale = zoomScale.value || 1
  const width = Math.min(360, (viewport.right - viewport.left - 16) / scale)
  const maxHeight = Math.max(120, (viewport.bottom - viewport.top - 16) / scale)
  const height = Math.min(tableThemeMenuHeight.value, maxHeight)
  const below = anchor.bottom + 8 * scale
  const preferredTop = below + height * scale <= viewport.bottom - 8 ? below : anchor.top - (height + 8) * scale
  const top = Math.max(viewport.top + 8, Math.min(preferredTop, viewport.bottom - 8 - height * scale))
  const left = Math.max(viewport.left + 8, Math.min(anchor.left, viewport.right - 8 - width * scale))
  return {
    left: `${(left - anchor.left) / scale}px`,
    top: `${(top - anchor.top) / scale}px`,
    width: `${width}px`,
    maxHeight: `${maxHeight}px`,
  }
})


const currentBlockSideHighlightAttrs = computed(() => {
  selectionStateVersion.value
  const pos = blockSideTargetPos.value
  const node = pos === null ? null : editor.value?.state.doc.nodeAt(pos)
  const attrs = node?.type.name === 'highlightBlock' ? node.attrs : {}
  return {
    borderColor: String(attrs.borderColor ?? highlightBlockDefaultBorderColor),
    backgroundColor: String(attrs.backgroundColor ?? highlightBlockDefaultBackgroundColor),
    emojiEnabled: attrs.emojiEnabled !== false,
  }
})

const currentBlockSideTextColors = computed(() => {
  selectionStateVersion.value
  const control = activeBlockSideControl.value
  const node = control && editor.value?.state.doc.nodeAt(control.pos)
  const colors: { text: string | null; background: string | null } = { text: null, background: null }
  let found = false
  node?.descendants(child => {
    if (!child.isText || found) return
    const mark = child.marks.find(mark => mark.type.name === 'textStyle')
    colors.text = mark?.attrs.color ?? null
    colors.background = mark?.attrs.backgroundColor ?? null
    found = true
  })
  return colors
})

const blockSidePropertyTargets = computed(() => {
  const control = visibleBlockSideControl.value
  return control ? getBlockSidePropertyTargets(control) : []
})
const currentBlockSideAlignment = computed(() => {
  const alignments = blockSidePropertyTargets.value.map(({ node }) => node.attrs.textAlign || 'left')
  return alignments.every(value => value === alignments[0]) ? alignments[0] || 'left' : ''
})
const canIncreaseBlockSideIndent = computed(() => blockSidePropertyTargets.value.some(({ node }) => Number(node.attrs.indent ?? 0) < 8))
const canDecreaseBlockSideIndent = computed(() => blockSidePropertyTargets.value.some(({ node }) => Number(node.attrs.indent ?? 0) > 0))

const currentBlockSideDividerStyle = computed(() => normalizeDividerStyle(visibleBlockSideControl.value?.node.attrs.lineStyle))
const currentBlockSideDividerColor = computed(() => normalizeDividerColor(visibleBlockSideControl.value?.node.attrs.lineColor) ?? dividerDefaultColor)

const currentCountdownBlockAttrs = computed(() => {
  const attrs = editor.value?.getAttributes('countdownBlock') ?? {}

  return {
    mode: attrs.mode === 'duration' ? 'duration' : 'deadline',
    targetTimestamp: Number(attrs.targetTimestamp ?? 0) || 0,
  }
})

function canRunEditorCommand(run: (instance: NonNullable<typeof editor.value>) => boolean) {
  selectionStateVersion.value
  try {
    return !!editor.value && run(editor.value)
  } catch {
    return false
  }
}

function canRunTableCommand(run: () => boolean) {
  selectionStateVersion.value
  try {
    return run()
  } catch {
    return false
  }
}

const canMergeSelectedTableCells = computed(() =>
  !!editor.value && canRunTableCommand(() => editor.value!.can().chain().focus().mergeCells().run()),
)

const canSplitSelectedTableCell = computed(() =>
  !!editor.value && canRunTableCommand(() => editor.value!.can().chain().focus().splitCell().run()),
)

const canUndo = computed(() => canRunEditorCommand((instance) => instance.can().chain().focus().undo().run()))
const canRedo = computed(() => canRunEditorCommand((instance) => instance.can().chain().focus().redo().run()))
const canClearFormatting = computed(() =>
  canRunEditorCommand((instance) => instance.can().chain().focus().unsetAllMarks().clearNodes().run()),
)
const canCreateComment = computed(() => {
  selectionStateVersion.value

  return isCommentFeatureEnabled.value && props.showComments && !!editor.value && editorEditable.value && !!activeCommentUser.value
})
const canOpenHeadingMenu = computed(() =>
  canRunEditorCommand((instance) => instance.can().chain().focus().setParagraph().run())
    || canRunEditorCommand((instance) => instance.can().chain().focus().toggleHeading({ level: 1 }).run()),
)
const canOpenFontFamilyMenu = computed(() =>
  canRunEditorCommand((instance) => instance.can().chain().focus().setFontFamily(fontFamilyOptions[1]?.value ?? '').run())
    || canRunEditorCommand((instance) => instance.can().chain().focus().unsetFontFamily().run()),
)
const canOpenFontSizeMenu = computed(() =>
  canRunEditorCommand((instance) => instance.can().chain().focus().setFontSize(fontSizeOptions[0]?.value ?? '16px').run()),
)
const canOpenTextColorMenu = computed(() =>
  canRunEditorCommand((instance) => instance.can().chain().focus().setColor('#333333').run()),
)
const canOpenHighlightMenu = computed(() =>
  canRunEditorCommand((instance) => instance.can().chain().focus().setBackgroundColor('#FFF3C4').run()),
)
const canToggleBold = computed(() => canRunEditorCommand((instance) => instance.can().chain().focus().toggleBold().run()))
const canToggleItalic = computed(() => canRunEditorCommand((instance) => instance.can().chain().focus().toggleItalic().run()))
const canToggleUnderline = computed(() =>
  canRunEditorCommand((instance) => instance.can().chain().focus().toggleUnderline().run()),
)
const canToggleStrike = computed(() => canRunEditorCommand((instance) => instance.can().chain().focus().toggleStrike().run()))
const canOpenScriptMenu = computed(() =>
  canRunEditorCommand((instance) => instance.can().chain().focus().toggleSuperscript().run())
    || canRunEditorCommand((instance) => instance.can().chain().focus().toggleSubscript().run()),
)
const canToggleBulletList = computed(() =>
  canRunEditorCommand((instance) => instance.can().chain().focus().toggleBulletList().run()),
)
const canToggleOrderedList = computed(() =>
  canRunEditorCommand((instance) => instance.can().chain().focus().toggleOrderedList().run()),
)
const canToggleTaskList = computed(() =>
  canRunEditorCommand((instance) => instance.can().chain().focus().toggleTaskList().run()),
)
const canOpenAlignMenu = computed(() =>
  canRunEditorCommand((instance) => instance.can().chain().focus().setTextAlign('left').run())
    || canRunEditorCommand((instance) => instance.can().chain().focus().setTextAlign('center').run())
    || canRunEditorCommand((instance) => instance.can().chain().focus().setTextAlign('right').run()),
)
const canDecreaseIndent = computed(() =>
  canRunEditorCommand((instance) => instance.can().chain().focus().decreaseIndent().run()),
)
const canIncreaseIndent = computed(() =>
  canRunEditorCommand((instance) => instance.can().chain().focus().increaseIndent().run()),
)
const canToggleBlockquote = computed(() =>
  canRunEditorCommand((instance) => instance.can().chain().focus().toggleBlockquote().run()),
)
const canOpenQuoteMenu = computed(() => canToggleBlockquote.value || !!editor.value?.isActive('blockquote'))
const canToggleInlineCode = computed(() =>
  canRunEditorCommand((instance) => instance.can().chain().focus().toggleCode().run()),
)
const textSelectionActions = computed<TextSelectionAction[]>(() => {
  selectionStateVersion.value
  const isActive = (name: string) => !!editor.value?.isActive(name)
  const headingOption = (level?: 1 | 2 | 3 | 4 | 5 | 6): TextSelectionAction => {
    const active = level ? !!editor.value?.isActive('heading', { level }) : isActive('paragraph') && !['bulletList', 'orderedList', 'taskList', 'blockquote', 'highlightBlock'].some(isActive)
    return {
      key: level ? `heading-${level}` : 'paragraph',
      label: level ? `${['一', '二', '三', '四', '五', '六'][level - 1]}级标题` : '正文',
      text: level ? `H${level}` : 'T', active,
      disabled: !active && !canApplyHeading(level), run: () => applyHeading(level),
    }
  }
  const blockTypes: TextSelectionAction[] = [
    headingOption(), headingOption(1), headingOption(2), headingOption(3),
    { key: 'other-headings', label: '其他标题', text: 'Hn', active: [4, 5, 6].some(level => !!editor.value?.isActive('heading', { level })), options: [headingOption(4), headingOption(5), headingOption(6)] },
    { key: 'orderedList', label: '有序列表', icon: 'youxuliebiao', active: isActive('orderedList'), disabled: !canToggleOrderedList.value, run: toggleOrderedList },
    { key: 'bulletList', label: '无序列表', icon: 'wuxuliebiao', active: isActive('bulletList'), disabled: !canToggleBulletList.value, run: toggleBulletList },
    { key: 'taskList', label: '任务', icon: 'To-do', active: isActive('taskList'), disabled: !canToggleTaskList.value, run: toggleTaskList },
  ]
  if (isRichTextCodeEnabled('code-block', activeInsertMenuCodes.value)) blockTypes.push({
    key: 'codeBlock', label: '代码块', icon: 'codeblock', active: isActive('codeBlock'),
    disabled: !canRunEditorCommand(instance => instance.can().chain().focus().toggleCodeBlock().run()),
    run: () => getActiveSelectionChain()?.toggleCodeBlock().run(),
  })
  const containers: TextSelectionAction[] = []
  if (isBlockquoteToolbarEnabled.value) containers.push({ key: 'blockquote', label: '引用', icon: 'yinyong', active: isActive('blockquote'), disabled: !canToggleBlockquote.value, run: () => getActiveSelectionChain()?.toggleBlockquote().run() })
  if (isRichTextCodeEnabled('highlight-block', activeInsertMenuCodes.value)) containers.push({
    key: 'highlightBlock', label: '高亮块', icon: 'gaoliangkuai', active: isActive('highlightBlock'),
    disabled: !canRunEditorCommand(instance => instance.can().chain().focus().toggleWrap('highlightBlock').run()),
    run: () => getActiveSelectionChain()?.toggleWrap('highlightBlock').run(),
  })
  if (containers[0]) containers[0].divider = true
  blockTypes.push(...containers)
  const activeBlock = blockTypes.find(option => option.active && option.key !== 'other-headings')
  return [
    { key: 'heading', label: '正文和标题', icon: activeBlock?.icon, text: activeBlock?.text || (editor.value?.isActive('heading') ? `H${editor.value.getAttributes('heading').level}` : 'T'), disabled: !blockTypes.some(option => option.options ? option.options.some(child => !child.disabled) : !option.disabled),
      options: blockTypes },
    { key: 'font', label: '字体', text: currentFontFamily.value, disabled: !canOpenFontFamilyMenu.value,
      options: fontFamilyOptions.map(option => ({ key: option.label, label: option.label, fontFamily: option.value, active: currentFontFamily.value === option.label, disabled: !canApplyFontFamily(option.value), run: () => applyFontFamily(option.value) })) },
    { key: 'size', label: '字号', text: currentFontSize.value, disabled: !canOpenFontSizeMenu.value,
      options: fontSizeOptions.map(option => ({ key: option.label, label: option.label, active: currentFontSize.value === option.label, disabled: !canApplyFontSize(option.value), run: () => applyFontSize(option.value) })) },
    { key: 'text-color', label: '文字颜色', color: currentTextColor.value, defaultColor: '#333333', recentColors: recentColors.value, setColor: applyTextColor, disabled: !canOpenTextColorMenu.value },
    { key: 'background-color', label: '文字背景颜色', icon: 'beijingse', color: currentHighlightColor.value, defaultColor: '#FFF3C4', recentColors: recentHighlightColors.value, setColor: applyHighlightColor, disabled: !canOpenHighlightMenu.value },
    { key: 'bold', label: '加粗', icon: 'jiacu', active: isActive('bold'), disabled: !canToggleBold.value, run: toggleBold },
    { key: 'italic', label: '斜体', icon: 'xieti', active: isActive('italic'), disabled: !canToggleItalic.value, run: toggleItalic },
    { key: 'underline', label: '下划线', icon: 'xiahuaxian', active: isActive('underline'), disabled: !canToggleUnderline.value, run: toggleUnderline },
    { key: 'strike', label: '删除线', text: 'S', active: isActive('strike'), disabled: !canToggleStrike.value, run: toggleStrike },
    { key: 'script', label: '上下标', icon: scriptDisplay.value.icon || undefined, text: scriptDisplay.value.text, active: isActive('superscript') || isActive('subscript'), disabled: !canOpenScriptMenu.value,
      options: [{ key: 'superscript', label: '上标', icon: 'shangbiao', active: isActive('superscript'), disabled: !canApplySuperscript(), run: applySuperscript }, { key: 'subscript', label: '下标', icon: 'xiabiao', active: isActive('subscript'), disabled: !canApplySubscript(), run: applySubscript }] },
    { key: 'alignment', label: '对齐和缩进', icon: currentTextAlign.value === 'center' ? 'juzhongduiqi' : currentTextAlign.value === 'right' ? 'youduiqi' : 'zuoduiqi', disabled: !canOpenAlignMenu.value,
      options: [
        ...(['left', 'center', 'right'] as const).map((alignment, index) => ({ key: alignment, label: ['左对齐', '居中对齐', '右对齐'][index], icon: ['zuoduiqi', 'juzhongduiqi', 'youduiqi'][index], active: currentTextAlign.value === alignment, disabled: !canApplyTextAlign(alignment), run: () => applyTextAlign(alignment) })),
        { key: 'indent-more', label: '增加缩进', icon: 'yousuojin', divider: true, disabled: !canIncreaseIndent.value, run: increaseIndent },
        { key: 'indent-less', label: '减少缩进', icon: 'zuosuojin', disabled: !canDecreaseIndent.value, run: decreaseIndent },
      ] },
    { key: 'code', label: '行内代码', icon: 'code', active: isActive('code'), disabled: !canToggleInlineCode.value, run: toggleInlineCode },
    { key: 'clear', label: '清除格式', icon: 'rubber', disabled: !canClearFormatting.value, run: clearFormatting },
  ]
})
const tableSelectionActions = computed(() =>
  textSelectionActions.value.filter(action => !['heading', 'script', 'code', 'clear'].includes(action.key)),
)
const canApplyTableCellBackground = computed(() => !!editor.value?.isActive('table'))
const hasSelectedTableText = computed(() => {
  selectionStateVersion.value
  return editor.value?.state.selection instanceof TextSelection && !editor.value.state.selection.empty && editor.value.isActive('table')
})
const canInsertRowAround = computed(() => currentTableSelection.value.isRowSelection || hasSelectedTableText.value)
const canInsertColumnAround = computed(() => currentTableSelection.value.isColumnSelection || hasSelectedTableText.value)
const canDeleteTableSelection = computed(() =>
  !!editor.value?.isActive('table')
    && (currentTableSelection.value.isRowSelection || currentTableSelection.value.isColumnSelection || currentTableSelection.value.isCellSelection),
)

const tableAddRowStyle = computed(() => {
  const metrics = activeTableMetrics.value
  if (!metrics) {
    return undefined
  }

  return {
    left: `${metrics.left + metrics.width / 2}px`,
    top: `${metrics.top + metrics.height + 12}px`,
  }
})

function createImagePlaceholderId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `image-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

type ResolvedEditorUpload = Required<Pick<RichTextEditorUploadResult, 'url' | 'name' | 'size' | 'mimeType'>> &
	Pick<RichTextEditorUploadResult, 'assetId' | 'alt' | 'description'>

type InternalUploadRequestDetail = {
  kind: 'image' | 'video' | 'file'
  file: File
  handled: boolean
  resolve: (result: ResolvedEditorUpload) => void
  reject: (error: unknown) => void
}

function normalizeUploadResult(file: File, result: RichTextEditorUploadResult): ResolvedEditorUpload {
	return {
		assetId: result.assetId,
		url: result.url,
    name: result.name || file.name,
    size: result.size ?? file.size,
    mimeType: result.mimeType || file.type || '',
    alt: result.alt,
    description: result.description,
  }
}

function handleUploadError(payload: RichTextEditorUploadErrorPayload) {
  uploadErrorRef.value?.(payload)
  emit('upload-error', payload)
}

function createUploadTaskId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function getUploadErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : '上传失败，请重试。'
}

function getUploadKindLabel(kind: EditorUploadKind) {
  if (kind === 'image') {
    return '图片'
  }

  if (kind === 'video') {
    return '视频'
  }

  return '文件'
}

function getUploadTaskStatusText(task: EditorUploadTask) {
  return `${getUploadKindLabel(task.kind)}${task.status === 'uploading' ? '上传中' : '上传失败'}`
}

function removeUploadTask(taskId: string) {
  uploadTasks.value = uploadTasks.value.filter((task) => task.id !== taskId)
}

function updateUploadTask(taskId: string, patch: Partial<Pick<EditorUploadTask, 'status' | 'message'>>) {
  uploadTasks.value = uploadTasks.value.map((task) => (task.id === taskId ? { ...task, ...patch } : task))
}

async function runEditorUploadTask<T>(
  kind: EditorUploadKind,
  fileName: string,
  executor: () => Promise<T>,
  reportError: (error: unknown) => void,
) {
  const taskId = createUploadTaskId()
  const task: EditorUploadTask = {
    id: taskId,
    kind,
    fileName,
    status: 'uploading',
    retry: () => undefined,
  }

  const execute = async () => {
    updateUploadTask(taskId, { status: 'uploading', message: undefined })

    try {
      const result = await executor()
      removeUploadTask(taskId)
      return result
    } catch (error) {
      updateUploadTask(taskId, { status: 'error', message: getUploadErrorMessage(error) })
      reportError(error)
      return null
    }
  }

  task.retry = () => {
    void execute()
  }

  uploadTasks.value = [task, ...uploadTasks.value]
  return await execute()
}

async function resolveUploadFile(file: File, kind: EditorUploadKind): Promise<ResolvedEditorUpload> {
  const hook = kind === 'image' ? uploadImageRef.value : kind === 'video' ? uploadVideoRef.value : uploadFileRef.value

  if (hook) {
    const result = await hook({ file, kind })
    return normalizeUploadResult(file, result)
  }

  throw new Error(`Missing upload${kind[0].toUpperCase()}${kind.slice(1)} hook.`)
}

function handleInternalUploadRequest(event: Event) {
  const uploadEvent = event as CustomEvent<InternalUploadRequestDetail>
  const detail = uploadEvent.detail

  if (!detail?.file || !detail.kind) {
    return
  }

  uploadEvent.stopPropagation()
  detail.handled = true
  resolveUploadFile(detail.file, detail.kind).then(detail.resolve, detail.reject)
}

function createExportFileName(extension: 'pdf' | 'png' | 'html') {
  const normalizedDocumentName = String(props.documentName ?? '未命名文档')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\.+$/g, '')

  return `${normalizedDocumentName || '未命名文档'}.${extension}`
}

function escapeHtmlText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildExportPageClone() {
  if (!pageRef.value) {
    return null
  }

  const pageClone = pageRef.value.cloneNode(true) as HTMLElement
  // Edit-mode images use inert wrappers; exports restore the confirmed links.
  pageClone.querySelectorAll<HTMLElement>('.norio-office-rich-image-block__image-link[data-image-link]').forEach(element => {
    const link = document.createElement('a')
    link.className = element.className
    link.href = element.dataset.imageLink ?? ''
    link.target = element.dataset.imageLinkTarget === '_self' ? '_self' : '_blank'
    link.rel = 'noreferrer noopener'
    link.append(...Array.from(element.childNodes))
    element.replaceWith(link)
  })
  pageClone.querySelectorAll<HTMLElement>('.norio-office-rich-image-block__caption-desc').forEach(element => {
    element.removeAttribute('hidden')
    if (!element.textContent) element.closest('.norio-office-rich-image-block__caption')?.remove()
  })
  pageClone.style.transform = 'none'
  pageClone.style.transformOrigin = 'top left'
  pageClone.style.boxShadow = 'none'
  pageClone.style.margin = '0'
  pageClone.style.width = `${pageBaseWidth}px`
  pageClone.style.minHeight = `${Math.max(pageRef.value.scrollHeight, pageBaseHeight)}px`
  pageClone.style.height = 'auto'

  pageClone.querySelectorAll(
    [
      '.norio-office-rich-table-column-track',
      '.norio-office-rich-table-row-track',
      '.norio-office-rich-table-add-row',
      '.norio-office-rich-table-add-column',
      '.norio-office-rich-columns__overlay',
      '.norio-office-rich-table-bubble-menu',
      '.norio-office-rich-countdown-bubble-menu',
      '.norio-office-rich-code-block__toolbar',
      '.norio-office-rich-code-block__menu',
      '.norio-office-rich-code-block__settings-menu',
      '.norio-office-rich-code-block__line-numbers',
      '.norio-office-rich-image-block__toolbar',
      '.norio-office-rich-video-block__toolbar',
      '.norio-office-rich-link-block__toolbar',
      '.norio-office-rich-local-file-block__actions',
      '.norio-office-rich-countdown-block__actions',
      '.norio-office-rich-block-side-control',
      '.norio-office-rich-block-side-menu',
      '.norio-office-rich-block-side-submenu',
      '.norio-office-rich-drag-insert-indicator',
      '.norio-office-rich-upload-panel',
      '.column-resize-handle',
      '.ProseMirror-gapcursor',
      '.norio-office-rich-video-block',
      '[data-type="video-block"]',
      '.norio-office-rich-formula-editor',
      '.norio-office-rich-marquee-selection-layer',
      '.collaboration-carets__caret',
      '.collaboration-carets__label',
      '[aria-hidden="true"]',
      'button',
      'input',
      'textarea',
      'select',
    ].join(', '),
  ).forEach((element) => {
    element.remove()
  })

  pageClone.querySelectorAll<HTMLElement>('[contenteditable]').forEach((element) => {
    element.removeAttribute('contenteditable')
    element.removeAttribute('tabindex')
    element.removeAttribute('spellcheck')
    element.removeAttribute('autocapitalize')
    element.removeAttribute('autocorrect')
    element.removeAttribute('data-placeholder')
  })

  pageClone.querySelectorAll<HTMLElement>('.ProseMirror-selectednode').forEach((element) => {
    element.classList.remove('ProseMirror-selectednode')
  })

  pageClone.querySelectorAll<HTMLElement>('.norio-office-rich-formula-block--selected').forEach((element) => {
    element.classList.remove('norio-office-rich-formula-block--selected')
  })

  pageClone.querySelectorAll<HTMLElement>('.collaboration-carets__selection').forEach((element) => {
    element.classList.remove('collaboration-carets__selection')
    element.removeAttribute('data-user')
    element.removeAttribute('style')
  })

  return pageClone
}

async function capturePageCanvas() {
  const pageClone = buildExportPageClone()
  if (!pageClone) {
    return null
  }

  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = '-20000px'
  host.style.top = '0'
  host.style.padding = '0'
  host.style.margin = '0'
  host.style.background = '#ffffff'
  host.style.zIndex = '-1'
  host.appendChild(pageClone)
  document.body.appendChild(host)

  try {
    await nextTick()
    const { default: html2canvas } = await import('html2canvas')
    return await html2canvas(pageClone, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
      width: pageBaseWidth,
      height: pageClone.scrollHeight,
      windowWidth: pageBaseWidth,
      windowHeight: pageClone.scrollHeight,
    })
  } finally {
    host.remove()
  }
}

function toggleExportMenu() {
  if (!hasExportMenuItems.value) {
    return
  }

  isExportMenuOpen.value = !isExportMenuOpen.value
}

function handleStatusbarExportKeyDown(event: KeyboardEvent) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  isExportMenuOpen.value = true
  void nextTick(() => {
    const items = Array.from(statusbarExportMenuRef.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])
    if (!items.length) return
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)
    const index = event.key === 'Home' ? 0
      : event.key === 'End' ? items.length - 1
        : event.key === 'ArrowUp' ? (currentIndex <= 0 ? items.length - 1 : currentIndex - 1)
          : (currentIndex + 1) % items.length
    items[index]?.focus({ preventScroll: true })
  })
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = filename
  link.href = url
  link.click()
  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1000)
}

function canvasToBlob(canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg', quality?: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })
}

async function createImageBlob(options: RichTextEditorImageExportOptions = {}) {
  const canvas = await capturePageCanvas()
  if (!canvas) {
    return null
  }

  const type = options.type === 'image/jpeg' ? 'image/jpeg' : 'image/png'
  const quality = typeof options.quality === 'number' ? Math.max(0, Math.min(1, options.quality)) : undefined
  return await canvasToBlob(canvas, type, quality)
}

type PdfPageBuffer = {
  commands: string[]
}

type PdfDrawColor = {
  r: number
  g: number
  b: number
}

function toPdfNumber(value: number) {
  return Number(value.toFixed(2)).toString()
}

function encodePdfTextHex(text: string) {
  return Array.from(text || ' ')
    .map((char) => {
      const codePoint = char.codePointAt(0) ?? 32
      const safeCodePoint = codePoint <= 0xffff ? codePoint : 0x25a1
      return safeCodePoint.toString(16).padStart(4, '0').toUpperCase()
    })
    .join('')
}

function encodePdfAsciiHex(text: string) {
  return Array.from(text || ' ')
    .map((char) => (char.codePointAt(0) ?? 32) & 0xff)
    .map((code) => code.toString(16).padStart(2, '0').toUpperCase())
    .join('')
}

function parsePdfColor(color?: string | null): PdfDrawColor | null {
  if (!color) {
    return null
  }

  const normalized = color.trim().toLowerCase()
  if (!normalized || normalized === 'transparent') {
    return null
  }

  const rgbaMatch = normalized.match(/^rgba?\(([^)]+)\)$/)
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(',').map((part) => part.trim())
    const alpha = parts[3] === undefined ? 1 : Number(parts[3])
    if (alpha <= 0) {
      return null
    }

    return {
      r: Math.max(0, Math.min(255, Number.parseFloat(parts[0]) || 0)) / 255,
      g: Math.max(0, Math.min(255, Number.parseFloat(parts[1]) || 0)) / 255,
      b: Math.max(0, Math.min(255, Number.parseFloat(parts[2]) || 0)) / 255,
    }
  }

  const hex = normalized.startsWith('#') ? normalized.slice(1) : normalized
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return {
      r: Number.parseInt(hex[0] + hex[0], 16) / 255,
      g: Number.parseInt(hex[1] + hex[1], 16) / 255,
      b: Number.parseInt(hex[2] + hex[2], 16) / 255,
    }
  }

  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return {
      r: Number.parseInt(hex.slice(0, 2), 16) / 255,
      g: Number.parseInt(hex.slice(2, 4), 16) / 255,
      b: Number.parseInt(hex.slice(4, 6), 16) / 255,
    }
  }

  return null
}

function isPdfVisibleElement(element: Element) {
  const style = window.getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0
}

function hasPdfDrawableBackground(color: string) {
  const parsed = parsePdfColor(color)
  if (!parsed) {
    return false
  }

  return !(parsed.r > 0.995 && parsed.g > 0.995 && parsed.b > 0.995)
}

function buildDomTextPdfBlob(pageElement: HTMLElement) {
  const pageRect = pageElement.getBoundingClientRect()
  const pageWidth = pageBaseWidth
  const pageHeight = Math.max(pageElement.scrollHeight, pageBaseHeight)
  const pages: PdfPageBuffer[] = [{ commands: [] }]

  const currentPage = () => pages[pages.length - 1]
  const toPageX = (clientX: number) => clientX - pageRect.left
  const toPageY = (clientY: number) => clientY - pageRect.top
  const drawRect = (x: number, top: number, width: number, height: number, options: { stroke?: string | null, fill?: string | null } = {}) => {
    if (width <= 0 || height <= 0) {
      return
    }

    const fill = parsePdfColor(options.fill)
    if (fill) {
      currentPage().commands.push(
        `q ${toPdfNumber(fill.r)} ${toPdfNumber(fill.g)} ${toPdfNumber(fill.b)} rg ${toPdfNumber(x)} ${toPdfNumber(pageHeight - top - height)} ${toPdfNumber(width)} ${toPdfNumber(height)} re f Q`,
      )
    }

    const stroke = parsePdfColor(options.stroke)
    if (stroke) {
      currentPage().commands.push(
        `q ${toPdfNumber(stroke.r)} ${toPdfNumber(stroke.g)} ${toPdfNumber(stroke.b)} RG ${toPdfNumber(x)} ${toPdfNumber(pageHeight - top - height)} ${toPdfNumber(width)} ${toPdfNumber(height)} re S Q`,
      )
    }
  }
  const drawText = (text: string, x: number, baselineY: number, fontSize: number, color: string) => {
    if (!text) {
      return
    }

    const parsedColor = parsePdfColor(color) ?? { r: 15 / 255, g: 23 / 255, b: 42 / 255 }
    const isAscii = Array.from(text).every((char) => (char.codePointAt(0) ?? 0) <= 0xff)
    const fontName = isAscii ? 'F2' : 'F1'
    const encodedText = isAscii ? encodePdfAsciiHex(text) : encodePdfTextHex(text)
    currentPage().commands.push(
      `BT /${fontName} ${toPdfNumber(fontSize)} Tf ${toPdfNumber(parsedColor.r)} ${toPdfNumber(parsedColor.g)} ${toPdfNumber(parsedColor.b)} rg ${toPdfNumber(x)} ${toPdfNumber(pageHeight - baselineY)} Td <${encodedText}> Tj ET`,
    )
  }

  pageElement.querySelectorAll<HTMLElement>('*').forEach((element) => {
    if (!isPdfVisibleElement(element)) {
      return
    }

    const style = window.getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    const x = toPageX(rect.left)
    const y = toPageY(rect.top)
    const backgroundColor = style.backgroundColor
    const borderColor = style.borderColor
    const hasBorder = ['Top', 'Right', 'Bottom', 'Left'].some((side) => Number.parseFloat(style[`border${side}Width` as keyof CSSStyleDeclaration] as string) > 0)

    if (hasPdfDrawableBackground(backgroundColor) || hasBorder) {
      drawRect(x, y, rect.width, rect.height, {
        fill: hasPdfDrawableBackground(backgroundColor) ? backgroundColor : null,
        stroke: hasBorder ? borderColor : null,
      })
    }
  })

  const walker = document.createTreeWalker(pageElement, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.textContent ?? ''
      if (!text.trim()) {
        return NodeFilter.FILTER_REJECT
      }

      const parent = node.parentElement
      if (!parent || !isPdfVisibleElement(parent)) {
        return NodeFilter.FILTER_REJECT
      }

      return NodeFilter.FILTER_ACCEPT
    },
  })
  const range = document.createRange()

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text
    const text = textNode.textContent ?? ''
    const parent = textNode.parentElement
    if (!parent) {
      continue
    }

    const style = window.getComputedStyle(parent)
    const fontSize = Number.parseFloat(style.fontSize || '14') || 14
    const lineHeightValue = Number.parseFloat(style.lineHeight || '')
    const lineHeight = Number.isFinite(lineHeightValue) ? lineHeightValue : fontSize * 1.4
    const textColor = style.color || '#0f172a'
    let runText = ''
    let runX = 0
    let runTop = 0
    let runBaseline = 0
    let previousRight = 0

    const flushRun = () => {
      if (!runText.trim()) {
        runText = ''
        return
      }

      drawText(runText, runX, runBaseline, fontSize, textColor)
      runText = ''
    }

    Array.from(text).forEach((char, index) => {
      if (!char.trim()) {
        flushRun()
        return
      }

      range.setStart(textNode, index)
      range.setEnd(textNode, index + char.length)
      const rect = range.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) {
        flushRun()
        return
      }

      const charX = toPageX(rect.left)
      const charTop = toPageY(rect.top)
      const charBaseline = charTop + Math.min(lineHeight, rect.height) * 0.82
      const sameLine = runText && Math.abs(charTop - runTop) < 2 && Math.abs(charX - previousRight) < Math.max(fontSize * 0.8, 8)
      const sameScript = !runText || (Array.from(runText).every((item) => (item.codePointAt(0) ?? 0) <= 0xff) === ((char.codePointAt(0) ?? 0) <= 0xff))

      if (!sameLine || !sameScript) {
        flushRun()
        runX = charX
        runTop = charTop
        runBaseline = charBaseline
      }

      if (!runText) {
        runX = charX
        runTop = charTop
        runBaseline = charBaseline
      }

      runText += char
      previousRight = toPageX(rect.right)
    })

    flushRun()
  }

  range.detach()

  const objects: string[] = []
  const addObject = (body = '') => {
    objects.push(body)
    return objects.length
  }
  const setObject = (id: number, body: string) => {
    objects[id - 1] = body
  }

  const pagesObjectId = addObject()
  const descendantFontObjectId = addObject('<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 2 >> >>')
  const cjkFontObjectId = addObject(`<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [${descendantFontObjectId} 0 R] >>`)
  const latinFontObjectId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  const pageObjectIds = pages.map((page) => {
    const stream = page.commands.join('\n')
    const contentObjectId = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
    return addObject(`<< /Type /Page /Parent ${pagesObjectId} 0 R /MediaBox [0 0 ${toPdfNumber(pageWidth)} ${toPdfNumber(pageHeight)}] /Resources << /Font << /F1 ${cjkFontObjectId} 0 R /F2 ${latinFontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`)
  })

  setObject(pagesObjectId, `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`)
  const catalogObjectId = addObject(`<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`)

  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((body, index) => {
    offsets[index + 1] = pdf.length
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })

  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObjectId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return new Blob([pdf], { type: 'application/pdf' })
}

async function createPdfBlob() {
  const pageClone = buildExportPageClone()
  if (!pageClone) {
    return null
  }

  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = '-20000px'
  host.style.top = '0'
  host.style.padding = '0'
  host.style.margin = '0'
  host.style.background = '#ffffff'
  host.style.zIndex = '-1'
  host.appendChild(pageClone)
  document.body.appendChild(host)

  try {
    await nextTick()
    return buildDomTextPdfBlob(pageClone)
  } finally {
    host.remove()
  }
}

async function exportAsImage() {
  if (exportingType.value) {
    return
  }

  isExportMenuOpen.value = false
  exportingType.value = 'image'

  try {
    const blob = await createImageBlob()
    if (!blob) {
      return
    }

    downloadBlob(createExportFileName('png'), blob)
  } finally {
    exportingType.value = null
  }
}

async function exportAsPdf() {
  if (exportingType.value) {
    return
  }

  isExportMenuOpen.value = false
  exportingType.value = 'pdf'

  try {
    const blob = await createPdfBlob()
    if (!blob) {
      return
    }

    downloadBlob(createExportFileName('pdf'), blob)
  } finally {
    exportingType.value = null
  }
}

function buildExportHtmlDocument(pageMarkup: string) {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Office Word Export</title>
    <style>
${editorExportStyles}
${katexExportStyles}

html, body {
  margin: 0;
  min-height: 100%;
  background: #eef3f8;
}

body {
  padding: 32px;
  box-sizing: border-box;
}

.norio-office-rich-html-export {
  display: flex;
  justify-content: center;
}

.norio-office-rich-html-export .norio-office-rich-editor__page {
  box-shadow: 0 20px 42px rgba(15, 23, 42, 0.12);
}
    </style>
  </head>
  <body>
    <div class="norio-office-rich-html-export">
${pageMarkup}
    </div>
  </body>
</html>`
}

function createHtmlExportContent() {
  const pageClone = buildExportPageClone()
  if (!pageClone) {
    return null
  }

  return buildExportHtmlDocument(pageClone.outerHTML)
}

function buildPrintHtmlDocument(pageMarkup: string, title = 'Office Word Print') {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtmlText(title)}</title>
    <style>
${editorExportStyles}
${katexExportStyles}

@page {
  margin: 12mm;
}

html, body {
  margin: 0;
  padding: 0;
  background: #ffffff;
}

body {
  box-sizing: border-box;
}

.norio-office-rich-print-root {
  display: flex;
  justify-content: center;
  padding: 0;
}

.norio-office-rich-print-root .norio-office-rich-editor__page {
  box-shadow: none !important;
}
    </style>
  </head>
  <body>
    <div class="norio-office-rich-print-root">
${pageMarkup}
    </div>
  </body>
</html>`
}

async function exportAsHtml() {
  if (exportingType.value) {
    return
  }

  isExportMenuOpen.value = false
  exportingType.value = 'html'

  try {
    const html = createHtmlExportContent()
    if (!html) {
      return
    }

    downloadBlob(createExportFileName('html'), new Blob([html], { type: 'text/html;charset=utf-8' }))
  } finally {
    exportingType.value = null
  }
}

async function printDocument() {
  if (exportingType.value) {
    return
  }

  isExportMenuOpen.value = false
  exportingType.value = 'print'

  const pageClone = buildExportPageClone()
  if (!pageClone) {
    exportingType.value = null
    return
  }

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.style.opacity = '0'
  iframe.setAttribute('aria-hidden', 'true')
  document.body.appendChild(iframe)

  const cleanup = () => {
    iframe.remove()
    exportingType.value = null
  }

  try {
    const printWindow = iframe.contentWindow
    if (!printWindow) {
      cleanup()
      return
    }

    const printDocument = printWindow.document
    printDocument.open()
    printDocument.write(buildPrintHtmlDocument(pageClone.outerHTML))
    printDocument.close()

    await new Promise<void>((resolve) => {
      const finalize = () => window.setTimeout(resolve, 60)

      if (iframe.contentDocument?.readyState === 'complete') {
        finalize()
        return
      }

      iframe.addEventListener('load', finalize, { once: true })
    })

    printWindow.focus()
    printWindow.print()
  } finally {
    window.setTimeout(cleanup, 300)
  }
}

function formatLocalDateTimeValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function createDefaultCountdownDeadline() {
  const date = new Date()
  date.setSeconds(0, 0)
  date.setMinutes(date.getMinutes() + 1)
  return formatLocalDateTimeValue(date)
}

function updateCountdownDeadlineValue(date: Date, timeValue?: string) {
  const next = new Date(date)
  const fallbackTime = `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`
  const [hoursPart, minutesPart] = String(timeValue || fallbackTime).split(':')
  next.setHours(parseCountdownNumber(hoursPart, 23), parseCountdownNumber(minutesPart, 59), 0, 0)
  const minimum = countdownMinimumDateTime.value
  if (next.getTime() < minimum.getTime()) {
    next.setTime(minimum.getTime())
  }
  countdownDeadlineInput.value = formatLocalDateTimeValue(next)
  countdownCalendarYear.value = next.getFullYear()
  countdownCalendarMonth.value = next.getMonth()
  countdownTimeInput.value = `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`
}

function resetCountdownInsertDraft() {
  countdownInsertMode.value = 'deadline'
  isCountdownDeadlinePickerOpen.value = false
  isCountdownBlockEditOpen.value = false
  updateCountdownDeadlineValue(new Date(createDefaultCountdownDeadline()))
  countdownDurationDays.value = '0'
  countdownDurationHours.value = '0'
  countdownDurationMinutes.value = '1'
  countdownDurationSeconds.value = '0'
}

function parseCountdownNumber(value: string, max?: number) {
  const parsed = Number.parseInt(value || '0', 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }

  if (typeof max === 'number') {
    return Math.min(max, parsed)
  }

  return parsed
}

function fillCountdownDurationFields(totalMilliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(totalMilliseconds / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  countdownDurationDays.value = String(days)
  countdownDurationHours.value = String(hours)
  countdownDurationMinutes.value = String(minutes)
  countdownDurationSeconds.value = String(seconds)
}

function loadCountdownDraftFromAttrs(attrs: { targetTimestamp?: number; mode?: string }) {
  const targetTimestamp = Number(attrs.targetTimestamp ?? 0) || Date.now() + 60_000
  const mode = attrs.mode === 'duration' ? 'duration' : 'deadline'

  countdownInsertMode.value = mode
  updateCountdownDeadlineValue(new Date(targetTimestamp))
  fillCountdownDurationFields(Math.max(1000, targetTimestamp - Date.now()))
  isCountdownDeadlinePickerOpen.value = false
}

function selectCountdownCalendarDate(year: number, month: number, day: number) {
  const candidate = new Date(year, month, day)
  if (new Date(year, month, day, 23, 59, 59, 999).getTime() < countdownMinimumDateTime.value.getTime()) {
    return
  }

  updateCountdownDeadlineValue(candidate, countdownTimeInput.value)
}

function selectCountdownToday() {
  updateCountdownDeadlineValue(new Date(), countdownTimeMin.value)
}

function updateCountdownCalendarYear(yearValue: string) {
  countdownCalendarYear.value = Number.parseInt(yearValue, 10) || new Date().getFullYear()
}

function updateCountdownCalendarMonth(monthValue: string) {
  countdownCalendarMonth.value = Number.parseInt(monthValue, 10) || 0
}

function applyCountdownTimeOption(timeValue: string) {
  const date = countdownDeadlineDate.value ?? new Date()
  updateCountdownDeadlineValue(date, timeValue)
}

function confirmCountdownDeadlinePicker() {
  applyCountdownTimeOption(countdownTimeInput.value)
  isCountdownDeadlinePickerOpen.value = false
}

function openCountdownBlockEditPanel() {
  if (!editor.value?.isActive('countdownBlock')) {
    return
  }

  const nextOpen = !isCountdownBlockEditOpen.value
  isCountdownBlockEditOpen.value = nextOpen
  isCountdownDeadlinePickerOpen.value = false

  if (nextOpen) {
    loadCountdownDraftFromAttrs(currentCountdownBlockAttrs.value)
  }
}

function syncCountdownPickerPlacement() {
  if (!countdownDateTriggerRef.value) {
    countdownPickerPlacement.value = 'bottom'
    return
  }

  const triggerRect = countdownDateTriggerRef.value.getBoundingClientRect()
  const pickerHeight = countdownPickerRef.value?.offsetHeight ?? 420
  const viewportPadding = 16
  const spaceBelow = window.innerHeight - triggerRect.bottom - viewportPadding
  const spaceAbove = triggerRect.top - viewportPadding

  countdownPickerPlacement.value = spaceBelow >= pickerHeight || spaceBelow >= spaceAbove ? 'bottom' : 'top'
}

function toggleCountdownDeadlinePicker() {
  if (countdownInsertMode.value !== 'deadline') {
    return
  }

  isCountdownDeadlinePickerOpen.value = !isCountdownDeadlinePickerOpen.value

  if (isCountdownDeadlinePickerOpen.value) {
    void nextTick(syncCountdownPickerPlacement)
  }
}

function getCurrentBlockRange() {
  if (!editor.value) {
    return null
  }

  const { state } = editor.value
  const { $from } = state.selection
  const depth = $from.depth

  if (depth <= 0) {
    return {
      from: state.selection.from,
      to: state.selection.from,
      isEmpty: false,
    }
  }

  const currentNode = $from.node(depth)
  const isEmpty = currentNode.isTextblock && currentNode.textContent.trim().length === 0

  return {
    from: $from.before(depth),
    to: isEmpty ? $from.after(depth) : $from.before(depth),
    isEmpty,
  }
}

function syncFullscreenState() {
  isFullscreen.value = document.fullscreenElement === rootRef.value

  if (!isFullscreen.value) {
    isPresentationMode.value = false
  }
}

async function toggleFullscreen() {
  if (!rootRef.value) {
    return
  }

  if (document.fullscreenElement === rootRef.value) {
    await document.exitFullscreen()
    return
  }

  await rootRef.value.requestFullscreen()
}

async function enterPresentationMode() {
  if (!rootRef.value) {
    return
  }

  try {
    if (document.fullscreenElement !== rootRef.value) {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      }

      await rootRef.value.requestFullscreen()
    }
  } catch {
    return
  }

  presentationPointerX.value = window.innerWidth / 2
  presentationPointerY.value = window.innerHeight / 2
  isPresentationMode.value = document.fullscreenElement === rootRef.value
  isExportMenuOpen.value = false
  editor.value?.commands.blur()
}

async function exitPresentationMode() {
  isPresentationMode.value = false

  if (document.fullscreenElement === rootRef.value) {
    await document.exitFullscreen()
  }
}

async function togglePresentationMode() {
  if (isPresentationMode.value) {
    await exitPresentationMode()
    return
  }

  await enterPresentationMode()
}

function updateZoom(nextZoom: number) {
  zoom.value = Math.max(50, Math.min(200, nextZoom))
}

function toggleOutline() {
  if (!isOutlineFeatureEnabled.value) {
    return
  }

  isOutlineOpen.value = !isOutlineOpen.value
  void nextTick(() => {
    window.requestAnimationFrame(() => {
      const button = isOutlineOpen.value
        ? rootRef.value?.querySelector<HTMLButtonElement>('.norio-office-rich-outline--internal .norio-office-rich-outline__collapse')
        : outlineTriggerRef.value
      button?.focus({ preventScroll: true })
    })
  })
}

function focusOutlineItem(pos: number) {
  if (!editor.value) {
    return false
  }

  editor.value.chain().focus(pos + 1).run()
  syncOutlineState()
  void nextTick(() => {
    const heading = editor.value?.view.nodeDOM(pos)
    const container = getEditorScrollElement()
    if (heading instanceof HTMLElement && container) scrollElementIntoContainer(heading, container)
  })
  return true
}

function clearMarqueeSelection() {
  selectedMarqueeBlockPositions.value = []
}

function clearMarqueeGesture() {
  marqueeGestureStart.value = null
  marqueeGestureCurrent.value = null
  isMarqueeSelecting.value = false
}

function isInteractiveMarqueeStartTarget(target: EventTarget | null) {
  const element = target instanceof Element ? target : null
  if (!element) {
    return false
  }

  return !!element.closest(
    [
      'button',
      'input',
      'textarea',
      'select',
      'a',
      '.norio-office-rich-outline',
      '.norio-office-rich-statusbar__button',
      '.norio-office-rich-toolbar__button',
      '.norio-office-rich-table-column-track',
      '.norio-office-rich-table-row-track',
      '.norio-office-rich-table-track__dot',
      '.norio-office-rich-columns__overlay',
      '.norio-office-rich-columns__divider-hitbox',
      '.norio-office-rich-columns__add-button',
      '.norio-office-rich-video-block__toolbar',
      '.norio-office-rich-video-block__handle',
      '.norio-office-rich-video-block__bottom-bar',
      '.norio-office-rich-image-block__toolbar',
      '.norio-office-rich-image-block__handle',
      '.norio-office-rich-image-block__bottom-bar',
      '.norio-office-rich-image-block__side-tools',
      '.norio-office-rich-link-block__toolbar',
      '.norio-office-rich-link-block__handle',
      '.norio-office-rich-link-block__bottom-bar',
      '.norio-office-rich-block-side-control',
      '.norio-office-rich-block-side-menu',
      '.norio-office-rich-block-side-submenu',
      '.norio-office-rich-formula-editor',
    ].join(', '),
  )
}

function isMarqueeSelectionPreservingTarget(target: Node | null) {
  const element = target instanceof Element ? target : target?.parentElement ?? null
  if (!element) {
    return false
  }

  return !!element.closest(
    [
      '.norio-office-rich-editor__toolbar',
      '.norio-office-rich-toolbar__menu',
      '.norio-office-rich-block-side-control',
      '.norio-office-rich-block-side-menu',
      '.norio-office-rich-block-side-submenu',
    ].join(', '),
  )
}

function getPageLocalPoint(clientX: number, clientY: number) {
  if (!pageRef.value) {
    return null
  }

  const pageRect = pageRef.value.getBoundingClientRect()
  const scale = zoomScale.value || 1

  return {
    x: (clientX - pageRect.left) / scale,
    y: (clientY - pageRect.top) / scale,
  }
}

function rectanglesIntersect(left: MarqueeRect, right: MarqueeRect) {
  return left.left < right.left + right.width
    && left.left + left.width > right.left
    && left.top < right.top + right.height
    && left.top + left.height > right.top
}

function getTopLevelSelectableBlocks() {
  if (!editor.value || !pageRef.value) {
    return [] as MarqueeTopLevelBlock[]
  }

  const pageRect = pageRef.value.getBoundingClientRect()
  const scale = zoomScale.value || 1
  const blocks: MarqueeTopLevelBlock[] = []

  editor.value.state.doc.forEach((node, offset) => {
    const dom = editor.value?.view.nodeDOM(offset)
    if (!(dom instanceof HTMLElement)) {
      return
    }

    const rect = dom.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      return
    }

    blocks.push({
      pos: offset,
      from: offset,
      to: offset + node.nodeSize,
      node,
      dom,
      rect: {
        left: (rect.left - pageRect.left) / scale,
        top: (rect.top - pageRect.top) / scale,
        width: rect.width / scale,
        height: rect.height / scale,
      },
    })
  })

  return blocks
}

function getBlockSideControlMeta(block: MarqueeTopLevelBlock) {
  const { node } = block
  const type = node.type.name
  const isEmpty = type === 'paragraph' && node.textContent.trim().length === 0 && node.childCount === 0

  if (isEmpty) {
    return { isEmpty, textIcon: '+', label: '插入' }
  }

  if (type === 'heading') {
    const level = Number(node.attrs.level ?? 1)
    return { isEmpty, textIcon: `H${level}`, label: `标题 ${level}` }
  }

  const meta: Record<string, { iconName?: string; textIcon?: string; label: string }> = {
    paragraph: { textIcon: 'T', label: '正文' },
    bulletList: { iconName: 'wuxuliebiao', label: '无序列表' },
    orderedList: { iconName: 'youxuliebiao', label: '有序列表' },
    taskList: { iconName: 'To-do', label: '任务' },
    blockquote: { iconName: 'yinyong', label: '引用' },
    codeBlock: { iconName: 'codeblock', label: '代码块' },
    horizontalRule: { textIcon: '—', label: '分隔线' },
    imageBlock: { iconName: 'image', label: '图片' },
    videoBlock: { textIcon: '▶', label: '视频' },
    localFileBlock: { iconName: 'attachment', label: '本地文件' },
    linkBlock: { iconName: 'link', label: '链接' },
    countdownBlock: { iconName: 'days', label: '倒计时' },
    highlightBlock: { iconName: 'gaoliangkuai', label: '高亮块' },
    formulaBlock: { textIcon: 'fx', label: '公式' },
    columnsBlock: { iconName: 'split', label: '分栏' },
    table: { textIcon: '▦', label: '表格' },
  }

  return { isEmpty, ...(meta[type] ?? { textIcon: 'T', label: '块' }) }
}

function toBlockSideControl(block: MarqueeTopLevelBlock): BlockSideControl {
  return {
    ...block,
    ...getBlockSideControlMeta(block),
  }
}

function getBlockSideControlAt(clientX: number, clientY: number) {
  const point = getPageLocalPoint(clientX, clientY)
  if (!point) {
    return null
  }

  const blocks = getTopLevelSelectableBlocks()
  const contentBounds = getImageDropContentBounds()
  const xToleranceLeft = contentBounds ? contentBounds.left - blockSideControlContentWidth - blockSideControlGap - 12 : 0
  const xToleranceRight = contentBounds ? contentBounds.left + contentBounds.width + 28 : pageBaseWidth

  return blocks
    .map(toBlockSideControl)
    .find((block) =>
      point.y >= block.rect.top - 8
      && point.y <= block.rect.top + block.rect.height + 8
      && point.x >= xToleranceLeft
      && point.x <= xToleranceRight,
    ) ?? null
}

function suspendBlockSideControls() {
  isBlockSideInteractionActive.value = true
  closeBlockSideMenu()
  hoveredBlockSideControl.value = null
}

function syncNativeEditorSelection() {
  const selection = window.getSelection()
  const content = editor.value?.view.dom
  hasNativeEditorSelection.value = !!content && !!selection && !selection.isCollapsed
    && !!selection.anchorNode && content.contains(selection.anchorNode)
    && !!selection.focusNode && content.contains(selection.focusNode)
}

function handlePageEditorInput(event: Event) {
  if (!editorEditable.value || !(event.target instanceof Node) || !editor.value?.view.dom.contains(event.target)) return
  if (event instanceof KeyboardEvent && !event.isComposing
    && !(['Enter', 'Backspace', 'Delete', 'Tab'].includes(event.key)
      || (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey))) return
  suspendBlockSideControls()
  isEditorTyping.value = true
  if (editorTypingTimer !== null) clearTimeout(editorTypingTimer)
  editorTypingTimer = setTimeout(() => {
    isEditorTyping.value = false
    editorTypingTimer = null
  }, 300)
}

function handlePageEditorCompositionStart(event: CompositionEvent) {
  if (!(event.target instanceof Node) || !editor.value?.view.dom.contains(event.target)) return
  isEditorComposing.value = true
  handlePageEditorInput(event)
}

function handlePageEditorCompositionEnd(event: CompositionEvent) {
  if (!(event.target instanceof Node) || !editor.value?.view.dom.contains(event.target)) return
  isEditorComposing.value = false
  handlePageEditorInput(event)
  void nextTick(syncSlashMenu)
}

function handlePageBlockMouseMove(event: MouseEvent) {
  if (!editorEditable.value || isPresentationMode.value || blockDragState.value) {
    hoveredBlockSideControl.value = null
    return
  }

  const target = event.target as Node | null
  if (target instanceof Element && target.closest('.norio-office-rich-block-side-control, .norio-office-rich-block-side-menu, .norio-office-rich-block-side-submenu, .norio-office-rich-block-side-table-theme')) {
    return
  }

  if (event.buttons || isEditorTyping.value || isEditorComposing.value || marqueeGestureStart.value || hasMarqueeSelection.value) {
    hoveredBlockSideControl.value = null
    return
  }

  isBlockSideInteractionActive.value = false
  syncNativeEditorSelection()
  if (shouldHideBlockSideControls.value) {
    hoveredBlockSideControl.value = null
    return
  }
  hoveredBlockSideControl.value = getBlockSideControlAt(event.clientX, event.clientY)
}

function handlePageBlockMouseLeave(event: MouseEvent) {
  const relatedTarget = event.relatedTarget as Node | null
  if (relatedTarget instanceof Element && relatedTarget.closest('.norio-office-rich-block-side-control, .norio-office-rich-block-side-menu, .norio-office-rich-block-side-submenu, .norio-office-rich-block-side-table-theme')) {
    return
  }

  if (!blockSideMenuMode.value && !blockSideSubmenuMode.value) {
    hoveredBlockSideControl.value = null
  }
}

function keepBlockSideControl(control: BlockSideControl) {
  hoveredBlockSideControl.value = control
  activeBlockSideControl.value = control
}

function openBlockSideMenu(control: BlockSideControl, mode: BlockSideMenuMode) {
  if (shouldHideBlockSideControls.value) return
  const keepAnchor = mode === 'actions' && blockSideMenuMode.value === mode
    && activeBlockSideControl.value?.pos === control.pos && blockSideMenuAnchorPoint.value
  keepBlockSideControl(control)
  // Formatting can move the block; keep this open menu anchored until it is reopened.
  if (!keepAnchor) blockSideMenuAnchorPoint.value = mode === 'actions' ? blockSideControlPoint.value : null
  blockSideMenuMode.value = mode
  blockSideSubmenuMode.value = null
  blockSideTableThemePos.value = null
  blockSideTargetPos.value = mode === 'actions' && !control.node.isLeaf ? control.pos : null
  blockSideCustomColorKind.value = null
}

function closeBlockSideMenu() {
  blockSideMenuMode.value = null
  blockSideMenuAnchorPoint.value = null
  blockSideSubmenuMode.value = null
  blockSideTableThemePos.value = null
  blockSideTargetPos.value = null
  blockSideCustomColorKind.value = null
  blockSideCustomColorTriggerRef.value = null
  activeBlockSideControl.value = null
}

function getBlockSideInsertionRange(control: BlockSideControl, mode: BlockSideMenuMode) {
  if (mode === 'add-above') {
    return { from: control.from, to: control.from }
  }

  if (mode === 'add-below') {
    return { from: control.to, to: control.to }
  }

  return control.isEmpty ? { from: control.from, to: control.to } : { from: control.to, to: control.to }
}

function buildSideInsertContent(action: string): JSONContent | JSONContent[] | null {
  if (action === 'image') {
    return {
      type: 'imageBlock',
      attrs: {
        images: [{ id: createImagePlaceholderId() }],
        widthPercent: 100,
      },
    }
  }

  if (action === 'video') {
    return {
      type: 'videoBlock',
      attrs: {
        src: '',
        name: '',
        description: '',
        mimeType: 'video/mp4',
        align: 'left',
        widthPercent: 100,
        height: 220,
      },
    }
  }

  if (action === 'link') {
    return {
      type: 'linkBlock',
      attrs: {
        title: '',
        url: '',
        displayMode: 'preview',
        align: 'left',
        widthPercent: 100,
        height: 420,
      },
    }
  }

  if (action === 'countdown') {
    return {
      type: 'countdownBlock',
      attrs: {
        targetTimestamp: 0,
        mode: 'duration',
        color: '#ff8b00',
        reminderEnabled: true,
      },
    }
  }

  if (action === 'emoji') {
    return {
      type: 'paragraph',
      content: [{ type: 'text', text: '😀' }],
    }
  }

  if (action === 'columns') {
    return buildColumnsContent(2)
  }

  if (action === 'formula') {
    return {
      type: 'formulaBlock',
      attrs: {
        latex: '',
      },
    }
  }

  return buildInsertContent(action)
}

function insertFromBlockSideMenu(action: string) {
  if (!editor.value || !activeBlockSideControl.value || !blockSideMenuMode.value) {
    return
  }

  const control = activeBlockSideControl.value
  const insertionMode = blockSideSubmenuMode.value === 'add-above' || blockSideSubmenuMode.value === 'add-below'
    ? blockSideSubmenuMode.value
    : blockSideMenuMode.value
  const range = getBlockSideInsertionRange(control, insertionMode)

  if (action === 'table') {
    editor.value
      .chain()
      .focus()
      .insertContentAt(range, createTable(editor.value.schema, 3, 3, false).toJSON(), { updateSelection: true })
      .run()
    closeBlockSideMenu()
    queueTableStateSync()
    return
  }

  const content = buildSideInsertContent(action)
  if (!content) {
    closeBlockSideMenu()
    return
  }

  editor.value
    .chain()
    .focus()
    .insertContentAt(range, content, { updateSelection: true })
    .run()
  closeBlockSideMenu()
  queueTableStateSync()
}

function focusBlockSideControl(control: BlockSideControl) {
  if (!editor.value) {
    return false
  }

  const pos = Math.min(control.from + 1, Math.max(control.from, control.to - 1))
  editor.value.chain().focus(pos).run()
  return true
}

function getBlockSideNodeType(control: BlockSideControl) {
  return control.node.type.name
}

function canShowBlockTransforms(control: BlockSideControl) {
  return blockSideTransformableTypes.has(getBlockSideNodeType(control))
}

function canShowBlockSideAlignIndent(control: BlockSideControl) {
  return blockSideAlignIndentTypes.has(getBlockSideNodeType(control))
}

function getBlockSidePropertyTargets(control: BlockSideControl) {
  const targets: { pos: number; node: ProseMirrorNode }[] = []
  if (['paragraph', 'heading'].includes(control.node.type.name)) return [{ pos: control.pos, node: control.node }]
  if (!canShowBlockSideAlignIndent(control)) return targets
  control.node.descendants((node, offset) => {
    if (!['paragraph', 'heading'].includes(node.type.name)) return
    targets.push({ pos: control.pos + 1 + offset, node })
    return false
  })
  return targets
}

function canShowBlockSideColor(control: BlockSideControl) {
  return blockSideTextColorTypes.has(getBlockSideNodeType(control))
}

function updateBlockSideControlAttrs(control: BlockSideControl, attrs: Record<string, unknown>) {
  if (!editor.value) {
    return false
  }

  const { state, view } = editor.value
  view.dispatch(
    state.tr.setMeta('officeBlockSideAttrs', control.pos).setNodeMarkup(control.pos, undefined, {
      ...control.node.attrs,
      ...attrs,
    }),
  )
  return true
}

function applyBlockSideHighlightAttrs(attrs: Record<string, unknown>) {
  const pos = blockSideTargetPos.value
  const control = activeBlockSideControl.value
  const node = pos === null ? null : editor.value?.state.doc.nodeAt(pos)
  if (!editorEditable.value || !editor.value?.isEditable || !control || pos === null || node?.type.name !== 'highlightBlock') return false
  return updateBlockSideControlAttrs({ ...control, pos, node }, attrs)
}

const blockSideSurfaceColorConfig = computed(() => {
  const mode = blockSideSubmenuMode.value
  if (!blockSideSurfaceColorModes.includes(mode ?? '')) return null
  const isQuote = mode === 'quote-border' || mode === 'quote-background'
  const isBorder = mode === 'highlight-border' || mode === 'quote-border'
  const attribute = isQuote ? (isBorder ? 'quoteBorderColor' : 'quoteBackgroundColor') : (isBorder ? 'borderColor' : 'backgroundColor')
  const defaultColor = isQuote ? (isBorder ? quoteBorderColors[0] : quoteBackgroundColors[0]).toLowerCase()
    : isBorder ? highlightBlockDefaultBorderColor : highlightBlockDefaultBackgroundColor
  const node = activeBlockSideControl.value?.node
  return {
    nodeType: isQuote ? 'blockquote' : 'highlightBlock', attribute,
    kind: isBorder ? 'border' as const : 'fill' as const,
    label: isBorder ? '边框颜色' : isQuote ? '背景颜色' : '填充颜色',
    color: String(node?.attrs[attribute] ?? defaultColor), defaultColor,
    presetColors: isQuote ? (isBorder ? blockSideQuoteBorderColors : blockSideQuoteBackgroundColors) : undefined,
  }
})

function applyBlockSideSurfaceColor(color: string) {
  const config = blockSideSurfaceColorConfig.value
  const pos = blockSideTargetPos.value
  const control = activeBlockSideControl.value
  const node = pos === null ? null : editor.value?.state.doc.nodeAt(pos)
  if (!config || !editorEditable.value || !editor.value?.isEditable || !control || pos === null || node?.type.name !== config.nodeType) return
  if (!updateBlockSideControlAttrs({ ...control, pos, node }, { [config.attribute]: color })) return
  if (color !== 'transparent') recentColors.value = [color, ...recentColors.value.filter(item => item.toLowerCase() !== color.toLowerCase())].slice(0, 10)
}

function toggleBlockSideHighlightEmoji() {
  applyBlockSideHighlightAttrs({ emojiEnabled: !currentBlockSideHighlightAttrs.value.emojiEnabled })
}

function applyBlockSideDividerAttrs(attrs: Record<string, unknown>) {
  const control = activeBlockSideControl.value
  const node = control && editor.value?.state.doc.nodeAt(control.pos)
  if (!editorEditable.value || !control || node?.type.name !== 'horizontalRule') return
  updateBlockSideControlAttrs({ ...control, node }, attrs)
  keepBlockSideControl({ ...control, node: editor.value!.state.doc.nodeAt(control.pos)! })
}

function applyBlockSideDividerColor(value: string) {
  const color = normalizeDividerColor(value)
  if (!color) return
  applyBlockSideDividerAttrs({ lineColor: color === dividerDefaultColor ? null : color })
  recentColors.value = [color, ...recentColors.value.filter(item => item.toLowerCase() !== color)].slice(0, 10)
}

function applyBlockTransform(action: string) {
  const control = activeBlockSideControl.value
  if (!editor.value || !control || !visibleBlockTransformActions.value.some((item) => item.action === action)) {
    return
  }

  focusBlockSideControl(control)

  if (action === 'paragraph') {
    editor.value.chain().focus().setParagraph().run()
  } else if (action.startsWith('heading-')) {
    const level = Number(action.replace('heading-', '')) as 1 | 2 | 3 | 4 | 5 | 6
    editor.value.chain().focus().toggleHeading({ level }).run()
  } else if (action === 'bullet-list') {
    editor.value.chain().focus().toggleBulletList().run()
  } else if (action === 'ordered-list') {
    editor.value.chain().focus().toggleOrderedList().run()
  } else if (action === 'task-list') {
    editor.value.chain().focus().toggleTaskList().run()
  }

  closeBlockSideMenu()
  queueTableStateSync()
}

function applyBlockProperty(action: string) {
  const control = activeBlockSideControl.value
  const node = control && editor.value?.state.doc.nodeAt(control.pos)
  if (!editorEditable.value || !editor.value?.isEditable || !control || !node || !canShowBlockSideAlignIndent(control)) return
  const textAlign = action.startsWith('align-') ? action.slice(6) : undefined
  if (textAlign !== undefined && !['left', 'center', 'right'].includes(textAlign)) return
  if (textAlign === undefined && action !== 'indent-more' && action !== 'indent-less') return
  const tr = editor.value.state.tr.setMeta('officeBlockSideAttrs', control.pos)
  for (const target of getBlockSidePropertyTargets({ ...control, node })) {
    const attrs = { ...target.node.attrs }
    if (textAlign !== undefined) attrs.textAlign = textAlign
    else attrs.indent = Math.max(0, Math.min(8, Number(attrs.indent ?? 0) + (action === 'indent-more' ? 1 : -1)))
    if (attrs.textAlign === target.node.attrs.textAlign && attrs.indent === target.node.attrs.indent) continue
    tr.setNodeMarkup(target.pos, undefined, attrs)
  }
  if (tr.docChanged) editor.value.view.dispatch(tr)
}

function applyBlockSideTextStyle(updates: { color?: string | null; backgroundColor?: string | null }) {
  const control = activeBlockSideControl.value
  if (!editorEditable.value || !editor.value?.isEditable || !control || !canShowBlockSideColor(control)) return
  const { state, view } = editor.value
  const node = state.doc.nodeAt(control.pos)
  const type = state.schema.marks.textStyle
  if (!node || node.type.name !== control.node.type.name || !type) return
  const tr = state.tr
  state.doc.nodesBetween(control.pos + 1, control.pos + node.nodeSize - 1, (child, pos) => {
    if (!child.isText) return
    const mark = child.marks.find(mark => mark.type === type)
    const attrs = { ...mark?.attrs, ...updates }
    if (Object.values(attrs).some(value => value !== null && value !== undefined && value !== '')) {
      tr.addMark(pos, pos + child.nodeSize, type.create(attrs))
    } else {
      tr.removeMark(pos, pos + child.nodeSize, type)
    }
  })
  if (tr.docChanged) view.dispatch(tr)
}

function applyBlockSideTextColor(kind: BlockColorKind, color: string | null) {
  if (kind !== 'text' && kind !== 'background') return
  applyBlockSideTextStyle(kind === 'text' ? { color } : { backgroundColor: color })
  if (color) {
    const recent = kind === 'text' ? recentColors : recentHighlightColors
    recent.value = [color, ...recent.value.filter(item => item.toLowerCase() !== color.toLowerCase())].slice(0, 10)
  }
}

function resetBlockSideTextColors() {
  applyBlockSideTextStyle({ color: null, backgroundColor: null })
}

function openBlockSideCustomColor(kind: BlockColorKind, anchor: HTMLElement) {
  blockSideCustomColorTriggerRef.value = anchor
  blockSideCustomColorKind.value = kind
}

function applyBlockSideCustomColor(color: string | null) {
  const kind = blockSideCustomColorKind.value
  if (kind === 'border' || kind === 'fill') applyBlockSideSurfaceColor(color ?? 'transparent')
  else if (kind) applyBlockSideTextColor(kind, color)
}

const blockSideCustomColorConfig = computed(() => {
  const kind = blockSideCustomColorKind.value
  const surface = blockSideSurfaceColorConfig.value
  if ((kind === 'border' || kind === 'fill') && surface) return {
    label: `自定义${surface.label}选择`,
    color: surface.color,
    defaultColor: surface.defaultColor,
    recentColors: recentColors.value,
  }
  return {
    label: kind === 'text' ? '自定义文字颜色选择' : '自定义背景颜色选择',
    color: kind === 'text' ? currentBlockSideTextColors.value.text : currentBlockSideTextColors.value.background,
    defaultColor: kind === 'text' ? '#273142' : '#FFFFFF',
    recentColors: kind === 'text' ? recentColors.value : recentHighlightColors.value,
  }
})

function serializeBlock(control: BlockSideControl): BlockClipboardPayload {
  return serializeClipboardSlice(new Slice(Fragment.from(control.node), 0, 0))!
}

function serializeClipboardSlice(slice: Slice): BlockClipboardPayload | null {
  if (!editor.value) return null
  const serialized = editor.value.view.serializeForClipboard(slice)
  return {
    json: serialized.slice.openStart === 0 && serialized.slice.openEnd === 0
      ? serialized.slice.content.toJSON() as JSONContent[] : undefined,
    html: serialized.dom.innerHTML,
    text: serialized.text,
  }
}

function writeClipboardData(event: ClipboardEvent, payload: BlockClipboardPayload) {
  if (!event.clipboardData) return false
  event.clipboardData.clearData()
  event.clipboardData.setData('text/html', payload.html)
  event.clipboardData.setData('text/plain', payload.text)
  if (payload.json?.length) event.clipboardData.setData(blockClipboardMime, JSON.stringify(payload.json))
  event.preventDefault()
  event.stopPropagation()
  blockClipboardPayload.value = payload
  return true
}

async function copyBlockSideControl(control: BlockSideControl) {
  if (!editor.value) return false
  const payload = serializeBlock(control)
  blockClipboardPayload.value = payload
  const request = { payload, written: false }
  pendingBlockCopy = request
  try {
    // A real copy event supports the same rich clipboard formats as Ctrl/Cmd+C.
    editor.value.view.focus()
    if (!document.execCommand('copy')) request.written = false
  } catch {
    // Some hosts disable execCommand; fall back to the asynchronous rich clipboard API.
  } finally {
    pendingBlockCopy = null
  }
  if (request.written) return true

  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([payload.html], { type: 'text/html' }),
      'text/plain': new Blob([payload.text], { type: 'text/plain' }),
    })])
    return true
  } catch {
    // Keep the local fallback, but never cut a node that could not reach the system clipboard.
    return false
  }
}

async function cutBlockSideControl(control: BlockSideControl) {
  if (!editor.value || !editorEditable.value) return
  const doc = editor.value.state.doc
  if (await copyBlockSideControl(control) && editor.value?.state.doc === doc) deleteBlockSideControl(control)
}

async function readBlockClipboard(): Promise<BlockClipboardPayload | null> {
  try {
    if (navigator.clipboard?.read) {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const html = item.types.includes('text/html') ? await (await item.getType('text/html')).text() : ''
        const text = item.types.includes('text/plain') ? await (await item.getType('text/plain')).text() : ''
        if (html || text) return { html, text }
      }
      return null
    }
    if (navigator.clipboard?.readText) {
      const text = await navigator.clipboard.readText()
      return text ? { html: '', text } : null
    }
  } catch {
    // Hosts that deny clipboard reads can still paste content copied in this editor.
  }
  return blockClipboardPayload.value
}

async function pasteBlockBelow(control: BlockSideControl) {
  if (!editor.value || !editorEditable.value) return
  const doc = editor.value.state.doc
  const payload = await readBlockClipboard()
  if (!payload || !editor.value || editor.value.state.doc !== doc) return
  const content = payload.json?.length ? payload.json : payload.html || payload.text.split(/\r\n?|\n/).map(text => ({
    type: 'paragraph', content: text ? [{ type: 'text', text }] : [],
  }))

  editor.value
    .chain()
    .focus()
    .insertContentAt({ from: control.to, to: control.to }, content, { updateSelection: true })
    .run()
  closeBlockSideMenu()
}

function deleteBlockSideControl(control: BlockSideControl) {
  if (!editor.value || !editorEditable.value) {
    return
  }

  editor.value.chain().focus().deleteRange({ from: control.from, to: control.to }).run()
  closeBlockSideMenu()
  hoveredBlockSideControl.value = null
}

function startBlockSideDrag(event: MouseEvent, control: BlockSideControl) {
  if (!editor.value || !editorEditable.value || isPresentationMode.value) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  keepBlockSideControl(control)
  blockSideMenuMode.value = null
  blockSideSubmenuMode.value = null
  blockSideTargetPos.value = null
  blockSideCustomColorKind.value = null
  blockDragState.value = {
    from: control.from,
    to: control.to,
    content: control.node.toJSON(),
  }
  const ghostRect = control.dom.getBoundingClientRect()
  const ghostScale = Math.min(
    1,
    blockDragGhostMaxWidth / Math.max(ghostRect.width, 1),
    blockDragGhostMaxHeight / Math.max(ghostRect.height, 1),
  )
  const offsetX = (event.clientX - ghostRect.left) * ghostScale
  const offsetY = (event.clientY - ghostRect.top) * ghostScale
  blockDragGhost.value = {
    html: control.dom.outerHTML,
    left: event.clientX - offsetX,
    top: event.clientY - offsetY,
    width: ghostRect.width * ghostScale,
    height: ghostRect.height * ghostScale,
    sourceWidth: ghostRect.width,
    sourceHeight: ghostRect.height,
    scale: ghostScale,
    offsetX,
    offsetY,
  }

  const move = (moveEvent: MouseEvent) => {
    if (blockDragGhost.value) {
      blockDragGhost.value = {
        ...blockDragGhost.value,
        left: moveEvent.clientX - blockDragGhost.value.offsetX,
        top: moveEvent.clientY - blockDragGhost.value.offsetY,
      }
    }

    const target = getImageDropTarget(moveEvent.clientX, moveEvent.clientY)
    if (!target) {
      dragInsertIndicator.value = null
      return
    }
    dragInsertIndicator.value = target
  }

  const up = (upEvent: MouseEvent) => {
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', up)
    const dragState = blockDragState.value
    const target = dragInsertIndicator.value ?? getImageDropTarget(upEvent.clientX, upEvent.clientY)
    dragInsertIndicator.value = null
    blockDragState.value = null
    blockDragGhost.value = null

    if (!dragState || !target || target.range.from >= dragState.from && target.range.from <= dragState.to) {
      return
    }

    let insertPos = target.range.from
    if (insertPos > dragState.from) {
      insertPos -= dragState.to - dragState.from
    }

    editor.value
      ?.chain()
      .focus()
      .deleteRange({ from: dragState.from, to: dragState.to })
      .insertContentAt(insertPos, dragState.content, { updateSelection: true })
      .run()
    closeBlockSideMenu()
    hoveredBlockSideControl.value = null
  }

  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', up)
  move(event)
}

function isDroppableImageFile(file: File) {
  return file.type.startsWith('image/')
}

function isDroppableVideoFile(file: File) {
  return file.type.startsWith('video/')
}

function isDroppableFile(file: File) {
  return !isDroppableImageFile(file) && !isDroppableVideoFile(file)
}

function hasDroppableMediaFiles(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) {
    return false
  }

  const items = Array.from(dataTransfer.items ?? [])
  if (items.some((item) => item.kind === 'file')) {
    return true
  }

  return Array.from(dataTransfer.files ?? []).length > 0
}

function getDroppedImageFiles(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) {
    return [] as File[]
  }

  return Array.from(dataTransfer.files ?? [])
    .filter(isDroppableImageFile)
    .slice(0, 4)
}

function getDroppedVideoFile(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) {
    return null
  }

  return Array.from(dataTransfer.files ?? []).find(isDroppableVideoFile) ?? null
}

function getDroppedLocalFiles(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) {
    return [] as File[]
  }

  return Array.from(dataTransfer.files ?? []).filter(isDroppableFile)
}

function getImageDropContentBounds() {
  if (!pageRef.value) {
    return null
  }

  const pageRect = pageRef.value.getBoundingClientRect()
  const content = pageRef.value.querySelector('.norio-office-rich-prosemirror')
  const contentRect = content?.getBoundingClientRect()
  const scale = zoomScale.value || 1
  const contentStyle = content ? getComputedStyle(content) : null
  const paddingLeft = Number.parseFloat(contentStyle?.paddingLeft ?? '0') || 0
  const paddingRight = Number.parseFloat(contentStyle?.paddingRight ?? '0') || 0

  if (!contentRect) {
    return {
      left: 98,
      width: Math.max(pageBaseWidth - 196, 320),
    }
  }

  return {
    left: (contentRect.left - pageRect.left + paddingLeft) / scale,
    width: Math.max((contentRect.width - paddingLeft - paddingRight) / scale, 320),
  }
}

function getImageDropTarget(clientX: number, clientY: number) {
  if (!editor.value || !pageRef.value) {
    return null
  }

  const pagePoint = getPageLocalPoint(clientX, clientY)
  const contentBounds = getImageDropContentBounds()
  if (!pagePoint || !contentBounds) {
    return null
  }

  const blocks = getTopLevelSelectableBlocks()
  if (!blocks.length) {
    const coords = editor.value.view.posAtCoords({ left: clientX, top: clientY })
    const pos = coords?.pos ?? editor.value.state.doc.content.size
    return {
      left: contentBounds.left,
      top: Math.max(52, pagePoint.y),
      width: contentBounds.width,
      range: { from: pos, to: pos },
    } satisfies DragInsertIndicator
  }

  for (const block of blocks) {
    const midpoint = block.rect.top + block.rect.height / 2
    if (pagePoint.y < midpoint) {
      return {
        left: contentBounds.left,
        top: block.rect.top,
        width: contentBounds.width,
        range: { from: block.from, to: block.from },
      } satisfies DragInsertIndicator
    }
  }

  const lastBlock = blocks[blocks.length - 1]
  return {
    left: contentBounds.left,
    top: lastBlock.rect.top + lastBlock.rect.height,
    width: contentBounds.width,
    range: { from: lastBlock.to, to: lastBlock.to },
  } satisfies DragInsertIndicator
}

function syncImageDropIndicator(event: DragEvent) {
  if (!editorEditable.value || isPresentationMode.value || editor.value?.view.dragging || !hasDroppableMediaFiles(event.dataTransfer)) {
    dragInsertIndicator.value = null
    return false
  }

  const target = getImageDropTarget(event.clientX, event.clientY)
  if (!target) {
    dragInsertIndicator.value = null
    return false
  }

  event.preventDefault()
  event.stopPropagation()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
  dragInsertIndicator.value = target
  return true
}

function syncMarqueeSelection() {
  if (!isMarqueeSelecting.value || !marqueeSelectionRect.value) {
    return
  }

  const positions = getTopLevelSelectableBlocks()
    .filter((block) => rectanglesIntersect(block.rect, marqueeSelectionRect.value!))
    .map((block) => block.pos)

  selectedMarqueeBlockPositions.value = positions
}

function buildMarqueeClipboardPayload() {
  if (!editor.value) {
    return null
  }

  const fragment = Fragment.fromArray(selectedMarqueeBlocks.value.map((block) => block.node))
  return serializeClipboardSlice(new Slice(fragment, 0, 0))
}

function getMarqueeInsertRange() {
  if (!editor.value) {
    return null
  }

  if (selectedMarqueeBlocks.value.length) {
    const sorted = [...selectedMarqueeBlocks.value].sort((left, right) => left.from - right.from)
    return {
      from: sorted[0].from,
      to: sorted[sorted.length - 1].to,
    }
  }

  const selection = editor.value.state.selection
  return {
    from: selection.from,
    to: selection.to,
  }
}

function getMarqueeTextSelectionRange() {
  if (!editor.value || !selectedMarqueeBlocks.value.length) {
    return null
  }

  const sorted = [...selectedMarqueeBlocks.value].sort((left, right) => left.from - right.from)
  const from = Math.max(0, Math.min(editor.value.state.doc.content.size, sorted[0].from + 1))
  const to = Math.max(from, Math.min(editor.value.state.doc.content.size, sorted[sorted.length - 1].to - 1))

  return from < to ? { from, to } : null
}

function getActiveSelectionChain() {
  const chain = editor.value?.chain().focus()
  const range = getMarqueeTextSelectionRange()
  return chain && range ? chain.setTextSelection(range) : chain
}

function insertMarqueeBlocks(content: JSONContent[]) {
  if (!editor.value || !editorEditable.value || !content.length) {
    return false
  }

  const range = getMarqueeInsertRange()
  if (!range) {
    return false
  }

  const inserted = editor.value
    .chain()
    .focus()
    .insertContentAt(range, content, { updateSelection: true })
    .run()

  if (inserted) {
    clearMarqueeSelection()
  }

  return inserted
}

function deleteMarqueeSelection() {
  if (!editor.value || !editorEditable.value || !selectedMarqueeBlocks.value.length) {
    return
  }

  const ranges = selectedMarqueeBlocks.value
    .map((block) => ({ from: block.from, to: block.to }))
    .sort((left, right) => right.from - left.from)

  let chain = editor.value.chain().focus()
  ranges.forEach((range) => {
    chain = chain.deleteRange(range)
  })
  chain.run()
  clearMarqueeSelection()
}

function handlePageMouseDown(event: MouseEvent) {
  if (!editorEditable.value || isPresentationMode.value || event.button !== 0 || !pageRef.value) {
    return
  }

  if (!pageRef.value.contains(event.target as Node)) {
    return
  }

  if (event.target instanceof Node && editor.value?.view.dom.contains(event.target)) suspendBlockSideControls()

  if (isInteractiveMarqueeStartTarget(event.target)) {
    return
  }

  clearMarqueeGesture()
  clearMarqueeSelection()
  const content = editor.value?.view.dom
  if (!content) return
  const pageRect = pageRef.value.getBoundingClientRect()
  const contentRect = content.getBoundingClientRect()
  const contentStyle = getComputedStyle(content)
  // Keep short lines and paragraph gaps inside the content area at every zoom level.
  const scale = content.offsetWidth > 0 ? contentRect.width / content.offsetWidth : zoomScale.value || 1
  const contentLeft = contentRect.left + (Number.parseFloat(contentStyle.paddingLeft) || 0) * scale
  const contentRight = contentRect.right - (Number.parseFloat(contentStyle.paddingRight) || 0) * scale
  const isInsidePage = event.clientX >= pageRect.left && event.clientX <= pageRect.right
    && event.clientY >= pageRect.top && event.clientY <= pageRect.bottom
  if (!isInsidePage || (event.clientX >= contentLeft && event.clientX <= contentRight)) return

  event.preventDefault()
  marqueeGestureStart.value = { x: event.clientX, y: event.clientY }
  marqueeGestureCurrent.value = { x: event.clientX, y: event.clientY }
}

function handlePageImageDragEnter(event: DragEvent) {
  syncImageDropIndicator(event)
}

function handlePageImageDragOver(event: DragEvent) {
  syncImageDropIndicator(event)
}

function handlePageImageDragLeave(event: DragEvent) {
  if (!pageRef.value || !dragInsertIndicator.value) {
    return
  }

  const rect = pageRef.value.getBoundingClientRect()
  const isInsidePage =
    event.clientX >= rect.left
    && event.clientX <= rect.right
    && event.clientY >= rect.top
    && event.clientY <= rect.bottom

  if (!isInsidePage) {
    dragInsertIndicator.value = null
  }
}

async function handlePageImageDrop(event: DragEvent) {
  if (!editor.value || !editorEditable.value || isPresentationMode.value || editor.value.view.dragging || !hasDroppableMediaFiles(event.dataTransfer)) {
    dragInsertIndicator.value = null
    return
  }

  event.preventDefault()
  event.stopPropagation()

  const videoFile = getDroppedVideoFile(event.dataTransfer)
  const imageFiles = getDroppedImageFiles(event.dataTransfer)
  const localFiles = getDroppedLocalFiles(event.dataTransfer)
  const target = dragInsertIndicator.value ?? getImageDropTarget(event.clientX, event.clientY)
  dragInsertIndicator.value = null

  if ((!videoFile && !imageFiles.length && !localFiles.length) || !target) {
    return
  }

  if (videoFile) {
    await runEditorUploadTask(
      'video',
      videoFile.name,
      async () => {
        const uploadedVideo = await resolveUploadFile(videoFile, 'video')

        editor.value
          ?.chain()
          .focus()
          .insertContentAt(
            target.range,
            {
              type: 'videoBlock',
				attrs: {
					assetId: uploadedVideo.assetId || '',
					src: uploadedVideo.url,
                name: uploadedVideo.name,
                description: uploadedVideo.description || '',
                mimeType: uploadedVideo.mimeType || 'video/mp4',
                align: 'left',
                widthPercent: 100,
                height: 220,
              },
            },
            { updateSelection: true },
          )
          .run()
        return true
      },
      (error) => handleUploadError({ kind: 'video', fileName: videoFile.name, error }),
    )
    return
  }

  if (imageFiles.length) {
    const imageUploadName = imageFiles.length > 1 ? `${imageFiles[0]?.name || '图片'} 等 ${imageFiles.length} 张图片` : imageFiles[0]?.name || '图片'
    await runEditorUploadTask(
      'image',
      imageUploadName,
      async () => {
        const payload: RichTextEditorImagePayload[] = await Promise.all(
          imageFiles.map(async (file) => {
            const uploadedImage = await resolveUploadFile(file, 'image')

			return {
				assetId: uploadedImage.assetId,
				src: uploadedImage.url,
              alt: uploadedImage.alt || uploadedImage.name,
              name: uploadedImage.name,
              description: uploadedImage.description || '',
              link: '',
              rotation: 0,
            }
          }),
        )

        editor.value
          ?.chain()
          .focus()
          .insertContentAt(
            target.range,
            {
              type: 'imageBlock',
              attrs: {
                images: payload.map(normalizeImagePayload),
                widthPercent: 100,
                align: 'left',
                height: 146,
              },
            },
            { updateSelection: true },
          )
          .run()
        return true
      },
      (error) => handleUploadError({ kind: 'image', fileName: imageFiles[0]?.name || '', error }),
    )
  }

  if (localFiles.length) {
    const fileUploadName = localFiles.length > 1 ? `${localFiles[0]?.name || '文件'} 等 ${localFiles.length} 个文件` : localFiles[0]?.name || '文件'
    await runEditorUploadTask(
      'file',
      fileUploadName,
      async () => {
        const payloads: RichTextEditorLocalFilePayload[] = await Promise.all(
          localFiles.map(async (file) => {
            const uploadedFile = await resolveUploadFile(file, 'file')
			return {
				assetId: uploadedFile.assetId,
				url: uploadedFile.url,
              name: uploadedFile.name,
              size: uploadedFile.size,
              mimeType: uploadedFile.mimeType,
            }
          }),
        )

        const selectionPosition = editor.value?.state.selection.from ?? target.range.from
        const fileInsertRange = imageFiles.length
          ? { from: selectionPosition, to: selectionPosition }
          : target.range
        const inserted = editor.value
          ?.chain()
          .focus()
          .insertContentAt(
            fileInsertRange,
            payloads.map((payload) => ({
              type: 'localFileBlock',
				attrs: {
					assetId: payload.assetId || '',
					url: payload.url,
                name: payload.name,
                size: Math.max(0, Number(payload.size ?? 0) || 0),
                mimeType: payload.mimeType || '',
              },
            })),
            { updateSelection: true },
          )
          .run()

        if (inserted) {
          payloads.forEach((payload) => emit('local-file-upload', payload))
        }

        return true
      },
      (error) => handleUploadError({ kind: 'file', fileName: localFiles[0]?.name || '', error }),
    )
  }
}

function handleDocumentMouseUp() {
  if (!marqueeGestureStart.value) {
    return
  }

  if (!isMarqueeSelecting.value && !selectedMarqueeBlockPositions.value.length) {
    clearMarqueeGesture()
    return
  }

  syncMarqueeSelection()
  clearMarqueeGesture()
}

function toggleInsertMenu() {
  if (!hasInsertMenuItems.value) {
    return
  }

  isInsertMenuOpen.value = !isInsertMenuOpen.value
  if (!isInsertMenuOpen.value) {
    activeInsertSubmenu.value = null
    hoveredTableRows.value = 0
    hoveredTableCols.value = 0
    hoveredColumnsCount.value = 0
    resetCountdownInsertDraft()
  } else {
    resetCountdownInsertDraft()
  }
  isHeadingMenuOpen.value = false
  isFontFamilyMenuOpen.value = false
  isScriptMenuOpen.value = false
  isFontSizeMenuOpen.value = false
  isColorMenuOpen.value = false
  isHighlightMenuOpen.value = false
  isQuoteMenuOpen.value = false
}

function getSlashRange() {
  if (!editor.value || !editorEditable.value || isEditorComposing.value || !editor.value.isFocused) return null
  const selection = editor.value.state.selection
  if (!(selection instanceof TextSelection) || !selection.empty || selection.$from.parent.type.name !== 'paragraph') return null
  const { $from } = selection
  if ($from.parentOffset !== $from.parent.content.size) return null
  const text = $from.parent.textContent
  const match = /^\/([^\s/]*)$/.exec(text)
  return match ? { from: $from.start(), to: selection.from, query: match[1] } : null
}

function closeSlashMenu(dismiss = false) {
  if (dismiss && slashRange.value) slashDismissedAt.value = `${slashRange.value.from}:${slashQuery.value}`
  slashQuery.value = null
  slashRange.value = null
  selectedSlashIndex.value = 0
}

function syncSlashMenuPosition() {
  if (!isSlashMenuOpen.value || !editor.value) return
  const caret = editor.value.view.coordsAtPos(slashRange.value!.to)
  const width = Math.min(250, window.innerWidth - 16)
  const height = Math.min(680, (slashMenuRef.value?.scrollHeight ?? 678) + 2, window.innerHeight - 16)
  const below = caret.bottom + 8 + height <= window.innerHeight - 8
  slashMenuPosition.value = {
    left: Math.max(8, Math.min(caret.left, window.innerWidth - width - 8)),
    top: Math.max(8, Math.min(below ? caret.bottom + 8 : caret.top - height - 8, window.innerHeight - height - 8)),
    maxHeight: height,
  }
}

function syncSlashMenu() {
  const range = getSlashRange()
  if (!range) {
    slashDismissedAt.value = null
    closeSlashMenu()
    return
  }
  if (slashDismissedAt.value === `${range.from}:${range.query}`) {
    closeSlashMenu()
    return
  }
  if (slashQuery.value !== range.query || slashRange.value?.from !== range.from) selectedSlashIndex.value = 0
  slashQuery.value = range.query
  slashRange.value = { from: range.from, to: range.to }
  void nextTick(syncSlashMenuPosition)
}

function runSlashCommand(command: { action: string }) {
  const range = getSlashRange()
  if (!range || !slashRange.value || range.from !== slashRange.value.from || range.to !== slashRange.value.to) return
  closeSlashMenu()
  editor.value?.chain().focus().deleteRange({ from: range.from, to: range.to }).run()
  if (command.action === 'table') insertTable(3, 3)
  else if (command.action === 'columns') insertColumnsBlock(2)
  else if (command.action === 'emoji') isSlashEmojiPickerOpen.value = true
  else handleInsertAction(command.action)
}

function handleSlashEmojiSelect(emoji: string) {
  isSlashEmojiPickerOpen.value = false
  insertEmojiFromPicker(emoji)
}

function handleSlashMenuKeyDown(event: KeyboardEvent) {
  if (isSlashEmojiPickerOpen.value && event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    isSlashEmojiPickerOpen.value = false
    return true
  }
  if (!isSlashMenuOpen.value || !editor.value?.view.dom.contains(event.target as Node)) return false
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    closeSlashMenu(true)
    return true
  }
  const items = visibleSlashCommands.value
  if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && items.length) {
    event.preventDefault()
    event.stopPropagation()
    selectedSlashIndex.value = (selectedSlashIndex.value + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    slashMenuRef.value?.querySelectorAll<HTMLElement>('[role="option"]')[selectedSlashIndex.value]?.scrollIntoView({ block: 'nearest' })
    return true
  }
  if ((event.key === 'Enter' || event.key === 'Tab') && items[selectedSlashIndex.value]) {
    event.preventDefault()
    event.stopPropagation()
    runSlashCommand(items[selectedSlashIndex.value])
    return true
  }
  return false
}

function handlePageEditorKeyDown(event: KeyboardEvent) {
  if (!handleSlashMenuKeyDown(event)) handlePageEditorInput(event)
}

function toggleAlignMenu() {
  if (!canOpenAlignMenu.value) {
    return
  }

  isAlignMenuOpen.value = !isAlignMenuOpen.value
  isInsertMenuOpen.value = false
}

function applyTextAlign(alignment: 'left' | 'center' | 'right') {
  getActiveSelectionChain()?.setTextAlign(alignment).run()
  isAlignMenuOpen.value = false
}

function setActiveInsertSubmenu(key: string | null) {
  activeInsertSubmenu.value = key
  if (key !== 'table') {
    hoveredTableRows.value = 0
    hoveredTableCols.value = 0
  }
  if (key !== 'columns') {
    hoveredColumnsCount.value = 0
  }
  if (key !== 'countdown') {
    isCountdownDeadlinePickerOpen.value = false
  }
  if (key === 'countdown' && !countdownDeadlineInput.value) {
    resetCountdownInsertDraft()
  }
}

function hoverTableSize(rows: number, cols: number) {
  hoveredTableRows.value = rows
  hoveredTableCols.value = cols
}

function clearTableHover() {
  hoveredTableRows.value = 0
  hoveredTableCols.value = 0
}

function hoverColumnsSize(count: number) {
  hoveredColumnsCount.value = count
}

function clearColumnsHover() {
  hoveredColumnsCount.value = 0
}

function setColumnsMenuItemRef(element: Element | ComponentPublicInstance | null) {
  if (element instanceof HTMLElement) {
    columnsMenuItemRef.value = element
    return
  }

  const maybeElement = element && '$el' in element ? element.$el : null
  columnsMenuItemRef.value = maybeElement instanceof HTMLElement ? maybeElement : null
}

function setCountdownMenuItemRef(element: Element | ComponentPublicInstance | null) {
  if (element instanceof HTMLElement) {
    countdownMenuItemRef.value = element
    return
  }

  const maybeElement = element && '$el' in element ? element.$el : null
  countdownMenuItemRef.value = maybeElement instanceof HTMLElement ? maybeElement : null
}

function syncInsertMenuScrollState(event: Event) {
  const target = event.target
  insertMenuScrollTop.value = target instanceof HTMLElement ? target.scrollTop : 0
}

function findClosestElement(node: Node | null, selector: string) {
  const element = node instanceof Element ? node : node?.parentElement ?? null
  return element?.closest(selector) ?? null
}

function clearActiveTableState() {
  detachTableWrapperListeners?.()
  detachTableWrapperListeners = null
  activeTableWrapperElement.value?.classList.remove('norio-office-rich-table-wrapper--active')
  activeTableElement.value = null
  activeTableWrapperElement.value = null
  activeTableMetrics.value = null
  tableColumnHandles.value = []
  tableRowHandles.value = []
  tableColumnAddPoints.value = []
  tableRowAddPoints.value = []
  selectedTableColumnIndex.value = null
  selectedTableRowIndex.value = null
}


function syncActiveCountdownBlockState() {
  if (!editor.value?.isActive('countdownBlock')) {
    activeCountdownBlockElement.value = null
    activeCountdownBlockPos.value = null
    isCountdownBlockEditOpen.value = false
    return
  }

  const selection = editor.value.state.selection
  if (selection instanceof NodeSelection && selection.node.type.name === 'countdownBlock') {
    const nodeDom = editor.value.view.nodeDOM(selection.from)
    activeCountdownBlockElement.value = nodeDom instanceof HTMLElement ? nodeDom : null
    activeCountdownBlockPos.value = selection.from
    return
  }

  activeCountdownBlockElement.value = findClosestElement(window.getSelection()?.anchorNode ?? null, '.norio-office-rich-countdown-block') as HTMLElement | null
  activeCountdownBlockPos.value = null
}

function syncActiveTableState() {
  if (!editor.value?.isActive('table') || !pageRef.value) {
    clearActiveTableState()
    return
  }

  const selection = editor.value.state.selection
  let tablePos: number | null = selection instanceof NodeSelection && selection.node.type.name === 'table' ? selection.from : null
  for (let depth = selection.$from.depth; tablePos === null && depth > 0; depth -= 1) {
    if (selection.$from.node(depth).type.name === 'table') tablePos = selection.$from.before(depth)
  }
  const tableDom = tablePos === null ? null : editor.value.view.nodeDOM(tablePos)
  const table = tableDom instanceof HTMLTableElement ? tableDom : tableDom instanceof Element ? tableDom.querySelector('table') : null
  const wrapper = table?.closest('.tableWrapper') as HTMLElement | null
  if (!table || !wrapper) {
    clearActiveTableState()
    return
  }

  if (activeTableWrapperElement.value && activeTableWrapperElement.value !== wrapper) {
    activeTableWrapperElement.value.classList.remove('norio-office-rich-table-wrapper--active')
  }

  if (activeTableWrapperElement.value !== wrapper) {
    detachTableWrapperListeners?.()
    const handleWrapperScroll = () => {
      queueTableStateSync()
    }
    wrapper.addEventListener('scroll', handleWrapperScroll, { passive: true })
    detachTableWrapperListeners = () => {
      wrapper.removeEventListener('scroll', handleWrapperScroll)
    }
  }

  wrapper.classList.add('norio-office-rich-table-wrapper--active')
  activeTableElement.value = table
  activeTableWrapperElement.value = wrapper

  const pageRect = pageRef.value.getBoundingClientRect()
  const wrapperRect = wrapper.getBoundingClientRect()
  const scale = zoomScale.value || 1

  activeTableMetrics.value = {
    left: (wrapperRect.left - pageRect.left) / scale,
    top: (wrapperRect.top - pageRect.top) / scale,
    width: wrapperRect.width / scale,
    height: wrapperRect.height / scale,
  }

  const firstRow = table.rows.item(0)
  const nextColumnHandles: Array<{ index: number; left: number; width: number }> = []
  const nextColumnAddPoints: Array<{ key: string; insertIndex: number; left: number }> = []

  if (firstRow) {
    const visibleCells = Array.from(firstRow.cells)
      .map((cell, index) => {
        const rect = cell.getBoundingClientRect()
        const visibleLeft = Math.max(rect.left, wrapperRect.left)
        const visibleRight = Math.min(rect.right, wrapperRect.right)
        const visibleWidth = visibleRight - visibleLeft
        if (visibleWidth < 8) {
          return null
        }

        return {
          index,
          left: (visibleLeft - pageRect.left) / scale,
          width: visibleWidth / scale,
          rawLeft: rect.left,
          rawRight: rect.right,
        }
      })
      .filter(
        (
          cell,
        ): cell is {
          index: number
          left: number
          width: number
          rawLeft: number
          rawRight: number
        } => !!cell,
      )

    nextColumnHandles.push(
      ...visibleCells.map((cell) => ({
        index: cell.index,
        left: cell.left,
        width: cell.width,
      })),
    )

    visibleCells.forEach((cell, visibleIndex) => {
      if (cell.rawLeft >= wrapperRect.left - 0.5) {
        nextColumnAddPoints.push({
          key: `column-before-${cell.index}`,
          insertIndex: cell.index,
          left: (cell.rawLeft - pageRect.left) / scale,
        })
      }

      if (visibleIndex === visibleCells.length - 1 && cell.rawRight <= wrapperRect.right + 0.5) {
        nextColumnAddPoints.push({
          key: `column-after-${cell.index}`,
          insertIndex: cell.index + 1,
          left: (cell.rawRight - pageRect.left) / scale,
        })
      }
    })
  }

  const nextRowHandles: Array<{ index: number; top: number; height: number }> = []
  const nextRowAddPoints: Array<{ key: string; insertIndex: number; top: number }> = []
  const visibleRows = Array.from(table.rows)
    .map((row, index) => {
      const firstCell = row.cells.item(0) ?? row
      const rect = firstCell.getBoundingClientRect()
      const visibleTop = Math.max(rect.top, wrapperRect.top)
      const visibleBottom = Math.min(rect.bottom, wrapperRect.bottom)
      const visibleHeight = visibleBottom - visibleTop
      if (visibleHeight < 8) {
        return null
      }

      return {
        index,
        top: (visibleTop - pageRect.top) / scale,
        height: visibleHeight / scale,
        rawTop: rect.top,
        rawBottom: rect.bottom,
      }
    })
    .filter(
      (
        row,
      ): row is {
        index: number
        top: number
        height: number
        rawTop: number
        rawBottom: number
      } => !!row,
    )

  nextRowHandles.push(
    ...visibleRows.map((row) => ({
      index: row.index,
      top: row.top,
      height: row.height,
    })),
  )

  visibleRows.forEach((row, visibleIndex) => {
    if (row.rawTop >= wrapperRect.top - 0.5) {
      nextRowAddPoints.push({
        key: `row-before-${row.index}`,
        insertIndex: row.index,
        top: (row.rawTop - pageRect.top) / scale,
      })
    }

    if (visibleIndex === visibleRows.length - 1 && row.rawBottom <= wrapperRect.bottom + 0.5) {
      nextRowAddPoints.push({
        key: `row-after-${row.index}`,
        insertIndex: row.index + 1,
        top: (row.rawBottom - pageRect.top) / scale,
      })
    }
  })

  tableColumnHandles.value = nextColumnHandles
  tableRowHandles.value = nextRowHandles
  tableColumnAddPoints.value = nextColumnAddPoints
  tableRowAddPoints.value = nextRowAddPoints

}

function queueTableStateSync() {
  void nextTick(() => {
    syncActiveTableState()
    syncActiveCountdownBlockState()
  })
}


function shouldShowCountdownBlockBubbleMenu() {
  return false
}

function getTableBubbleVirtualElement() {
  if (!activeTableElement.value) {
    return null
  }

  return {
    getBoundingClientRect: () => activeTableElement.value!.getBoundingClientRect(),
    contextElement: activeTableElement.value,
  }
}


function getCountdownBlockBubbleVirtualElement() {
  if (!activeCountdownBlockElement.value) {
    return null
  }

  return {
    getBoundingClientRect: () => activeCountdownBlockElement.value!.getBoundingClientRect(),
    contextElement: activeCountdownBlockElement.value,
  }
}

function toggleTableActionColorMenu() {
  isTableThemeMenuOpen.value = false
  isTableActionColorMenuOpen.value = !isTableActionColorMenuOpen.value
}

function toggleTableThemeMenu() {
  isTableActionColorMenuOpen.value = false
  isTableThemeMenuOpen.value = !isTableThemeMenuOpen.value
}

function syncTableThemeMenuPosition() {
  if (blockSideMenuMode.value || isTableThemeMenuOpen.value || ['table-theme', 'properties', 'color', 'divider-style', 'divider-color', 'highlight-settings', ...blockSideSurfaceColorModes].includes(blockSideSubmenuMode.value ?? '')) {
    tableThemeMenuViewportVersion.value += 1
  }
}

function openBlockSideTableTheme() {
  const control = visibleBlockSideControl.value
  if (!editor.value?.isEditable || control?.node.type.name !== 'table') return
  keepBlockSideControl(control)
  blockSideTableThemePos.value = control.from
  blockSideSubmenuMode.value = 'table-theme'
  isTableThemeMenuOpen.value = false
  isTableActionColorMenuOpen.value = false
}

function applyBlockSideTableTheme(theme: TableThemeColors | null) {
  if (blockSideTableThemePos.value !== null) updateTableThemeAt(blockSideTableThemePos.value, theme)
}

function closeBlockSideTableTheme() {
  blockSideSubmenuMode.value = null
  blockSideTableThemePos.value = null
}

function applyTableTheme(theme: TableThemeColors | null) {
  if (!editor.value?.isEditable) return
  const selection = editor.value.state.selection
  const table = selection instanceof NodeSelection && selection.node.type.name === 'table'
    ? { node: selection.node, pos: selection.from, start: selection.from + 1 }
    : findTable(selection.$from)
  if (!table) return
  updateTableThemeAt(table.pos, theme)
}

function updateTableThemeAt(pos: number, theme: TableThemeColors | null) {
  if (!editor.value?.isEditable) return
  const node = editor.value.state.doc.nodeAt(pos)
  if (node?.type.name !== 'table') return
  const normalized = normalizeTableTheme(theme)
  const transaction = editor.value.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, tableTheme: normalized })
  node.forEach((row, rowOffset) => {
    row.forEach((cell, cellOffset) => {
      if (cell.attrs.backgroundColor) {
        transaction.setNodeMarkup(pos + rowOffset + cellOffset + 2, undefined, { ...cell.attrs, backgroundColor: null })
      }
    })
  })
  editor.value.view.dispatch(transaction)
  queueTableStateSync()
}

function applyTableCellBackgroundColor(color: string | null) {
  if (!editor.value) {
    return
  }

  editor.value.chain().focus().setCellAttribute('backgroundColor', color).run()
  isTableActionColorMenuOpen.value = false
  queueTableStateSync()
}


function selectTableColumn(index: number) {
  if (!editor.value || !activeTableElement.value) {
    return
  }

  const table = findTable(editor.value.state.selection.$from)
  if (!table) {
    return
  }

  const map = TableMap.get(table.node)
  if (index < 0 || index >= map.width) {
    return
  }

  const anchorPos = table.start + map.positionAt(0, index, table.node)
  const headPos = table.start + map.positionAt(map.height - 1, index, table.node)
  const anchorCell = editor.value.state.doc.resolve(anchorPos)
  const headCell = editor.value.state.doc.resolve(headPos)
  const selection = CellSelection.colSelection(anchorCell, headCell)

  editor.value.view.dispatch(editor.value.state.tr.setSelection(selection).scrollIntoView())
  selectedTableColumnIndex.value = index
  selectedTableRowIndex.value = null
  queueTableStateSync()
}

function selectTableRow(index: number) {
  if (!editor.value || !activeTableElement.value) {
    return
  }

  const table = findTable(editor.value.state.selection.$from)
  if (!table) {
    return
  }

  const map = TableMap.get(table.node)
  if (index < 0 || index >= map.height) {
    return
  }

  const anchorPos = table.start + map.positionAt(index, 0, table.node)
  const headPos = table.start + map.positionAt(index, map.width - 1, table.node)
  const anchorCell = editor.value.state.doc.resolve(anchorPos)
  const headCell = editor.value.state.doc.resolve(headPos)
  const selection = CellSelection.rowSelection(anchorCell, headCell)

  editor.value.view.dispatch(editor.value.state.tr.setSelection(selection).scrollIntoView())
  selectedTableRowIndex.value = index
  selectedTableColumnIndex.value = null
  queueTableStateSync()
}

function insertTableColumnAt(insertIndex: number) {
  if (!editor.value || !activeTableElement.value) {
    return
  }

  const firstRow = activeTableElement.value.rows.item(0)
  const cells = firstRow ? Array.from(firstRow.cells) : []
  if (cells.length === 0) {
    return
  }

  if (insertIndex <= 0) {
    const targetCell = cells[0]
    const cellPos = editor.value.view.posAtDOM(targetCell, 0) + 1
    editor.value.chain().focus(cellPos).addColumnBefore().run()
  } else {
    const targetCell = cells[Math.min(insertIndex - 1, cells.length - 1)]
    const cellPos = editor.value.view.posAtDOM(targetCell, 0) + 1
    editor.value.chain().focus(cellPos).addColumnAfter().run()
  }

  selectedTableColumnIndex.value = null
  selectedTableRowIndex.value = null
  queueTableStateSync()
}

function insertTableRowAt(insertIndex: number) {
  if (!editor.value || !activeTableElement.value) {
    return
  }

  const rows = Array.from(activeTableElement.value.rows)
  if (rows.length === 0) {
    return
  }

  if (insertIndex <= 0) {
    const targetCell = rows[0].cells.item(0)
    if (!targetCell) {
      return
    }

    const cellPos = editor.value.view.posAtDOM(targetCell, 0) + 1
    editor.value.chain().focus(cellPos).addRowBefore().run()
  } else {
    const targetRow = rows[Math.min(insertIndex - 1, rows.length - 1)]
    const targetCell = targetRow.cells.item(0)
    if (!targetCell) {
      return
    }

    const cellPos = editor.value.view.posAtDOM(targetCell, 0) + 1
    editor.value.chain().focus(cellPos).addRowAfter().run()
  }

  selectedTableColumnIndex.value = null
  selectedTableRowIndex.value = null
  queueTableStateSync()
}


function insertTable(rows: number, cols: number) {
  if (!editor.value) {
    return
  }

  const range = getCurrentBlockRange()
  if (!range) {
    isInsertMenuOpen.value = false
    activeInsertSubmenu.value = null
    clearTableHover()
    return
  }

  editor.value.chain().focus().deleteRange(range).insertTable({ rows, cols, withHeaderRow: false }).run()

  isInsertMenuOpen.value = false
  activeInsertSubmenu.value = null
  clearTableHover()
  queueTableStateSync()
}

function addTableRow() {
  editor.value?.chain().focus().addRowAfter().run()
  queueTableStateSync()
}

function addTableRowBefore() {
  if (!canInsertRowAround.value) {
    return
  }

  editor.value?.chain().focus().addRowBefore().run()
  queueTableStateSync()
}

function addTableColumn() {
  editor.value?.chain().focus().addColumnAfter().run()
  queueTableStateSync()
}

function addTableRowAfter() {
  if (!canInsertRowAround.value) {
    return
  }

  editor.value?.chain().focus().addRowAfter().run()
  queueTableStateSync()
}

function addTableColumnBefore() {
  if (!canInsertColumnAround.value) {
    return
  }

  editor.value?.chain().focus().addColumnBefore().run()
  queueTableStateSync()
}

function addTableColumnAfter() {
  if (!canInsertColumnAround.value) {
    return
  }

  editor.value?.chain().focus().addColumnAfter().run()
  queueTableStateSync()
}

function deleteTableRow() {
  editor.value?.chain().focus().deleteRow().run()
  queueTableStateSync()
}

function deleteTableColumn() {
  editor.value?.chain().focus().deleteColumn().run()
  queueTableStateSync()
}

function mergeTableCells() {
  editor.value?.chain().focus().mergeCells().run()
  queueTableStateSync()
}

function splitTableCell() {
  editor.value?.chain().focus().splitCell().run()
  queueTableStateSync()
}

function toggleTableHeaderRow() {
  editor.value?.chain().focus().toggleHeaderRow().run()
  queueTableStateSync()
}

function deleteCurrentTable() {
  editor.value?.chain().focus().deleteTable().run()
  queueTableStateSync()
}

function clearSelectedTableCells() {
  if (!editor.value) {
    return
  }

  const selection = editor.value.state.selection
  const tr = editor.value.state.tr

  if (selection instanceof CellSelection) {
    const replacements: Array<{ pos: number; node: typeof selection.$anchorCell.nodeAfter }> = []
    selection.forEachCell((node, pos) => {
      replacements.push({ pos, node })
    })

    for (let index = replacements.length - 1; index >= 0; index -= 1) {
      const cell = replacements[index]
      if (!cell.node) {
        continue
      }

      const emptyCell = cell.node.type.createAndFill(cell.node.attrs)
      if (!emptyCell) {
        continue
      }

      tr.replaceWith(cell.pos, cell.pos + cell.node.nodeSize, emptyCell)
    }

    editor.value.view.dispatch(tr.scrollIntoView())
    queueTableStateSync()
    return
  }

  try {
    const $cell = selectionCell(editor.value.state)
    const cellNode = $cell.nodeAfter
    if (!cellNode) {
      return
    }

    const emptyCell = cellNode.type.createAndFill(cellNode.attrs)
    if (!emptyCell) {
      return
    }

    const singleCellTr = editor.value.state.tr.replaceWith($cell.pos, $cell.pos + cellNode.nodeSize, emptyCell)
    editor.value.view.dispatch(singleCellTr.scrollIntoView())
    queueTableStateSync()
  } catch {
    // no-op
  }
}

function deleteTableSelection() {
  if (!editor.value || !canDeleteTableSelection.value) {
    return
  }

  if (currentTableSelection.value.isRowSelection) {
    deleteTableRow()
    return
  }

  if (currentTableSelection.value.isColumnSelection) {
    deleteTableColumn()
    return
  }

  clearSelectedTableCells()
}

function buildColumnsContent(count: number): JSONContent {
  return {
    type: 'columnsBlock',
    attrs: {
      widths: Array.from({ length: count }, () => 100 / count),
    },
    content: Array.from({ length: count }, () => ({
      type: 'columnsColumn',
      content: [{ type: 'paragraph' }],
    })),
  }
}

function buildInsertContent(action: string): JSONContent | JSONContent[] | null {
  switch (action) {
    case 'paragraph':
      return { type: 'paragraph' }
    case 'heading-1':
      return { type: 'heading', attrs: { level: 1 } }
    case 'heading-2':
      return { type: 'heading', attrs: { level: 2 } }
    case 'heading-3':
      return { type: 'heading', attrs: { level: 3 } }
    case 'heading-4':
      return { type: 'heading', attrs: { level: 4 } }
    case 'heading-5':
      return { type: 'heading', attrs: { level: 5 } }
    case 'heading-6':
      return { type: 'heading', attrs: { level: 6 } }
    case 'bullet-list':
      return {
        type: 'bulletList',
        content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
      }
    case 'ordered-list':
      return {
        type: 'orderedList',
        content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
      }
    case 'task-list':
      return {
        type: 'taskList',
        content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }],
      }
    case 'code-block':
      return {
        type: 'codeBlock',
        attrs: {
          language: 'plain_text',
          wrapLines: false,
          darkTheme: false,
          fixedHeight: false,
        },
      }
    case 'highlight-block':
      return {
        type: 'highlightBlock',
        attrs: {
          titleEnabled: true,
          emojiEnabled: true,
          title: '高亮块',
          emoji: '✍️',
        },
        content: [{ type: 'paragraph' }],
      }
    case 'blockquote':
      return {
        type: 'blockquote',
        content: [{ type: 'paragraph' }],
      }
    case 'divider':
      return [{ type: 'horizontalRule' }, { type: 'paragraph' }]
    default:
      return null
  }
}

function insertEmojiFromPicker(emoji: string) {
  if (!editor.value) {
    return
  }

  editor.value.chain().focus().insertContent(emoji).run()
  isInsertMenuOpen.value = false
  isEmojiToolbarMenuOpen.value = false
  activeInsertSubmenu.value = null
  clearTableHover()
}

function insertColumnsBlock(count: number) {
  if (!editor.value) {
    return
  }

  const range = getCurrentBlockRange()
  if (!range) {
    isInsertMenuOpen.value = false
    activeInsertSubmenu.value = null
    clearTableHover()
    clearColumnsHover()
    return
  }

  editor.value
    .chain()
    .focus()
    .insertContentAt({ from: range.from, to: range.to }, buildColumnsContent(count), { updateSelection: true })
    .run()

  isInsertMenuOpen.value = false
  activeInsertSubmenu.value = null
  clearTableHover()
  clearColumnsHover()
}

function insertCountdownBlock() {
  if (!editor.value) {
    return
  }

  const range = getCurrentBlockRange()
  if (!range) {
    isInsertMenuOpen.value = false
    activeInsertSubmenu.value = null
    resetCountdownInsertDraft()
    return
  }

  editor.value
    .chain()
    .focus()
    .insertContentAt(
      { from: range.from, to: range.to },
      {
        type: 'countdownBlock',
        attrs: {
          targetTimestamp: 0,
          mode: 'duration',
          color: '#ff8b00',
          reminderEnabled: true,
        },
      },
      { updateSelection: true },
    )
    .run()

  isInsertMenuOpen.value = false
  activeInsertSubmenu.value = null
  resetCountdownInsertDraft()
}

function resolveCountdownTargetTimestamp() {
  if (countdownInsertMode.value === 'deadline') {
    return new Date(countdownDeadlineInput.value).getTime()
  }

  const days = parseCountdownNumber(countdownDurationDays.value)
  const hours = parseCountdownNumber(countdownDurationHours.value, 23)
  const minutes = parseCountdownNumber(countdownDurationMinutes.value, 59)
  const seconds = parseCountdownNumber(countdownDurationSeconds.value, 59)
  return Date.now() + (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000
}

function updateSelectedCountdownBlock() {
  if (!editor.value || activeCountdownBlockPos.value === null) {
    return
  }

  const targetTimestamp = resolveCountdownTargetTimestamp()
  if (!Number.isFinite(targetTimestamp) || targetTimestamp <= Date.now()) {
    return
  }

  editor.value
    .chain()
    .focus()
    .setNodeSelection(activeCountdownBlockPos.value)
    .updateAttributes('countdownBlock', {
      targetTimestamp: Math.floor(targetTimestamp),
      mode: countdownInsertMode.value,
    })
    .run()

  isCountdownDeadlinePickerOpen.value = false
  isCountdownBlockEditOpen.value = false
  queueTableStateSync()
}

function deleteSelectedCountdownBlock() {
  if (!editor.value || activeCountdownBlockPos.value === null) {
    return
  }

  const node = editor.value.state.doc.nodeAt(activeCountdownBlockPos.value)
  if (!node || node.type.name !== 'countdownBlock') {
    return
  }

  editor.value
    .chain()
    .focus()
    .deleteRange({ from: activeCountdownBlockPos.value, to: activeCountdownBlockPos.value + node.nodeSize })
    .run()
  isCountdownDeadlinePickerOpen.value = false
  isCountdownBlockEditOpen.value = false
  activeCountdownBlockElement.value = null
  activeCountdownBlockPos.value = null
}

function closeFormulaDialog() {
  isFormulaDialogOpen.value = false
  formulaDraft.value = ''
}

function openMarkdownImportPicker() {
  if (!markdownImportInputRef.value) {
    return
  }

  markdownImportInputRef.value.value = ''
  markdownImportInputRef.value.click()
}

async function handleMarkdownImportChange(event: Event) {
  if (!editor.value) {
    return
  }

  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) {
    return
  }

  const markdown = await file.text()
  const importedContent = parseMarkdownToContent(markdown)
  const range = getCurrentBlockRange()
  if (!range) {
    return
  }

  editor.value.chain().focus().insertContentAt({ from: range.from, to: range.to }, importedContent, { updateSelection: true }).run()

  isInsertMenuOpen.value = false
  activeInsertSubmenu.value = null
  clearTableHover()
  target.value = ''
}

function insertFormulaBlock(latex: string) {
  if (!editor.value) {
    return
  }

  const range = getCurrentBlockRange()
  if (!range) {
    closeFormulaDialog()
    isInsertMenuOpen.value = false
    activeInsertSubmenu.value = null
    clearTableHover()
    return
  }

  editor.value
    .chain()
    .focus()
    .insertContentAt(
      { from: range.from, to: range.to },
      {
        type: 'formulaBlock',
        attrs: {
          latex,
        },
      },
      { updateSelection: true },
    )
    .run()

  closeFormulaDialog()
  isInsertMenuOpen.value = false
  activeInsertSubmenu.value = null
  clearTableHover()
}

function insertBlockAtCurrentRange(content: JSONContent) {
  if (!editor.value) {
    return false
  }

  const range = getCurrentBlockRange()
  if (!range) {
    return false
  }

  editor.value.chain().focus().insertContentAt({ from: range.from, to: range.to }, content, { updateSelection: true }).run()
  return true
}

function normalizeImagePayload(payload: RichTextEditorImagePayload): ImageBlockItem {
	return {
		id: createImagePlaceholderId(),
		assetId: payload.assetId,
    src: payload.src,
    alt: payload.alt || payload.name || '',
    name: payload.name || payload.alt || '',
    description: payload.description || '',
    descriptionVisible: payload.descriptionVisible,
    link: payload.link || '',
    linkTarget: payload.linkTarget,
    rotation: Number(payload.rotation ?? 0) || 0,
  }
}

function insertExternalImage(payload: RichTextEditorImagePayload | RichTextEditorImagePayload[]) {
  const items = (Array.isArray(payload) ? payload : [payload]).filter((item) => item?.src).slice(0, 4)
  if (!items.length) {
    return false
  }

  return insertBlockAtCurrentRange({
    type: 'imageBlock',
    attrs: {
      images: items.map(normalizeImagePayload),
      widthPercent: 100,
      align: 'left',
      height: 146,
    },
  })
}

function insertExternalVideo(payload: RichTextEditorVideoPayload) {
  if (!payload.src) {
    return false
  }

  return insertBlockAtCurrentRange({
    type: 'videoBlock',
		attrs: {
			assetId: payload.assetId || '',
			src: payload.src,
      name: payload.name || '',
      description: payload.description || '',
      mimeType: payload.mimeType || 'video/mp4',
      align: payload.align || 'left',
      widthPercent: Math.max(30, Math.min(100, Number(payload.widthPercent ?? 100) || 100)),
      height: Math.max(180, Math.min(640, Number(payload.height ?? 220) || 220)),
    },
  })
}

function insertExternalFile(payload: RichTextEditorFilePayload) {
  if (!payload.url || !payload.name) {
    return false
  }

  const displayMode = payload.displayMode === 'card' || payload.displayMode === 'preview' ? payload.displayMode : 'text'
  const defaultHeight = displayMode === 'preview' ? 420 : 420

  return insertBlockAtCurrentRange({
    type: 'linkBlock',
    attrs: {
      title: payload.name,
      url: payload.url,
      displayMode,
      align: payload.align || 'left',
      widthPercent: Math.max(30, Math.min(100, Number(payload.widthPercent ?? 100) || 100)),
      height: Math.max(240, Math.min(860, Number(payload.height ?? defaultHeight) || defaultHeight)),
    },
  })
}

function insertExternalLocalFile(payload: RichTextEditorLocalFilePayload) {
  if (!payload.url || !payload.name) {
    return false
  }

	return insertBlockAtCurrentRange({
		type: 'localFileBlock',
		attrs: {
			assetId: payload.assetId || '',
			url: payload.url,
      name: payload.name,
      size: Math.max(0, Number(payload.size ?? 0) || 0),
      mimeType: payload.mimeType || '',
    },
  })
}

function createCommentId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function getActiveCommentUser() {
  return activeCommentUser.value
}

function getCommentAvatarText(user?: RichTextEditorCommentUser | null) {
  const source = user?.name || user?.id || '?'
  return source.slice(0, 2).toUpperCase()
}

function getCommentAvatarStyle(user?: RichTextEditorCommentUser | null) {
  return {
    backgroundColor: user?.color || '#4c7dff',
  }
}

function getCommentTimeLabel(value?: string) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const delta = Date.now() - date.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (delta < minute) {
    return '刚刚'
  }

  if (delta < hour) {
    return `${Math.max(1, Math.floor(delta / minute))} 分钟前`
  }

  if (delta < day) {
    return `${Math.floor(delta / hour)} 小时前`
  }

  return date.toLocaleDateString()
}

function getCommentDraftKey(threadId: string, parentId?: string) {
  return parentId ? `${threadId}:${parentId}` : threadId
}

function getCommentDraft(threadId: string, parentId?: string) {
  return commentDrafts.value[getCommentDraftKey(threadId, parentId)] ?? ''
}

function setCommentDraft(threadId: string, value: string, parentId?: string) {
  const draftKey = getCommentDraftKey(threadId, parentId)
  commentDrafts.value = {
    ...commentDrafts.value,
    [draftKey]: value,
  }
}

function handleCommentDraftInput(threadId: string, event: Event, parentId?: string) {
  const textarea = event.target as HTMLTextAreaElement | null
  setCommentDraft(threadId, textarea?.value ?? '', parentId)
  syncCommentMentionPanel(textarea, { mode: 'draft', threadId, parentId })
}

function handleCommentDraftKeyDown(threadId: string, event: KeyboardEvent, parentId?: string) {
  if (handleCommentMentionKeyDown(event)) {
    event.preventDefault()
    event.stopPropagation()
    return
  }

  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    submitComment(threadId, parentId)
  }
}

function getCommentDraftImages(threadId: string, parentId?: string) {
  return commentImageDrafts.value[getCommentDraftKey(threadId, parentId)] ?? []
}

function setCommentDraftImages(threadId: string, images: RichTextEditorCommentImage[], parentId?: string) {
  const draftKey = getCommentDraftKey(threadId, parentId)
  commentImageDrafts.value = {
    ...commentImageDrafts.value,
    [draftKey]: images,
  }
}

function clearCommentDraft(threadId: string, parentId?: string) {
  const draftKey = getCommentDraftKey(threadId, parentId)
  const { [draftKey]: _draft, ...drafts } = commentDrafts.value
  const { [draftKey]: _images, ...images } = commentImageDrafts.value
  const { [draftKey]: _mentions, ...mentions } = commentMentionDrafts.value
  commentDrafts.value = drafts
  commentImageDrafts.value = images
  commentMentionDrafts.value = mentions
}

function getRootCommentItems(thread: RichTextEditorCommentThread) {
  return thread.comments.filter((item) => !item.parentId)
}

function getCommentReplies(thread: RichTextEditorCommentThread, item: RichTextEditorCommentItem) {
  const replies: RichTextEditorCommentItem[] = []
  const collect = (parentId: string) => {
    thread.comments
      .filter((reply) => reply.parentId === parentId)
      .forEach((reply) => {
        replies.push(reply)
        collect(reply.id)
      })
  }

  collect(item.id)
  return replies
}

function getThreadCommentById(thread: RichTextEditorCommentThread, commentId?: string) {
  return commentId ? thread.comments.find((item) => item.id === commentId) ?? null : null
}

function getReplyTargetId(threadId: string) {
  return commentReplyTargets.value[threadId] ?? null
}

function getReplyTarget(thread: RichTextEditorCommentThread) {
  return getThreadCommentById(thread, getReplyTargetId(thread.id) ?? undefined)
}

function isReplyTargetInComment(thread: RichTextEditorCommentThread, item: RichTextEditorCommentItem) {
  const targetId = getReplyTargetId(thread.id)

  if (!targetId) {
    return false
  }

  return targetId === item.id || getCommentReplies(thread, item).some((reply) => reply.id === targetId)
}

function startReplyComment(thread: RichTextEditorCommentThread, item: RichTextEditorCommentItem) {
  commentReplyTargets.value = {
    ...commentReplyTargets.value,
    [thread.id]: item.id,
  }
  selectedCommentThreadId.value = thread.id
}

function cancelCommentReply(threadId: string, parentId: string) {
  const { [threadId]: _target, ...targets } = commentReplyTargets.value
  commentReplyTargets.value = targets
  clearCommentDraft(threadId, parentId)
}

function getCommentThreadAnchorText(thread: RichTextEditorCommentThread) {
  return thread.anchorText?.trim() || '已标注内容'
}

function getCurrentCommentAnchorText() {
  if (!editor.value) {
    return ''
  }

  const { state } = editor.value
  const text = state.doc.textBetween(state.selection.from, state.selection.to, ' ').replace(/\s+/g, ' ').trim()
  return text || '已标注内容'
}

function getCommentTargetRange() {
  if (!editor.value) {
    return null
  }

  const selection = editor.value.state.selection

  if (!selection.empty && !(selection instanceof CellSelection)) {
    return {
      from: selection.from,
      to: selection.to,
    }
  }

  const blockRange = getCurrentBlockRange()

  if (blockRange && blockRange.to > blockRange.from) {
    return blockRange
  }

  return null
}

function getCommentAnchorText(range: { from: number; to: number }) {
  if (!editor.value) {
    return '已标注内容'
  }

  const text = editor.value.state.doc.textBetween(range.from, range.to, ' ').replace(/\s+/g, ' ').trim()
  return text || '已标注内容'
}

function applyCommentMarkToRange(threadId: string, range: { from: number; to: number }) {
  if (!editor.value || !threadId || range.to <= range.from) {
    return false
  }

  const markType = editor.value.state.schema.marks.commentMark

  if (!markType) {
    return false
  }

  let transaction = editor.value.state.tr
  let applied = false
  const mark = markType.create({ threadId })

  editor.value.state.doc.nodesBetween(range.from, range.to, (node, pos) => {
    if (!node.isText || !node.textContent.trim()) {
      return
    }

    const from = Math.max(pos, range.from)
    const to = Math.min(pos + node.nodeSize, range.to)

    if (to <= from) {
      return
    }

    transaction = transaction.addMark(from, to, mark)
    applied = true
  })

  if (!applied) {
    return false
  }

  editor.value.view.dispatch(transaction.scrollIntoView())
  editor.value.commands.focus()
  return true
}

function removeCommentMark(threadId: string) {
  if (!editor.value || !threadId) {
    return false
  }

  const markType = editor.value.state.schema.marks.commentMark

  if (!markType) {
    return false
  }

  let transaction = editor.value.state.tr
  let removed = false

  editor.value.state.doc.descendants((node, pos) => {
    if (!node.isText) {
      return
    }

    const matched = node.marks.some((mark) => mark.type === markType && mark.attrs.threadId === threadId)

    if (!matched) {
      return
    }

    transaction = transaction.removeMark(pos, pos + node.nodeSize, markType)
    removed = true
  })

  if (removed) {
    editor.value.view.dispatch(transaction)
  }

  return removed
}

function setCommentCardRef(threadId: string, element: Element | ComponentPublicInstance | null) {
  if (element instanceof HTMLElement) {
    commentCardElements.set(threadId, element)
    return
  }

  commentCardElements.delete(threadId)
}

function getCommentPanelScrollElement() {
  return commentPanelRef.value?.querySelector<HTMLElement>('.norio-office-rich-comment-panel__scroll') ?? null
}

function getEditorScrollElement() {
  return rootRef.value?.querySelector<HTMLElement>('.norio-office-rich-editor__scroll') ?? null
}

function scrollElementIntoContainer(element: HTMLElement, container: HTMLElement) {
  const elementRect = element.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  const offsetTop = elementRect.top - containerRect.top
  const centerOffset = Math.max(12, (containerRect.height - elementRect.height) / 2)
  const top = Math.max(0, container.scrollTop + offsetTop - centerOffset)

  container.scrollTo({ top, behavior: 'smooth' })
}

function findCommentMarkElement(threadId: string) {
  const marks = pageRef.value?.querySelectorAll<HTMLElement>('[data-comment-thread-id]') ?? []
  return Array.from(marks).find((mark) => mark.dataset.commentThreadId === threadId) ?? null
}

function scrollEditorCommentIntoView(threadId: string) {
  void nextTick(() => {
    const runScroll = () => {
      const mark = findCommentMarkElement(threadId)
      const scrollElement = getEditorScrollElement()

      if (!mark || !scrollElement) {
        return
      }

      scrollElementIntoContainer(mark, scrollElement)
    }

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => window.requestAnimationFrame(runScroll))

      if (typeof window.setTimeout === 'function') {
        window.setTimeout(runScroll, 120)
      }

      return
    }

    runScroll()
  })
}

function scrollCommentCardIntoView(threadId: string) {
  void nextTick(() => {
    const card = commentCardElements.get(threadId)
    const scrollElement = getCommentPanelScrollElement()

    if (!card || !scrollElement) {
      return
    }

    scrollElementIntoContainer(card, scrollElement)
  })
}

function focusCommentThread(threadId: string) {
  if (!editor.value || !threadId) {
    return false
  }

  const markType = editor.value.state.schema.marks.commentMark

  if (!markType) {
    return false
  }

  let from: number | null = null
  let to: number | null = null

  editor.value.state.doc.descendants((node, pos) => {
    if (from !== null || !node.isText) {
      return false
    }

    const matched = node.marks.some((mark) => mark.type === markType && mark.attrs.threadId === threadId)

    if (!matched) {
      return
    }

    from = pos
    to = pos + node.nodeSize
    return false
  })

  if (from === null || to === null) {
    return false
  }

  selectedCommentThreadId.value = threadId
  const selection = TextSelection.create(editor.value.state.doc, from, to)
  editor.value.view.dispatch(editor.value.state.tr.setSelection(selection))
  editor.value.view.dom.focus({ preventScroll: true })
  scrollEditorCommentIntoView(threadId)
  return true
}

function selectCommentThread(
  thread: RichTextEditorCommentThread,
  options: { focusEditor?: boolean; scrollCommentCard?: boolean } = {},
) {
  selectedCommentThreadId.value = thread.id

  if (options.focusEditor !== false) {
    const focused = focusCommentThread(thread.id)

    if (!focused) {
      scrollEditorCommentIntoView(thread.id)
    }
  }

  if (options.scrollCommentCard) {
    scrollCommentCardIntoView(thread.id)
  }

  emit('comment-select', thread)
}

function createCommentFromSelection() {
  const user = getActiveCommentUser()

  if (!editor.value || !user || !canCreateComment.value) {
    return
  }

  const range = getCommentTargetRange()

  if (!range) {
    return
  }

  const threadId = createCommentId('comment-thread')
  const anchorText = getCommentAnchorText(range)
  const success = applyCommentMarkToRange(threadId, range)

  if (!success) {
    return
  }

  pendingCommentThread.value = { id: threadId, anchorText }
  selectedCommentThreadId.value = threadId
  setCommentDraft(threadId, '')
  setCommentDraftImages(threadId, [])
}

function cancelPendingComment(threadId: string) {
  if (pendingCommentThread.value?.id !== threadId) {
    clearCommentDraft(threadId)
    return
  }

  removeCommentMark(threadId)
  pendingCommentThread.value = null
  selectedCommentThreadId.value = commentPanelThreads.value[0]?.id ?? null
  clearCommentDraft(threadId)
}

function submitComment(threadId: string, parentId?: string) {
  const user = getActiveCommentUser()
  const content = getCommentDraft(threadId, parentId).trim()
  const images = getCommentDraftImages(threadId, parentId)
  const mentions = pruneCommentMentions(content, getCommentDraftMentions(threadId, parentId))
  const thread = commentPanelThreads.value.find((item) => item.id === threadId)
  const targetComment = thread ? getThreadCommentById(thread, parentId) : null

  if (!user || (!content && !images.length)) {
    return
  }

  const createdAt = new Date().toISOString()

  if (pendingCommentThread.value?.id === threadId) {
    const commentId = createCommentId('comment')
    const payload: RichTextEditorCommentCreatePayload = {
      threadId,
      commentId,
      anchorText: pendingCommentThread.value.anchorText,
      content,
      images,
      mentions,
      author: user,
      createdAt,
    }

    emit('comment-create', payload)
    emit('comment-submit', {
      action: 'create',
      threadId,
      commentId,
      content,
      images,
      mentions,
      author: user,
      createdAt,
    })
    pendingCommentThread.value = null
  } else {
    const commentId = createCommentId('comment')
    const payload: RichTextEditorCommentReplyPayload = {
      threadId,
      commentId,
      parentId,
      targetCommentId: targetComment?.id,
      targetUserId: targetComment?.author.id,
      targetUserName: targetComment?.author.name,
      content,
      images,
      mentions,
      author: user,
      createdAt,
    }

    emit('comment-reply', payload)
    emit('comment-submit', {
      action: 'reply',
      threadId,
      commentId,
      targetCommentId: targetComment?.id,
      targetUserId: targetComment?.author.id,
      targetUserName: targetComment?.author.name,
      content,
      images,
      mentions,
      author: user,
      createdAt,
    })

    if (parentId) {
      const { [threadId]: _target, ...targets } = commentReplyTargets.value
      commentReplyTargets.value = targets
    }
  }

  clearCommentDraft(threadId, parentId)
}

function startEditComment(threadId: string, item: RichTextEditorCommentItem) {
  editingCommentKey.value = `${threadId}:${item.id}`
  editingCommentDraft.value = item.content
  editingCommentMentions.value = item.mentions ?? []
}

function isEditingComment(threadId: string, item: RichTextEditorCommentItem) {
  return editingCommentKey.value === `${threadId}:${item.id}`
}

function handleCommentEditInput(event: Event) {
  const textarea = event.target as HTMLTextAreaElement | null
  editingCommentDraft.value = textarea?.value ?? ''
  const [threadId = '', commentId = ''] = editingCommentKey.value?.split(':') ?? []
  syncCommentMentionPanel(textarea, { mode: 'edit', threadId, commentId })
}

function handleCommentEditKeyDown(threadId: string, item: RichTextEditorCommentItem, event: KeyboardEvent) {
  if (handleCommentMentionKeyDown(event)) {
    event.preventDefault()
    event.stopPropagation()
    return
  }

  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    submitEditComment(threadId, item)
  }
}

function cancelEditComment() {
  editingCommentKey.value = null
  editingCommentDraft.value = ''
  editingCommentMentions.value = []
  closeCommentMentionPanel()
}

function submitEditComment(threadId: string, item: RichTextEditorCommentItem) {
  const content = editingCommentDraft.value.trim()
  const mentions = pruneCommentMentions(content, editingCommentMentions.value)

  if (!content) {
    return
  }

  const updatedAt = new Date().toISOString()
  const payload: RichTextEditorCommentUpdatePayload = {
    threadId,
    commentId: item.id,
    content,
    images: item.images,
    mentions,
    author: activeCommentUser.value ?? undefined,
    updatedAt,
  }

  emit('comment-update', payload)
  emit('comment-submit', {
    action: 'update',
    threadId,
    commentId: item.id,
    content,
    images: item.images,
    mentions,
    author: activeCommentUser.value ?? undefined,
    updatedAt,
  })
  cancelEditComment()
}

function deleteComment(threadId: string, item?: RichTextEditorCommentItem) {
  emit('comment-delete', {
    threadId,
    commentId: item?.id,
  })

  if (!item) {
    removeCommentMark(threadId)
  }
}

function resolveComment(threadId: string, resolved = true) {
  emit('comment-resolve', { threadId, resolved })
}

function openCommentImagePicker(threadId: string) {
  pendingCommentImageTarget.value = getCommentDraftKey(threadId, getReplyTargetId(threadId) ?? undefined)

  if (!commentImageInputRef.value) {
    return
  }

  commentImageInputRef.value.value = ''
  commentImageInputRef.value.click()
}

async function resolveCommentImageUpload(file: File): Promise<RichTextEditorCommentImage> {
  const hook = uploadCommentImageRef.value ?? uploadImageRef.value

  if (!hook) {
    throw new Error('Missing uploadCommentImage hook.')
  }

  const result = await hook({ file, kind: 'image' })
  return normalizeUploadResult(file, result)
}

async function handleCommentImageUploadChange(event: Event) {
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.[0]
  const draftKey = pendingCommentImageTarget.value
  pendingCommentImageTarget.value = null

  if (!file || !draftKey) {
    if (target) {
      target.value = ''
    }
    return
  }

  if (!file.type.startsWith('image/')) {
    handleUploadError({ kind: 'image', fileName: file.name, error: new Error('Please select an image file.') })
    if (target) {
      target.value = ''
    }
    return
  }

  await runEditorUploadTask(
    'image',
    file.name,
    async () => {
      const uploadedImage = await resolveCommentImageUpload(file)
      const [threadId = '', parentId] = draftKey.split(':')
      setCommentDraftImages(threadId, [...getCommentDraftImages(threadId, parentId), uploadedImage], parentId)
      return true
    },
    (error) => handleUploadError({ kind: 'image', fileName: file.name, error }),
  )

  if (target) {
    target.value = ''
  }
}

function removeCommentDraftImage(threadId: string, index: number, parentId?: string) {
  setCommentDraftImages(threadId, getCommentDraftImages(threadId, parentId).filter((_, itemIndex) => itemIndex !== index), parentId)
}

function openCommentImagePreview(image: RichTextEditorCommentImage) {
  if (!image.url) {
    return
  }

  previewCommentImage.value = image
}

function closeCommentImagePreview() {
  previewCommentImage.value = null
}

function handleCommentMarkClick(event: MouseEvent) {
  if (!isCommentFeatureEnabled.value || !props.showComments) {
    return
  }

  const target = event.target as HTMLElement | null
  const mark = target?.closest?.('[data-comment-thread-id]') as HTMLElement | null
  const threadId = mark?.dataset.commentThreadId

  if (!threadId) {
    return
  }

  const thread = commentPanelThreads.value.find((item) => item.id === threadId)

  if (thread) {
    selectCommentThread(thread, { focusEditor: false, scrollCommentCard: true })
  } else {
    selectedCommentThreadId.value = threadId
  }
}

function openLocalFilePicker() {
  localFileInputRef.value?.click()
}

function getStringAttr(attrs: Record<string, unknown>, key: string) {
  const value = attrs[key]
  return typeof value === 'string' ? value : ''
}

function getNumberAttr(attrs: Record<string, unknown>, key: string, fallback = 0) {
  const value = Number(attrs[key] ?? fallback)
  return Number.isFinite(value) ? value : fallback
}

function getImages(): RichTextEditorImagePayload[] {
  if (!editor.value) {
    return []
  }

  const images: RichTextEditorImagePayload[] = []

  editor.value.state.doc.descendants((node) => {
    if (node.type.name !== 'imageBlock') {
      return
    }

    const blockImages = Array.isArray(node.attrs.images) ? node.attrs.images : []
    blockImages.forEach((item) => {
      if (!item || typeof item !== 'object') {
        return
      }

      const attrs = item as Record<string, unknown>
      const src = getStringAttr(attrs, 'src')

      if (!src) {
        return
      }

      images.push({
        src,
        alt: getStringAttr(attrs, 'alt') || undefined,
        name: getStringAttr(attrs, 'name') || undefined,
        description: getStringAttr(attrs, 'description') || undefined,
        descriptionVisible: typeof attrs.descriptionVisible === 'boolean' ? attrs.descriptionVisible : undefined,
        link: getStringAttr(attrs, 'link') || undefined,
        linkTarget: attrs.linkTarget === '_self' ? '_self' : '_blank',
        rotation: getNumberAttr(attrs, 'rotation', 0),
      })
    })
  })

  return images
}

function getVideos(): RichTextEditorVideoPayload[] {
  if (!editor.value) {
    return []
  }

  const videos: RichTextEditorVideoPayload[] = []

  editor.value.state.doc.descendants((node) => {
    if (node.type.name !== 'videoBlock') {
      return
    }

    const attrs = node.attrs as Record<string, unknown>
    const src = getStringAttr(attrs, 'src')

    if (!src) {
      return
    }

    const align = getStringAttr(attrs, 'align')

    videos.push({
      src,
      name: getStringAttr(attrs, 'name') || undefined,
      description: getStringAttr(attrs, 'description') || undefined,
      mimeType: getStringAttr(attrs, 'mimeType') || undefined,
      align: align === 'center' || align === 'right' ? align : 'left',
      widthPercent: getNumberAttr(attrs, 'widthPercent', 100),
      height: getNumberAttr(attrs, 'height', 220),
    })
  })

  return videos
}

function getFiles(): RichTextEditorCollectedFilePayload[] {
  if (!editor.value) {
    return []
  }

  const files: RichTextEditorCollectedFilePayload[] = []

  editor.value.state.doc.descendants((node) => {
    const attrs = node.attrs as Record<string, unknown>

    if (node.type.name === 'linkBlock') {
      const url = getStringAttr(attrs, 'url')
      const name = getStringAttr(attrs, 'title')

      if (!url || !name) {
        return
      }

      const displayMode = getStringAttr(attrs, 'displayMode')
      const align = getStringAttr(attrs, 'align')

      files.push({
        kind: 'file',
        url,
        name,
        displayMode: displayMode === 'card' || displayMode === 'preview' ? displayMode : 'text',
        align: align === 'center' || align === 'right' ? align : 'left',
        widthPercent: getNumberAttr(attrs, 'widthPercent', 100),
        height: getNumberAttr(attrs, 'height', 420),
      })
      return
    }

    if (node.type.name === 'localFileBlock') {
      const url = getStringAttr(attrs, 'url')
      const name = getStringAttr(attrs, 'name')

      if (!url || !name) {
        return
      }

      files.push({
        kind: 'local-file',
        url,
        name,
        size: getNumberAttr(attrs, 'size', 0),
        mimeType: getStringAttr(attrs, 'mimeType') || undefined,
      })
    }
  })

  return files
}

function openMediaUploadPicker(kind: 'image' | 'video') {
  const range = getCurrentBlockRange()
  isInsertMenuOpen.value = false
  activeInsertSubmenu.value = null
  clearTableHover()

  pendingMediaInsertRange.value = range
  const input = kind === 'image' ? imageUploadInputRef.value : videoUploadInputRef.value

  if (!input) {
    return
  }

  input.value = ''
  input.click()
}

async function handleImageUploadChange(event: Event) {
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.[0]
  const range = pendingMediaInsertRange.value ?? getCurrentBlockRange()
  pendingMediaInsertRange.value = null

  if (!file) {
    if (target) {
      target.value = ''
    }
    return
  }

  if (!file.type.startsWith('image/')) {
    handleUploadError({ kind: 'image', fileName: file.name, error: new Error('Please select an image file.') })
    if (target) {
      target.value = ''
    }
    return
  }

  await runEditorUploadTask(
    'image',
    file.name,
    async () => {
      const uploadedImage = await resolveUploadFile(file, 'image')
      const content: JSONContent = {
        type: 'imageBlock',
        attrs: {
          images: [
			normalizeImagePayload({
				assetId: uploadedImage.assetId,
				src: uploadedImage.url,
              alt: uploadedImage.alt || uploadedImage.name,
              name: uploadedImage.name,
              description: uploadedImage.description || '',
              link: '',
              rotation: 0,
            }),
          ],
          widthPercent: 100,
        },
      }

      if (!range) {
        editor.value?.chain().focus().insertContent(content, { updateSelection: true }).run()
        return true
      }

      editor.value
        ?.chain()
        .focus()
        .insertContentAt(
          { from: range.from, to: range.to },
          content,
          { updateSelection: true },
        )
        .run()
      return true
    },
    (error) => handleUploadError({ kind: 'image', fileName: file.name, error }),
  )

  if (target) {
    target.value = ''
  }
}

async function handleVideoUploadChange(event: Event) {
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.[0]
  const range = pendingMediaInsertRange.value ?? getCurrentBlockRange()
  pendingMediaInsertRange.value = null

  if (!file) {
    if (target) {
      target.value = ''
    }
    return
  }

  if (!file.type.startsWith('video/')) {
    handleUploadError({ kind: 'video', fileName: file.name, error: new Error('Please select a video file.') })
    if (target) {
      target.value = ''
    }
    return
  }

  await runEditorUploadTask(
    'video',
    file.name,
    async () => {
      const uploadedVideo = await resolveUploadFile(file, 'video')
      const content: JSONContent = {
        type: 'videoBlock',
		attrs: {
			assetId: uploadedVideo.assetId || '',
			src: uploadedVideo.url,
          name: uploadedVideo.name,
          description: uploadedVideo.description || '',
          mimeType: uploadedVideo.mimeType || 'video/mp4',
          align: 'left',
          widthPercent: 100,
          height: 220,
        },
      }

      if (!range) {
        editor.value?.chain().focus().insertContent(content, { updateSelection: true }).run()
        return true
      }

      editor.value
        ?.chain()
        .focus()
        .insertContentAt(
          { from: range.from, to: range.to },
          content,
          { updateSelection: true },
        )
        .run()
      return true
    },
    (error) => handleUploadError({ kind: 'video', fileName: file.name, error }),
  )

  if (target) {
    target.value = ''
  }
}

async function handleLocalFileChange(event: Event) {
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.[0]

  if (!file) {
    if (target) {
      target.value = ''
    }
    return
  }

  await runEditorUploadTask(
    'file',
    file.name,
    async () => {
      const uploadedFile = await resolveUploadFile(file, 'file')
		const payload: RichTextEditorLocalFilePayload = {
			assetId: uploadedFile.assetId,
			url: uploadedFile.url,
        name: uploadedFile.name,
        size: uploadedFile.size,
        mimeType: uploadedFile.mimeType,
      }

      const inserted = insertExternalLocalFile(payload)

      if (inserted) {
        emit('local-file-upload', payload)
      }
      return payload
    },
    (error) => handleUploadError({ kind: 'file', fileName: file.name, error }),
  )

  if (target) {
    target.value = ''
  }
}

function handleInsertAction(action: string) {
  if (!editor.value) {
    return
  }

  if (action === 'table') {
    setActiveInsertSubmenu('table')
    return
  }

  if (action === 'emoji') {
    setActiveInsertSubmenu('emoji')
    return
  }

  if (action === 'columns') {
    setActiveInsertSubmenu('columns')
    return
  }

  if (action === 'countdown') {
    insertCountdownBlock()
    return
  }

  if (action === 'formula') {
    formulaDraft.value = ''
    isFormulaDialogOpen.value = true
    isInsertMenuOpen.value = false
    activeInsertSubmenu.value = null
    clearTableHover()
    return
  }

  if (action === 'markdown-import') {
    isInsertMenuOpen.value = false
    activeInsertSubmenu.value = null
    clearTableHover()
    openMarkdownImportPicker()
    return
  }

  if (action === 'local-file') {
    isInsertMenuOpen.value = false
    activeInsertSubmenu.value = null
    clearTableHover()
    openLocalFilePicker()
    return
  }

  if (action === 'image') {
    openMediaUploadPicker('image')
    return
  }

  if (action === 'video') {
    openMediaUploadPicker('video')
    return
  }

  if (action === 'link') {
    const range = getCurrentBlockRange()
    if (!range) {
      isInsertMenuOpen.value = false
      return
    }

    editor.value
      .chain()
      .focus()
      .insertContentAt(
        { from: range.from, to: range.to },
        {
          type: 'linkBlock',
          attrs: {
            title: '',
            url: '',
            displayMode: 'preview',
            align: 'left',
            widthPercent: 100,
            height: 420,
          },
        },
        { updateSelection: true },
      )
      .run()

    isInsertMenuOpen.value = false
    activeInsertSubmenu.value = null
    clearTableHover()
    return
  }

  const content = buildInsertContent(action)
  if (!content) {
    isInsertMenuOpen.value = false
    activeInsertSubmenu.value = null
    clearTableHover()
    return
  }

  const range = getCurrentBlockRange()
  if (!range) {
    isInsertMenuOpen.value = false
    activeInsertSubmenu.value = null
    clearTableHover()
    return
  }

  editor.value
    .chain()
    .focus()
    .insertContentAt({ from: range.from, to: range.to }, content, { updateSelection: true })
    .run()

  isInsertMenuOpen.value = false
  activeInsertSubmenu.value = null
  clearTableHover()
}

function setParagraph() {
  getActiveSelectionChain()?.setParagraph().run()
}

function setHeading(level: 1 | 2 | 3 | 4 | 5 | 6) {
  getActiveSelectionChain()?.toggleHeading({ level }).run()
}

function toggleHeadingMenu() {
  if (!canOpenHeadingMenu.value) {
    return
  }

  isHeadingMenuOpen.value = !isHeadingMenuOpen.value
  isFontFamilyMenuOpen.value = false
  isScriptMenuOpen.value = false
  isFontSizeMenuOpen.value = false
  isColorMenuOpen.value = false
  isHighlightMenuOpen.value = false
  isQuoteMenuOpen.value = false
}

function applyHeading(level?: 1 | 2 | 3 | 4 | 5 | 6) {
  if (level) {
    setHeading(level)
  } else {
    setParagraph()
  }

  isHeadingMenuOpen.value = false
}

function increaseIndent() {
  getActiveSelectionChain()?.increaseIndent().run()
}

function decreaseIndent() {
  getActiveSelectionChain()?.decreaseIndent().run()
}

function toggleFontFamilyMenu() {
  if (!canOpenFontFamilyMenu.value) {
    return
  }

  isFontFamilyMenuOpen.value = !isFontFamilyMenuOpen.value
  isHeadingMenuOpen.value = false
  isScriptMenuOpen.value = false
  isFontSizeMenuOpen.value = false
  isColorMenuOpen.value = false
  isHighlightMenuOpen.value = false
  isQuoteMenuOpen.value = false
}

function applyFontFamily(fontFamily: string) {
  const chain = getActiveSelectionChain()
  if (!chain) {
    return
  }

  if (fontFamily) {
    chain.setFontFamily(fontFamily).run()
  } else {
    chain.unsetFontFamily().run()
  }

  isFontFamilyMenuOpen.value = false
}

function toggleScriptMenu() {
  if (!canOpenScriptMenu.value) {
    return
  }

  isScriptMenuOpen.value = !isScriptMenuOpen.value
  isHeadingMenuOpen.value = false
  isFontFamilyMenuOpen.value = false
  isFontSizeMenuOpen.value = false
  isColorMenuOpen.value = false
  isHighlightMenuOpen.value = false
  isQuoteMenuOpen.value = false
}

function toggleFontSizeMenu() {
  if (!canOpenFontSizeMenu.value) {
    return
  }

  isFontSizeMenuOpen.value = !isFontSizeMenuOpen.value
  isHeadingMenuOpen.value = false
  isFontFamilyMenuOpen.value = false
  isScriptMenuOpen.value = false
  isColorMenuOpen.value = false
  isHighlightMenuOpen.value = false
  isQuoteMenuOpen.value = false
}

function applyFontSize(fontSize: string) {
  getActiveSelectionChain()?.setFontSize(fontSize).run()
  isFontSizeMenuOpen.value = false
}

function toggleColorMenu() {
  if (!canOpenTextColorMenu.value) {
    return
  }

  isColorMenuOpen.value = !isColorMenuOpen.value
  isHeadingMenuOpen.value = false
  isFontFamilyMenuOpen.value = false
  isScriptMenuOpen.value = false
  isFontSizeMenuOpen.value = false
  isHighlightMenuOpen.value = false
  isQuoteMenuOpen.value = false
}

function applyTextColor(color: string) {
  getActiveSelectionChain()?.setColor(color).run()
  recentColors.value = [color, ...recentColors.value.filter((item) => item !== color)].slice(0, 10)
}

function toggleHighlightMenu() {
  if (!canOpenHighlightMenu.value) {
    return
  }

  isHighlightMenuOpen.value = !isHighlightMenuOpen.value
  isHeadingMenuOpen.value = false
  isFontFamilyMenuOpen.value = false
  isScriptMenuOpen.value = false
  isFontSizeMenuOpen.value = false
  isColorMenuOpen.value = false
  isQuoteMenuOpen.value = false
}

function applyHighlightColor(color: string) {
  getActiveSelectionChain()?.setBackgroundColor(color).run()
  rememberHighlightColor(color)
}

function rememberHighlightColor(color: string) {
  recentHighlightColors.value = [color, ...recentHighlightColors.value.filter((item) => item.toLowerCase() !== color.toLowerCase())].slice(0, 10)
}

function toggleQuoteMenu() {
  if (!isBlockquoteToolbarEnabled.value || !canOpenQuoteMenu.value) {
    return
  }

  isQuoteMenuOpen.value = !isQuoteMenuOpen.value
  isHeadingMenuOpen.value = false
  isFontFamilyMenuOpen.value = false
  isScriptMenuOpen.value = false
  isFontSizeMenuOpen.value = false
  isColorMenuOpen.value = false
  isHighlightMenuOpen.value = false
  isExportMenuOpen.value = false
  isEmojiToolbarMenuOpen.value = false
}

function toggleEmojiToolbarMenu() {
  if (!editorEditable.value) {
    return
  }

  isEmojiToolbarMenuOpen.value = !isEmojiToolbarMenuOpen.value
  isInsertMenuOpen.value = false
  activeInsertSubmenu.value = null
  isHeadingMenuOpen.value = false
  isFontFamilyMenuOpen.value = false
  isScriptMenuOpen.value = false
  isFontSizeMenuOpen.value = false
  isColorMenuOpen.value = false
  isHighlightMenuOpen.value = false
  isQuoteMenuOpen.value = false
  isExportMenuOpen.value = false
}

function toggleBold() {
  getActiveSelectionChain()?.toggleBold().run()
}

function toggleItalic() {
  getActiveSelectionChain()?.toggleItalic().run()
}

function toggleUnderline() {
  getActiveSelectionChain()?.toggleUnderline().run()
}

function toggleStrike() {
  getActiveSelectionChain()?.toggleStrike().run()
}

function toggleInlineCode() {
  getActiveSelectionChain()?.toggleCode().run()
}

function toggleBulletList() {
  getActiveSelectionChain()?.toggleBulletList().run()
}

function toggleOrderedList() {
  getActiveSelectionChain()?.toggleOrderedList().run()
}

function toggleTaskList() {
  getActiveSelectionChain()?.toggleTaskList().run()
}

function toggleBlockquote() {
  getActiveSelectionChain()?.toggleBlockquote().run()
}

function applyQuoteBorderColor(color: string) {
  if (!editor.value?.isActive('blockquote')) {
    return
  }

  editor.value
    ?.chain()
    .focus()
    .setQuoteStyle({
      quoteBorderColor: color,
      quoteBackgroundColor: currentQuoteBackgroundColor.value,
    })
    .run()
}

function applyQuoteBackgroundColor(color: string) {
  if (!editor.value?.isActive('blockquote')) {
    return
  }

  editor.value
    ?.chain()
    .focus()
    .setQuoteStyle({
      quoteBorderColor: currentQuoteBorderColor.value,
      quoteBackgroundColor: color,
    })
    .run()
}

function applySuperscript() {
  getActiveSelectionChain()?.unsetSubscript().toggleSuperscript().run()
  isScriptMenuOpen.value = false
}

function applySubscript() {
  getActiveSelectionChain()?.unsetSuperscript().toggleSubscript().run()
  isScriptMenuOpen.value = false
}

function clearFormatting() {
  getActiveSelectionChain()?.unsetAllMarks().clearNodes().run()
}

function canApplyHeading(level?: 1 | 2 | 3 | 4 | 5 | 6) {
  if (level) {
    return canRunEditorCommand((instance) => instance.can().chain().focus().toggleHeading({ level }).run())
  }

  return canRunEditorCommand((instance) => instance.can().chain().focus().setParagraph().run())
}

function canApplyFontFamily(optionValue: string) {
  if (optionValue) {
    return canRunEditorCommand((instance) => instance.can().chain().focus().setFontFamily(optionValue).run())
  }

  return canRunEditorCommand((instance) => instance.can().chain().focus().unsetFontFamily().run())
}

function canApplyFontSize(optionValue: string) {
  return canRunEditorCommand((instance) => instance.can().chain().focus().setFontSize(optionValue).run())
}

function canApplyTextAlign(alignment: 'left' | 'center' | 'right') {
  return canRunEditorCommand((instance) => instance.can().chain().focus().setTextAlign(alignment).run())
}

function canApplySuperscript() {
  return canRunEditorCommand((instance) => instance.can().chain().focus().toggleSuperscript().run())
}

function canApplySubscript() {
  return canRunEditorCommand((instance) => instance.can().chain().focus().toggleSubscript().run())
}

function handleDocumentPointerDown(event: MouseEvent) {
  const target = event.target as Node | null
  const targetElement = target instanceof Element ? target : null

  if (isSlashPopupOpen.value && !slashMenuRef.value?.contains(target)) {
    closeSlashMenu(true)
    isSlashEmojiPickerOpen.value = false
  }

  if (
    hasMarqueeSelection.value
    && !pageRef.value?.contains(target)
    && !isMarqueeSelectionPreservingTarget(target)
  ) {
    clearMarqueeSelection()
  }

  if (!target || !insertMenuRef.value?.contains(target)) {
    isInsertMenuOpen.value = false
    activeInsertSubmenu.value = null
    clearTableHover()
  }

  if (!targetElement?.closest('.norio-office-rich-block-side-control, .norio-office-rich-block-side-menu, .norio-office-rich-block-side-submenu, .norio-office-rich-block-side-table-theme')) {
    closeBlockSideMenu()
  }

  if (!target || !statusbarExportMenuRef.value?.contains(target)) {
    isExportMenuOpen.value = false
  }

  if (
    isCountdownDeadlinePickerOpen.value &&
    target &&
    !countdownDateTriggerRef.value?.contains(target) &&
    !countdownPickerRef.value?.contains(target) &&
    !(isCountdownBlockEditOpen.value && !!countdownBubbleMenuRef.value?.contains(target)) &&
    !(activeInsertSubmenu.value === 'countdown' && !!insertMenuRef.value?.contains(target))
  ) {
    isCountdownDeadlinePickerOpen.value = false
  }

  if (
    isCountdownBlockEditOpen.value &&
    target &&
    !countdownBubbleEditButtonRef.value?.contains(target) &&
    !countdownBubbleMenuRef.value?.contains(target)
  ) {
    isCountdownBlockEditOpen.value = false
  }

  if (!target || !alignMenuRef.value?.contains(target)) {
    isAlignMenuOpen.value = false
  }

  if (!target || !scriptMenuRef.value?.contains(target)) {
    isScriptMenuOpen.value = false
  }

  if (!target || !headingMenuRef.value?.contains(target)) {
    isHeadingMenuOpen.value = false
  }

  if (!target || !fontFamilyMenuRef.value?.contains(target)) {
    isFontFamilyMenuOpen.value = false
  }

  if (!target || !fontSizeMenuRef.value?.contains(target)) {
    isFontSizeMenuOpen.value = false
  }

  if (!target || !colorMenuRef.value?.contains(target)) {
    isColorMenuOpen.value = false
  }

  if (!target || !highlightMenuRef.value?.contains(target)) {
    isHighlightMenuOpen.value = false
  }

  if (!target || !quoteMenuRef.value?.contains(target)) {
    isQuoteMenuOpen.value = false
  }

  if (!target || !emojiToolbarMenuRef.value?.contains(target)) {
    isEmojiToolbarMenuOpen.value = false
  }

  if (
    isMentionPanelOpen.value
    && target
    && !mentionPanelRef.value?.contains(target)
    && !pageRef.value?.contains(target)
  ) {
    closeMentionPanel()
  }

  if (
    isCommentMentionPanelOpen.value
    && target
    && !commentMentionPanelRef.value?.contains(target)
    && !targetElement?.closest?.('.norio-office-rich-comment-composer')
  ) {
    closeCommentMentionPanel()
  }

  if (!target || !tableActionColorMenuRef.value?.contains(target)) {
    isTableActionColorMenuOpen.value = false
  }

  if (!target || !tableThemeMenuRef.value?.contains(target)) {
    isTableThemeMenuOpen.value = false
  }

  if (activeTableWrapperElement.value && targetElement && activeTableWrapperElement.value.contains(targetElement)) {
    startTableOverlayDragSync()
  }

  window.setTimeout(() => {
    queueTableStateSync()
  }, 0)
}

function handleDocumentMouseMove(event: MouseEvent) {
  if (isPresentationMode.value) {
    presentationPointerX.value = event.clientX
    presentationPointerY.value = event.clientY
  }

  if (marqueeGestureStart.value) {
    marqueeGestureCurrent.value = { x: event.clientX, y: event.clientY }

    const deltaX = event.clientX - marqueeGestureStart.value.x
    const deltaY = event.clientY - marqueeGestureStart.value.y
    if (!isMarqueeSelecting.value && Math.abs(deltaX) >= 12 && Math.abs(deltaY) >= 12) {
      isMarqueeSelecting.value = true
      window.getSelection()?.removeAllRanges()
    }

    if (isMarqueeSelecting.value) {
      event.preventDefault()
      syncMarqueeSelection()
    }
  }

  if (!event.buttons) {
    return
  }

  const target = event.target as Node | null
  const targetElement = target instanceof Element ? target : null
  if (activeTableWrapperElement.value && targetElement && activeTableWrapperElement.value.contains(targetElement)) {
    startTableOverlayDragSync()
  }
}

function handleDocumentKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isPresentationMode.value) {
    event.preventDefault()
    void exitPresentationMode()
    return
  }
  if (event.key === 'Escape' && isExportMenuOpen.value) {
    isExportMenuOpen.value = false
    statusbarExportMenuRef.value?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
    return
  }
  if (event.key === 'Escape' && blockSideCustomColorKind.value) {
    blockSideCustomColorKind.value = null
    return
  }
  if (event.key === 'Escape' && ['properties', 'color', 'divider-style', 'divider-color', 'highlight-settings', ...blockSideSurfaceColorModes].includes(blockSideSubmenuMode.value ?? '')) {
    closeBlockSideMenu()
    return
  }
  if (event.key === 'Escape' && blockSideSubmenuMode.value === 'table-theme') {
    closeBlockSideTableTheme()
    return
  }
  if (event.key === 'Escape' && isTableThemeMenuOpen.value) {
    isTableThemeMenuOpen.value = false
    return
  }
  if (event.key === 'Escape' && previewCommentImage.value) {
    closeCommentImagePreview()
    return
  }

  if (isMentionPanelOpen.value && handleMentionKeyDown(event)) {
    event.preventDefault()
    return
  }

  if (isCommentMentionPanelOpen.value && handleCommentMentionKeyDown(event)) {
    event.preventDefault()
    return
  }

  if (event.key === 'Escape' && hasMarqueeSelection.value) {
    clearMarqueeSelection()
    clearMarqueeGesture()
    return
  }

  if ((event.ctrlKey || event.metaKey) && hasMarqueeSelection.value && isEditorClipboardTarget(event.target)) {
    const key = event.key.toLowerCase()
    if (key === 'c' || key === 'x') {
      event.preventDefault()
      document.execCommand(key === 'c' ? 'copy' : 'cut')
      return
    }
  }

  if ((event.key === 'Delete' || event.key === 'Backspace') && hasMarqueeSelection.value && editorEditable.value) {
    event.preventDefault()
    deleteMarqueeSelection()
  }
}

function isEditorClipboardTarget(target: EventTarget | null) {
  if (!editor.value || !(target instanceof Node)) return false
  const element = target instanceof Element ? target : target.parentElement
  if (element?.closest('input, textarea, select')) return false
  if (element?.closest('[contenteditable]')?.getAttribute('contenteditable') === 'false') return false
  return editor.value.view.dom.contains(target)
    || (hasMarqueeSelection.value && (rootRef.value?.contains(target) || target === document.body))
}

function handleDocumentCopy(event: ClipboardEvent) {
  if (pendingBlockCopy) {
    pendingBlockCopy.written = writeClipboardData(event, pendingBlockCopy.payload)
    return
  }
  if (!isEditorClipboardTarget(event.target)) return
  if (hasMarqueeSelection.value) {
    const payload = buildMarqueeClipboardPayload()
    if (payload) writeClipboardData(event, payload)
  } else if (editor.value && !editor.value.state.selection.empty) {
    // Let ProseMirror own text/inline selections, while sharing the menu fallback cache.
    blockClipboardPayload.value = serializeClipboardSlice(editor.value.state.selection.content())
  }
}

function handleDocumentCut(event: ClipboardEvent) {
  if (!isEditorClipboardTarget(event.target) || !editorEditable.value) return
  if (hasMarqueeSelection.value) {
    const payload = buildMarqueeClipboardPayload()
    if (payload && writeClipboardData(event, payload)) deleteMarqueeSelection()
  } else if (editor.value && !editor.value.state.selection.empty) {
    blockClipboardPayload.value = serializeClipboardSlice(editor.value.state.selection.content())
  }
}

function parseClipboardBlocks(raw: string): JSONContent[] | undefined {
  if (!raw || !editor.value) return undefined
  try {
    const content = JSON.parse(raw) as JSONContent[]
    if (!Array.isArray(content) || !content.length) return undefined
    for (const value of content) {
      const node = editor.value.state.schema.nodeFromJSON(value)
      if (!node.isBlock) return undefined
      node.check()
    }
    return content
  } catch {
    return undefined
  }
}

function handleDocumentPaste(event: ClipboardEvent) {
  if (!editorEditable.value || !event.clipboardData || !isEditorClipboardTarget(event.target)) return
  const html = event.clipboardData.getData('text/html')
  const text = event.clipboardData.getData('text/plain')
  const content = parseClipboardBlocks(event.clipboardData.getData(blockClipboardMime))
  if (html || text || content) blockClipboardPayload.value = { html, text, json: content }
  // Native paste uses ProseMirror's HTML slice parser (including code/plain-text paste).
  // Only marquee replacement and legacy JSON-only clipboard data need block insertion.
  if (content && (hasMarqueeSelection.value || (!html && !text && !editor.value?.state.selection.$from.parent.type.spec.code))) {
    event.preventDefault()
    event.stopPropagation()
    insertMarqueeBlocks(content)
  }
}

watch(
  () => enabledCollaboration.value?.user,
  (user) => {
    if (!editor.value || !user || !enabledCollaboration.value?.provider) {
      return
    }

    editor.value.commands.updateUser(user)
  },
  {
    deep: true,
  },
)

let detachTableEditorListeners: (() => void) | null = null
let detachTableWrapperListeners: (() => void) | null = null
let tableOverlayDragRaf: number | null = null
let stopTableOverlayDragSync: (() => void) | null = null

function startTableOverlayDragSync() {
  stopTableOverlayDragSync?.()

  const tick = () => {
    syncActiveTableState()
    tableOverlayDragRaf = window.requestAnimationFrame(tick)
  }

  const handleMouseUp = () => {
    stopTableOverlayDragSync?.()
    syncActiveTableState()
  }

  tableOverlayDragRaf = window.requestAnimationFrame(tick)
  document.addEventListener('mouseup', handleMouseUp, { once: true })

  stopTableOverlayDragSync = () => {
    if (tableOverlayDragRaf !== null) {
      window.cancelAnimationFrame(tableOverlayDragRaf)
      tableOverlayDragRaf = null
    }

    document.removeEventListener('mouseup', handleMouseUp)
    stopTableOverlayDragSync = null
  }
}

function bindTableEditorListeners() {
  detachTableEditorListeners?.()
  detachTableEditorListeners = null

  if (!editor.value) {
    return
  }

  const handleSelectionChange = ({ transaction }: { transaction?: Transaction } = {}) => {
    if (transaction?.getMeta('textSelectionBubbleMenu') === 'updatePosition' || transaction?.getMeta('tableBubbleMenu') === 'updatePosition') return
    selectionStateVersion.value += 1
    if (!editor.value?.isActive('table')) isTableThemeMenuOpen.value = false
    queueTableStateSync()
    syncOutlineState()
    syncMentionState()
    syncSlashMenu()
  }

  const handleBlockSideThemeTransaction = ({ transaction }: { transaction: Transaction }) => {
    const targetPos = blockSideTargetPos.value
    if (targetPos !== null && transaction.docChanged) {
      const targetType = activeBlockSideControl.value?.node.type.name
      const mapped = transaction.mapping.mapResult(targetPos + 1, -1)
      const pos = mapped.pos - 1
      const node = pos >= 0 ? transaction.doc.nodeAt(pos) : null
      if (mapped.deletedAcross || !node || node.type.name !== targetType) {
        closeBlockSideMenu()
      } else {
        blockSideTargetPos.value = pos
        if (activeBlockSideControl.value) {
          keepBlockSideControl({ ...activeBlockSideControl.value, pos, from: pos, to: pos + node.nodeSize, node })
        }
        void nextTick(() => {
          if (blockSideTargetPos.value !== pos) return
          const block = getTopLevelSelectableBlocks().find(block => block.pos === pos)
          if (block) keepBlockSideControl(toBlockSideControl(block))
        })
      }
    }
    // An atom has no content boundary to track safely after a remote document edit.
    if (transaction.docChanged && activeBlockSideControl.value?.node.type.name === 'horizontalRule' && transaction.getMeta('officeBlockSideAttrs') !== activeBlockSideControl.value.pos) {
      closeBlockSideMenu()
    }
    const pos = blockSideTableThemePos.value
    if (blockSideSubmenuMode.value !== 'table-theme' || pos === null || !transaction.docChanged) return
    // The content boundary survives attribute changes, unlike the table's replaced opening token.
    const mapped = transaction.mapping.mapResult(pos + 1, -1)
    if (mapped.deletedAcross || mapped.pos < 1 || transaction.doc.nodeAt(mapped.pos - 1)?.type.name !== 'table') {
      closeBlockSideMenu()
    } else {
      blockSideTableThemePos.value = mapped.pos - 1
      void nextTick(() => {
        if (blockSideSubmenuMode.value !== 'table-theme') return
        const block = getTopLevelSelectableBlocks().find(block => block.from === blockSideTableThemePos.value)
        if (block) keepBlockSideControl(toBlockSideControl(block))
      })
    }
  }

  editor.value.on('transaction', handleBlockSideThemeTransaction)
  editor.value.on('selectionUpdate', handleSelectionChange)
  editor.value.on('transaction', handleSelectionChange)
  editor.value.on('focus', handleSelectionChange)
  editor.value.on('blur', handleSelectionChange)

  detachTableEditorListeners = () => {
    editor.value?.off('transaction', handleBlockSideThemeTransaction)
    editor.value?.off('selectionUpdate', handleSelectionChange)
    editor.value?.off('transaction', handleSelectionChange)
    editor.value?.off('focus', handleSelectionChange)
    editor.value?.off('blur', handleSelectionChange)
  }

  queueTableStateSync()
  syncOutlineState()
}

onMounted(() => {
  syncViewportWidth()
  document.addEventListener('selectionchange', syncNativeEditorSelection)
  document.addEventListener('fullscreenchange', syncFullscreenState)
  document.addEventListener('mousedown', handleDocumentPointerDown)
  document.addEventListener('mousemove', handleDocumentMouseMove)
  document.addEventListener('mouseup', handleDocumentMouseUp)
  document.addEventListener('keydown', handleDocumentKeyDown)
  document.addEventListener('copy', handleDocumentCopy, true)
  document.addEventListener('cut', handleDocumentCut, true)
  document.addEventListener('paste', handleDocumentPaste, true)
  window.addEventListener('resize', queueTableStateSync)
  window.addEventListener('resize', syncCountdownPickerPlacement)
  window.addEventListener('resize', syncMentionPanelPosition)
  window.addEventListener('resize', syncCommentMentionPanelPosition)
  window.addEventListener('resize', syncViewportWidth)
  window.addEventListener('resize', syncSlashMenuPosition)
  window.addEventListener('scroll', syncMentionPanelPosition, true)
  window.addEventListener('scroll', syncCommentMentionPanelPosition, true)
  window.addEventListener('scroll', syncTableThemeMenuPosition, true)
  window.addEventListener('scroll', syncSlashMenuPosition, true)
  bindTableEditorListeners()
  void nextTick(syncLocalizedUiLabels)
})

onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', syncNativeEditorSelection)
  if (editorTypingTimer !== null) clearTimeout(editorTypingTimer)
  blockSideMenuResizeObserver?.disconnect()
  document.removeEventListener('fullscreenchange', syncFullscreenState)
  document.removeEventListener('mousedown', handleDocumentPointerDown)
  document.removeEventListener('mousemove', handleDocumentMouseMove)
  document.removeEventListener('mouseup', handleDocumentMouseUp)
  document.removeEventListener('keydown', handleDocumentKeyDown)
  document.removeEventListener('copy', handleDocumentCopy, true)
  document.removeEventListener('cut', handleDocumentCut, true)
  document.removeEventListener('paste', handleDocumentPaste, true)
  window.removeEventListener('resize', queueTableStateSync)
  window.removeEventListener('resize', syncCountdownPickerPlacement)
  window.removeEventListener('resize', syncMentionPanelPosition)
  window.removeEventListener('resize', syncCommentMentionPanelPosition)
  window.removeEventListener('resize', syncViewportWidth)
  window.removeEventListener('resize', syncSlashMenuPosition)
  window.removeEventListener('scroll', syncMentionPanelPosition, true)
  window.removeEventListener('scroll', syncCommentMentionPanelPosition, true)
  window.removeEventListener('scroll', syncTableThemeMenuPosition, true)
  window.removeEventListener('scroll', syncSlashMenuPosition, true)
  stopTableOverlayDragSync?.()
  detachTableEditorListeners?.()
  clearActiveTableState()
})

watch(
  editorEditable,
  (editable) => {
    editor.value?.setEditable(editable, false)
    if (!editable) {
      closeSlashMenu()
      isSlashEmojiPickerOpen.value = false
      closeBlockSideMenu()
      hoveredBlockSideControl.value = null
      clearMarqueeGesture()
      clearMarqueeSelection()
      closeMentionPanel()
      isTableActionColorMenuOpen.value = false
      isTableThemeMenuOpen.value = false
    }
  },
  { flush: 'sync' },
)

watch(isToolbarVisible, (visible) => {
  if (visible) return
  isInsertMenuOpen.value = false
  activeInsertSubmenu.value = null
  isAlignMenuOpen.value = false
  isHeadingMenuOpen.value = false
  isFontFamilyMenuOpen.value = false
  isScriptMenuOpen.value = false
  isFontSizeMenuOpen.value = false
  isColorMenuOpen.value = false
  isHighlightMenuOpen.value = false
  isQuoteMenuOpen.value = false
  isEmojiToolbarMenuOpen.value = false
  isCountdownDeadlinePickerOpen.value = false
})

watch(isMentionEnabled, (enabled) => {
  if (!enabled) {
    closeMentionPanel()
  }
})

watch(isCommentMentionEnabled, (enabled) => {
  if (!enabled) {
    closeCommentMentionPanel()
  }
})

watch(commentPanelThreads, (threads) => {
  if (!threads.length) {
    selectedCommentThreadId.value = null
    return
  }

  if (!selectedCommentThreadId.value || !threads.some((thread) => thread.id === selectedCommentThreadId.value)) {
    selectedCommentThreadId.value = threads[0]?.id ?? null
  }
})

watch(
  () => props.modelValue,
  (value) => {
    if (!editor.value || !value || enabledCollaboration.value) {
      return
    }

    const current = editor.value.getJSON()
    if (JSON.stringify(current) === JSON.stringify(value)) {
      return
    }

    editor.value.commands.setContent(value, { emitUpdate: false })
    syncOutlineState()
  },
)

watch(countdownInsertMode, (mode) => {
  if (mode !== 'deadline') {
    isCountdownDeadlinePickerOpen.value = false
  }
})

watch(isCountdownDeadlinePickerOpen, (open) => {
  if (open) {
    void nextTick(syncCountdownPickerPlacement)
  }
})

watch(countdownTimeInput, (value) => {
  if (!isCountdownDeadlinePickerOpen.value || countdownInsertMode.value !== 'deadline') {
    return
  }

  if (!/^\d{2}:\d{2}$/.test(value)) {
    return
  }

  applyCountdownTimeOption(value)
})

watch(editor, () => {
  bindTableEditorListeners()
  syncOutlineState()
  void nextTick(syncLocalizedUiLabels)
})

watch(zoomScale, () => {
  queueTableStateSync()
})

watch(
  [
    messages,
    filteredInsertGeneralItems,
    filteredInsertAppItems,
    filteredInsertExternalItems,
    isInsertMenuOpen,
    isToolbarVisible,
    isExportMenuOpen,
    isPresentationMode,
    isFullscreen,
    exportingType,
    characterCount,
    lineCount,
  ],
  () => {
    void nextTick(syncLocalizedUiLabels)
  },
)

defineExpose<RichTextEditorInstance>({
  exportPdf: createPdfBlob,
  exportImage: createImageBlob,
  exportHtml: createHtmlExportContent,
  insertImage: insertExternalImage,
  insertVideo: insertExternalVideo,
  insertFile: insertExternalFile,
  insertLocalFile: insertExternalLocalFile,
  insertMention: insertExternalMention,
  openLocalFilePicker,
  focus: () => {
    editor.value?.commands.focus()
  },
  getJSON: () => editor.value?.getJSON() ?? null,
  getText: () => editor.value?.getText() ?? '',
  getImages,
  getVideos,
  getFiles,
  getOutlineItems: () => getOutlineState().items,
  getActiveOutlinePos: () => activeOutlinePos.value,
  focusOutlineItem,
  onOutlineChange: (handler) => {
    outlineChangeListeners.add(handler)
    handler(getOutlineState())

    return () => {
      outlineChangeListeners.delete(handler)
    }
  },
  focusCommentThread,
})
</script>

<template>
  <div
    ref="rootRef"
    class="norio-office-rich-editor"
    :data-editable="editorEditable"
    :data-mode="isPreviewMode ? 'preview' : 'edit'"
    :data-fullscreen="isFullscreen"
    :data-presentation="isPresentationMode"
    :data-outline-open="isOutlineFeatureEnabled && isOutlineOpen"
    :data-outline-placement="resolvedOutlinePlacement"
    :data-comments-enabled="isCommentFeatureEnabled"
    :data-comments-open="shouldShowCommentsPanel"
    :data-drag-insert-active="!!dragInsertIndicator"
    @click.capture="handleCommentMarkClick"
    @norio-office-rich-upload-request="handleInternalUploadRequest"
  >
    <header v-if="isToolbarVisible" class="norio-office-rich-editor__toolbar">
      <div class="norio-office-rich-editor__toolbar-shell">
        <div class="norio-office-rich-editor__toolbar-scroll">
          <div class="norio-office-rich-editor__toolbar-track">
            <div v-if="hasExportMenuItems || isPrintEnabled" class="norio-office-rich-toolbar__group">
              <button
                type="button"
                class="norio-office-rich-toolbar__button"
                :disabled="!canUndo"
                @click="editor?.chain().focus().undo().run()"
              >
                <OfficeIcon name="back" :size="16" color="#4b5563" background-color="transparent" />
              </button>

              <button
                type="button"
                class="norio-office-rich-toolbar__button"
                :disabled="!canRedo"
                @click="editor?.chain().focus().redo().run()"
              >
                <OfficeIcon name="redo" :size="16" color="#4b5563" background-color="transparent" />
              </button>

              <button
                type="button"
                class="norio-office-rich-toolbar__button"
                :disabled="!canClearFormatting"
                @click="clearFormatting"
              >
                <OfficeIcon name="rubber" :size="16" color="#4b5563" background-color="transparent" />
              </button>
            </div>

            <div v-if="isCommentFeatureEnabled && props.showComments" class="norio-office-rich-toolbar__group">
              <button
                type="button"
                class="norio-office-rich-toolbar__button"
                :class="{ 'norio-office-rich-toolbar__button--active': !!selectedCommentThread }"
                :disabled="!canCreateComment"
                title="添加评论"
                @click="createCommentFromSelection"
              >
                <OfficeIcon name="comment" :size="16" color="#4b5563" background-color="transparent" />
              </button>
            </div>

            <div v-if="hasInsertMenuItems" class="norio-office-rich-toolbar__group norio-office-rich-toolbar__group--insert">
              <div ref="insertMenuRef" class="norio-office-rich-toolbar__dropdown">
                <button
                  type="button"
                  class="norio-office-rich-toolbar__button norio-office-rich-toolbar__button--select"
                  :class="{ 'norio-office-rich-toolbar__button--active': isInsertMenuOpen }"
                  @click="toggleInsertMenu"
                >
                  <OfficeIcon name="add-circle" :size="16" color="#4b5563" background-color="transparent" />
                  <span class="norio-office-rich-toolbar__label">插入</span>
                  <OfficeIcon name="xiangxiajiantou" :size="12" color="#9ca3af" background-color="transparent" />
                </button>

                <div v-if="isInsertMenuOpen" class="norio-office-rich-toolbar__menu norio-office-rich-toolbar__menu--insert">
                  <div ref="insertMenuPanelRef" class="norio-office-rich-insert-menu">
                    <ScrollArea
                      class-name="norio-office-rich-insert-menu__scroll"
                      max-height="calc(100vh - 100px)"
                      @scroll="syncInsertMenuScrollState"
                    >
                      <div class="norio-office-rich-insert-menu__main">
                        <div class="norio-office-rich-insert-menu__quick-grid">
                          <button
                            v-for="item in insertQuickItems"
                            :key="item.key"
                            type="button"
                            class="norio-office-rich-insert-menu__quick-item"
                            @mouseenter="setActiveInsertSubmenu(null)"
                            @click="handleInsertAction(item.action)"
                          >
                            <span v-if="item.type === 'text'" class="norio-office-rich-insert-menu__quick-text">{{ item.label }}</span>
                            <OfficeIcon
                              v-else
                              :name="item.iconName!"
                              :size="16"
                              color="#4b5563"
                              background-color="transparent"
                            />
                          </button>
                        </div>

                        <div v-if="filteredInsertGeneralItems.length" class="norio-office-rich-insert-menu__section">
                    <div class="norio-office-rich-insert-menu__title">通用</div>
                    <button
                      v-for="item in filteredInsertGeneralItems"
                      :key="item.key"
                      type="button"
                      class="norio-office-rich-insert-menu__item"
                      :ref="item.key === 'columns' ? setColumnsMenuItemRef : undefined"
                      :class="{ 'norio-office-rich-insert-menu__item--active': activeInsertSubmenu === item.key }"
                      @mouseenter="setActiveInsertSubmenu(item.key === 'table' || item.key === 'emoji' || item.key === 'columns' ? item.key : null)"
                      @focus="setActiveInsertSubmenu(item.key === 'table' || item.key === 'emoji' || item.key === 'columns' ? item.key : null)"
                      @click="handleInsertAction(item.action)"
                    >
                      <span class="norio-office-rich-insert-menu__icon">
                        <OfficeColorIcon
                          v-if="item.colorIconName"
                          :name="item.colorIconName"
                          :size="18"
                          background-color="transparent"
                        />
                        <OfficeIcon
                          v-else-if="item.key === 'emoji'"
                          name="smile"
                          :size="16"
                          color="#4b5563"
                          background-color="transparent"
                        />
                        <OfficeIcon
                          v-else-if="item.monoIconName"
                          :name="item.monoIconName"
                          :size="16"
                          color="#4b5563"
                          background-color="transparent"
                        />
                      </span>
                      <span class="norio-office-rich-insert-menu__label">{{ item.label }}</span>
                      <OfficeIcon
                        v-if="item.key === 'table' || item.key === 'emoji' || item.key === 'columns'"
                        name="youjiantou"
                        :size="12"
                        color="#9ca3af"
                        background-color="transparent"
                      />
                    </button>
                        </div>

                        <div v-if="filteredInsertAppItems.length" class="norio-office-rich-insert-menu__section">
                    <div class="norio-office-rich-insert-menu__title">小应用</div>
                    <button
                      v-for="item in filteredInsertAppItems"
                      :key="item.key"
                      type="button"
                      class="norio-office-rich-insert-menu__item"
                      :class="{ 'norio-office-rich-insert-menu__item--active': activeInsertSubmenu === item.key }"
                      @mouseenter="setActiveInsertSubmenu(null)"
                      @focus="setActiveInsertSubmenu(null)"
                      @click="handleInsertAction(item.action)"
                    >
                      <span class="norio-office-rich-insert-menu__icon">
                        <OfficeColorIcon
                          v-if="item.colorIconName"
                          :name="item.colorIconName"
                          :size="18"
                          background-color="transparent"
                        />
                      </span>
                      <span class="norio-office-rich-insert-menu__label">{{ item.label }}</span>
                    </button>
                        </div>

                        <div v-if="filteredInsertExternalItems.length" class="norio-office-rich-insert-menu__section">
                    <div class="norio-office-rich-insert-menu__title">外部内容</div>
                    <button
                      v-for="item in filteredInsertExternalItems"
                      :key="item.key"
                      type="button"
                      class="norio-office-rich-insert-menu__item"
                      @mouseenter="setActiveInsertSubmenu(null)"
                      @focus="setActiveInsertSubmenu(null)"
                      @click="handleInsertAction(item.action)"
                    >
                      <span class="norio-office-rich-insert-menu__icon">
                        <OfficeColorIcon
                          v-if="item.colorIconName"
                          :name="item.colorIconName"
                          :size="18"
                          background-color="transparent"
                        />
                        <OfficeIcon
                          v-else-if="item.monoIconName"
                          :name="item.monoIconName"
                          :size="16"
                          color="#4b5563"
                          background-color="transparent"
                        />
                      </span>
                      <span class="norio-office-rich-insert-menu__label">{{ item.label }}</span>
                    </button>
                        </div>
                      </div>
                    </ScrollArea>

                    <div
                      v-if="activeInsertSubmenu === 'table'"
                      class="norio-office-rich-insert-submenu norio-office-rich-insert-submenu--table"
                      @mouseleave="clearTableHover"
                    >
                      <div class="norio-office-rich-insert-submenu__title">插入表格</div>
                      <div class="norio-office-rich-insert-submenu__title norio-office-rich-insert-submenu__title--preview">{{ tablePreviewLabel }}</div>
                      <div class="norio-office-rich-table-grid">
                        <button
                          v-for="cellIndex in tableGridRows * tableGridCols"
                          :key="cellIndex"
                          type="button"
                          class="norio-office-rich-table-grid__cell"
                          :class="{
                            'norio-office-rich-table-grid__cell--active':
                              Math.ceil(cellIndex / tableGridCols) <= hoveredTableRows &&
                              ((cellIndex - 1) % tableGridCols) + 1 <= hoveredTableCols,
                          }"
                          @mouseenter="
                            hoverTableSize(
                              Math.ceil(cellIndex / tableGridCols),
                              ((cellIndex - 1) % tableGridCols) + 1,
                            )
                          "
                          @focus="
                            hoverTableSize(
                              Math.ceil(cellIndex / tableGridCols),
                              ((cellIndex - 1) % tableGridCols) + 1,
                            )
                          "
                          @click="
                            insertTable(
                              Math.ceil(cellIndex / tableGridCols),
                              ((cellIndex - 1) % tableGridCols) + 1,
                            )
                          "
                        />
                      </div>
                      <div class="norio-office-rich-insert-submenu__footer">
                        
                      </div>
                    </div>

                    <div
                      v-if="activeInsertSubmenu === 'emoji'"
                      class="norio-office-rich-insert-submenu norio-office-rich-insert-submenu--emoji"
                    >
                      <EmojiPickerPanel @select="insertEmojiFromPicker" />
                    </div>

                    <div
                      v-if="activeInsertSubmenu === 'columns'"
                      class="norio-office-rich-insert-submenu norio-office-rich-insert-submenu--columns"
                      :style="columnsSubmenuStyle"
                      @mouseleave="clearColumnsHover"
                    >
                      <div class="norio-office-rich-insert-submenu__title norio-office-rich-insert-submenu__title--preview">{{ columnsSubmenuLabel }}</div>
                      <div class="norio-office-rich-columns-picker">
                        <div class="norio-office-rich-columns-picker__grid">
                          <button
                            v-for="count in columnGridCount"
                            :key="`columns-count-${count}`"
                            type="button"
                            class="norio-office-rich-columns-picker__cell"
                            :class="{ 'norio-office-rich-columns-picker__cell--active': count <= hoveredColumnsCount }"
                            @mouseenter="hoverColumnsSize(count)"
                            @focus="hoverColumnsSize(count)"
                            @click="insertColumnsBlock(count)"
                          />
                        </div>
                      </div>
                    </div>

                    <div
                      v-if="activeInsertSubmenu === 'countdown'"
                      class="norio-office-rich-insert-submenu norio-office-rich-insert-submenu--countdown"
                      :style="countdownSubmenuStyle"
                    >
                      <div class="norio-office-rich-countdown-settings">
                        <div class="norio-office-rich-countdown-settings__header">
                          <div class="norio-office-rich-countdown-settings__title">倒计时设置</div>
                          <button type="button" class="norio-office-rich-countdown-settings__close" @click="setActiveInsertSubmenu(null)">
                            <OfficeIcon name="close" :size="16" color="#6b7280" background-color="transparent" />
                          </button>
                        </div>

                        <label class="norio-office-rich-countdown-settings__row norio-office-rich-countdown-settings__row--deadline">
                          <span class="norio-office-rich-countdown-settings__radio">
                            <input v-model="countdownInsertMode" type="radio" value="deadline" />
                            <span class="norio-office-rich-countdown-settings__radio-dot" />
                          </span>
                          <span class="norio-office-rich-countdown-settings__label">截止时间</span>
                          <button
                            ref="countdownDateTriggerRef"
                            type="button"
                            class="norio-office-rich-countdown-settings__datetime"
                            :disabled="countdownInsertMode !== 'deadline'"
                            @click="toggleCountdownDeadlinePicker"
                          >
                            <span>{{ countdownDeadlineDisplay }}</span>
                            <OfficeIcon name="xiangxiajiantou" :size="12" color="#6b7280" background-color="transparent" />
                          </button>
                        </label>

                        <div
                          v-if="countdownInsertMode === 'deadline' && isCountdownDeadlinePickerOpen"
                          ref="countdownPickerRef"
                          class="norio-office-rich-countdown-settings__picker-panel"
                          :class="`norio-office-rich-countdown-settings__picker-panel--${countdownPickerPlacement}`"
                        >
                          <div class="norio-office-rich-countdown-settings__picker-top">
                            <select
                              class="norio-office-rich-countdown-settings__picker-select norio-office-rich-countdown-settings__picker-select--year"
                              :value="String(countdownCalendarYear)"
                              @change="updateCountdownCalendarYear(($event.target as HTMLSelectElement).value)"
                            >
                              <option v-for="year in countdownYearOptions" :key="year" :value="year">{{ year }}</option>
                            </select>

                            <select
                              class="norio-office-rich-countdown-settings__picker-select norio-office-rich-countdown-settings__picker-select--month"
                              :value="String(countdownCalendarMonth)"
                              @change="updateCountdownCalendarMonth(($event.target as HTMLSelectElement).value)"
                            >
                              <option v-for="month in countdownMonthOptions" :key="month" :value="month">{{ month + 1 }}</option>
                            </select>

                            <button type="button" class="norio-office-rich-countdown-settings__today" @click="selectCountdownToday">
                              今
                            </button>
                          </div>

                          <div class="norio-office-rich-countdown-settings__weekdays">
                            <span v-for="weekday in countdownWeekdayLabels" :key="weekday" class="norio-office-rich-countdown-settings__weekday">
                              {{ weekday }}
                            </span>
                          </div>

                          <div class="norio-office-rich-countdown-settings__calendar">
                            <button
                              v-for="cell in countdownCalendarCells"
                              :key="cell.key"
                              type="button"
                              class="norio-office-rich-countdown-settings__day"
                              :class="{
                                'norio-office-rich-countdown-settings__day--muted': !cell.isCurrentMonth,
                                'norio-office-rich-countdown-settings__day--today': cell.isToday,
                                'norio-office-rich-countdown-settings__day--selected': cell.isSelected,
                                'norio-office-rich-countdown-settings__day--disabled': cell.isDisabled,
                              }"
                              :disabled="cell.isDisabled"
                              @click="selectCountdownCalendarDate(cell.year, cell.month, cell.day)"
                            >
                              {{ cell.label }}
                            </button>
                          </div>

                          <div class="norio-office-rich-countdown-settings__time-section">
                            <div class="norio-office-rich-countdown-settings__time-label">设置时间</div>
                            <div class="norio-office-rich-countdown-settings__time-panel">
                              <input
                                v-model="countdownTimeInput"
                                class="norio-office-rich-countdown-settings__time-input"
                                type="time"
                                step="60"
                                :min="countdownTimeMin"
                                @input="applyCountdownTimeOption(countdownTimeInput)"
                                @change="applyCountdownTimeOption(countdownTimeInput)"
                              />
                              <button type="button" class="norio-office-rich-countdown-settings__time-confirm" @click="confirmCountdownDeadlinePicker">
                                确定
                              </button>
                            </div>
                          </div>
                        </div>

                        <label class="norio-office-rich-countdown-settings__row norio-office-rich-countdown-settings__row--duration">
                          <span class="norio-office-rich-countdown-settings__radio">
                            <input v-model="countdownInsertMode" type="radio" value="duration" />
                            <span class="norio-office-rich-countdown-settings__radio-dot" />
                          </span>
                          <span class="norio-office-rich-countdown-settings__label">计时长度</span>
                          <div class="norio-office-rich-countdown-settings__duration">
                            <input v-model="countdownDurationDays" class="norio-office-rich-countdown-settings__number" type="number" min="0" :disabled="countdownInsertMode !== 'duration'" />
                            <span class="norio-office-rich-countdown-settings__unit">天</span>
                            <input v-model="countdownDurationHours" class="norio-office-rich-countdown-settings__number" type="number" min="0" max="23" :disabled="countdownInsertMode !== 'duration'" />
                            <span class="norio-office-rich-countdown-settings__unit">时</span>
                            <input v-model="countdownDurationMinutes" class="norio-office-rich-countdown-settings__number" type="number" min="0" max="59" :disabled="countdownInsertMode !== 'duration'" />
                            <span class="norio-office-rich-countdown-settings__unit">分</span>
                            <input v-model="countdownDurationSeconds" class="norio-office-rich-countdown-settings__number" type="number" min="0" max="59" :disabled="countdownInsertMode !== 'duration'" />
                            <span class="norio-office-rich-countdown-settings__unit">秒</span>
                          </div>
                        </label>

                        <div class="norio-office-rich-countdown-settings__actions">
                          <button type="button" class="norio-office-rich-countdown-settings__button norio-office-rich-countdown-settings__button--secondary" @click="setActiveInsertSubmenu(null)">
                            取消
                          </button>
                          <button type="button" class="norio-office-rich-countdown-settings__button norio-office-rich-countdown-settings__button--primary" @click="insertCountdownBlock">
                            确定
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="norio-office-rich-toolbar__group">
              <div ref="headingMenuRef" class="norio-office-rich-toolbar__dropdown">
                <button
                  type="button"
                  class="norio-office-rich-toolbar__button norio-office-rich-toolbar__button--select norio-office-rich-toolbar__button--heading"
                  :disabled="!canOpenHeadingMenu"
                  @click="toggleHeadingMenu"
                >
                  <span class="norio-office-rich-toolbar__heading-label">{{ headingLevel }}</span>
                  <OfficeIcon name="xiangxiajiantou" :size="12" color="#9ca3af" background-color="transparent" />
                </button>

                <div v-if="isHeadingMenuOpen" class="norio-office-rich-toolbar__menu norio-office-rich-toolbar__menu--heading">
                  <button
                    v-for="option in headingOptions"
                    :key="option.key"
                    type="button"
                    class="norio-office-rich-toolbar__menu-item norio-office-rich-toolbar__menu-item--heading"
                    :disabled="!canApplyHeading(option.level)"
                    :class="{
                      'norio-office-rich-toolbar__menu-item--active':
                        option.level ? editor?.isActive('heading', { level: option.level }) : !editor?.isActive('heading'),
                    }"
                    @click="applyHeading(option.level)"
                  >
                    <OfficeColorIcon
                      v-if="option.level ? editor?.isActive('heading', { level: option.level }) : !editor?.isActive('heading')"
                      name="duihao"
                      :size="16"
                      background-color="transparent"
                    />
                    <span v-else class="norio-office-rich-toolbar__menu-check" />
                    <span class="norio-office-rich-toolbar__menu-type">{{ option.level ? `H${option.level}` : 'T' }}</span>
                    <span class="norio-office-rich-toolbar__menu-label">{{ option.label }}</span>
                  </button>
                </div>
              </div>

              <div ref="fontFamilyMenuRef" class="norio-office-rich-toolbar__dropdown">
                <button
                  type="button"
                  class="norio-office-rich-toolbar__button norio-office-rich-toolbar__button--select norio-office-rich-toolbar__button--font-family"
                  :disabled="!canOpenFontFamilyMenu"
                  @click="toggleFontFamilyMenu"
                >
                  <span class="norio-office-rich-toolbar__label">{{ currentFontFamily }}</span>
                  <OfficeIcon name="xiangxiajiantou" :size="12" color="#9ca3af" background-color="transparent" />
                </button>

                <div v-if="isFontFamilyMenuOpen" class="norio-office-rich-toolbar__menu norio-office-rich-toolbar__menu--font-family">
                  <ScrollArea class-name="norio-office-rich-toolbar__menu-scroll" max-height="360px">
                    <button
                      v-for="option in fontFamilyOptions"
                      :key="option.label"
                      type="button"
                      class="norio-office-rich-toolbar__menu-item norio-office-rich-toolbar__menu-item--font-family"
                      :disabled="!canApplyFontFamily(option.value)"
                      :class="{ 'norio-office-rich-toolbar__menu-item--active': currentFontFamily === option.label }"
                      @click="applyFontFamily(option.value)"
                    >
                      <OfficeColorIcon
                        v-if="currentFontFamily === option.label"
                        name="duihao"
                        :size="16"
                        background-color="transparent"
                      />
                      <span v-else class="norio-office-rich-toolbar__menu-check" />
                      <span class="norio-office-rich-toolbar__menu-label" :style="option.value ? { fontFamily: option.value } : undefined">
                        {{ option.label }}
                      </span>
                    </button>
                  </ScrollArea>
                </div>
              </div>

              <div ref="fontSizeMenuRef" class="norio-office-rich-toolbar__dropdown">
                <button
                  type="button"
                  class="norio-office-rich-toolbar__button norio-office-rich-toolbar__button--select norio-office-rich-toolbar__button--font-size"
                  :disabled="!canOpenFontSizeMenu"
                  @click="toggleFontSizeMenu"
                >
                  <span class="norio-office-rich-toolbar__label">{{ currentFontSize }}</span>
                  <OfficeIcon name="xiangxiajiantou" :size="12" color="#9ca3af" background-color="transparent" />
                </button>

                <div v-if="isFontSizeMenuOpen" class="norio-office-rich-toolbar__menu norio-office-rich-toolbar__menu--font-size">
                  <ScrollArea class-name="norio-office-rich-toolbar__menu-scroll" max-height="520px">
                  <button
                    v-for="option in fontSizeOptions"
                    :key="option.label"
                    type="button"
                    class="norio-office-rich-toolbar__menu-item norio-office-rich-toolbar__menu-item--font-size"
                    :disabled="!canApplyFontSize(option.value)"
                    :class="{ 'norio-office-rich-toolbar__menu-item--active': currentFontSize === option.label }"
                    @click="applyFontSize(option.value)"
                  >
                    <OfficeColorIcon
                      v-if="currentFontSize === option.label"
                      name="duihao"
                      :size="16"
                      background-color="transparent"
                    />
                    <span v-else class="norio-office-rich-toolbar__menu-check" />
                    <span class="norio-office-rich-toolbar__menu-label">{{ option.label }}</span>
                  </button>
                  </ScrollArea>
                </div>
              </div>
            </div>

            <div class="norio-office-rich-toolbar__group">
              <div ref="colorMenuRef" class="norio-office-rich-toolbar__dropdown">
                <button
                  type="button"
                  class="norio-office-rich-toolbar__button norio-office-rich-toolbar__button--select norio-office-rich-toolbar__button--color"
                  :disabled="!canOpenTextColorMenu"
                  @click="toggleColorMenu"
                >
                  <span class="norio-office-rich-toolbar__color-trigger">
                    <span class="norio-office-rich-toolbar__color-text">A</span>
                    <span class="norio-office-rich-toolbar__color-line" :style="{ backgroundColor: currentTextColor }" />
                  </span>
                  <OfficeIcon name="xiangxiajiantou" :size="12" color="#9ca3af" background-color="transparent" />
                </button>

                <ColorPalettePanel v-if="isColorMenuOpen"
                  class="norio-office-rich-toolbar__menu norio-office-rich-toolbar__menu--color"
                  :color="currentTextColor" default-color="#333333" :recent-colors="recentColors"
                  @change="applyTextColor" />
              </div>

              <div ref="highlightMenuRef" class="norio-office-rich-toolbar__dropdown">
                <button
                  type="button"
                  class="norio-office-rich-toolbar__button norio-office-rich-toolbar__button--select norio-office-rich-toolbar__button--color"
                  :disabled="!canOpenHighlightMenu"
                  @click="toggleHighlightMenu"
                >
                  <span class="norio-office-rich-toolbar__color-trigger">
                    <OfficeIcon name="beijingse" :size="14" color="#4b5563" background-color="transparent" />
                    <span class="norio-office-rich-toolbar__color-line" :style="{ backgroundColor: currentHighlightColor }" />
                  </span>
                  <OfficeIcon name="xiangxiajiantou" :size="12" color="#9ca3af" background-color="transparent" />
                </button>

                <ColorPalettePanel v-if="isHighlightMenuOpen"
                  class="norio-office-rich-toolbar__menu norio-office-rich-toolbar__menu--color"
                  :color="currentHighlightColor" default-color="#FFF3C4" :recent-colors="recentHighlightColors"
                  @change="applyHighlightColor" />
              </div>

              <button
                type="button"
                class="norio-office-rich-toolbar__button"
                :disabled="!canToggleBold"
                :class="{ 'norio-office-rich-toolbar__button--active': editor?.isActive('bold') }"
                @click="toggleBold"
              >
                <OfficeIcon name="jiacu" :size="16" color="#4b5563" background-color="transparent" />
              </button>

              <button
                type="button"
                class="norio-office-rich-toolbar__button"
                :disabled="!canToggleItalic"
                :class="{ 'norio-office-rich-toolbar__button--active': editor?.isActive('italic') }"
                @click="toggleItalic"
              >
                <OfficeIcon name="xieti" :size="16" color="#4b5563" background-color="transparent" />
              </button>

              <button
                type="button"
                class="norio-office-rich-toolbar__button"
                :disabled="!canToggleUnderline"
                :class="{ 'norio-office-rich-toolbar__button--active': editor?.isActive('underline') }"
                @click="toggleUnderline"
              >
                <OfficeIcon name="xiahuaxian" :size="16" color="#4b5563" background-color="transparent" />
              </button>

              <button
                type="button"
                class="norio-office-rich-toolbar__button"
                :disabled="!canToggleStrike"
                :class="{ 'norio-office-rich-toolbar__button--active': editor?.isActive('strike') }"
                @click="toggleStrike"
              >
                <span class="norio-office-rich-toolbar__text-icon norio-office-rich-toolbar__text-icon--strike">S</span>
              </button>

              <div ref="scriptMenuRef" class="norio-office-rich-toolbar__dropdown">
                <button
                  type="button"
                  class="norio-office-rich-toolbar__button norio-office-rich-toolbar__button--select"
                  :disabled="!canOpenScriptMenu"
                  :class="{ 'norio-office-rich-toolbar__button--active': editor?.isActive('superscript') || editor?.isActive('subscript') }"
                  @click="toggleScriptMenu"
                >
                  <OfficeIcon
                    v-if="scriptDisplay.icon"
                    :name="scriptDisplay.icon"
                    :size="16"
                    color="#4b5563"
                    background-color="transparent"
                  />
                  <span v-else class="norio-office-rich-toolbar__text-icon">{{ scriptDisplay.text }}</span>
                  <OfficeIcon name="xiangxiajiantou" :size="12" color="#9ca3af" background-color="transparent" />
                </button>

                <div v-if="isScriptMenuOpen" class="norio-office-rich-toolbar__menu">
                  <button
                    type="button"
                    class="norio-office-rich-toolbar__menu-item"
                    :disabled="!canApplySuperscript()"
                    :class="{ 'norio-office-rich-toolbar__menu-item--active': editor?.isActive('superscript') }"
                    @click="applySuperscript"
                  >
                    <OfficeColorIcon
                      v-if="editor?.isActive('superscript')"
                      name="duihao"
                      :size="16"
                      background-color="transparent"
                    />
                    <span v-else class="norio-office-rich-toolbar__menu-check" />
                    <OfficeIcon name="shangbiao" :size="16" color="#4b5563" background-color="transparent" />
                    <span class="norio-office-rich-toolbar__menu-label">上标</span>
                    <span class="norio-office-rich-toolbar__menu-shortcut">Ctrl+Shift+.</span>
                  </button>

                  <button
                    type="button"
                    class="norio-office-rich-toolbar__menu-item"
                    :disabled="!canApplySubscript()"
                    :class="{ 'norio-office-rich-toolbar__menu-item--active': editor?.isActive('subscript') }"
                    @click="applySubscript"
                  >
                    <OfficeColorIcon
                      v-if="editor?.isActive('subscript')"
                      name="duihao"
                      :size="16"
                      background-color="transparent"
                    />
                    <span v-else class="norio-office-rich-toolbar__menu-check" />
                    <OfficeIcon name="xiabiao" :size="16" color="#4b5563" background-color="transparent" />
                    <span class="norio-office-rich-toolbar__menu-label">下标</span>
                    <span class="norio-office-rich-toolbar__menu-shortcut">Ctrl+Shift+,</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="norio-office-rich-toolbar__group">
              <button
                type="button"
                class="norio-office-rich-toolbar__button"
                :disabled="!canToggleBulletList"
                :class="{ 'norio-office-rich-toolbar__button--active': editor?.isActive('bulletList') }"
                @click="toggleBulletList"
              >
                <OfficeIcon name="wuxuliebiao" :size="16" color="#4b5563" background-color="transparent" />
              </button>

              <button
                type="button"
                class="norio-office-rich-toolbar__button"
                :disabled="!canToggleOrderedList"
                :class="{ 'norio-office-rich-toolbar__button--active': editor?.isActive('orderedList') }"
                @click="toggleOrderedList"
              >
                <OfficeIcon name="youxuliebiao" :size="16" color="#4b5563" background-color="transparent" />
              </button>

              <button
                type="button"
                class="norio-office-rich-toolbar__button"
                :disabled="!canToggleTaskList"
                :class="{ 'norio-office-rich-toolbar__button--active': editor?.isActive('taskList') }"
                @click="toggleTaskList"
              >
                <OfficeIcon name="To-do" :size="16" color="#4b5563" background-color="transparent" />
              </button>

              <div ref="alignMenuRef" class="norio-office-rich-toolbar__dropdown">
                <button
                  type="button"
                  class="norio-office-rich-toolbar__button norio-office-rich-toolbar__button--select"
                  :disabled="!canOpenAlignMenu"
                  :class="{ 'norio-office-rich-toolbar__button--active': isAlignMenuOpen }"
                  @click="toggleAlignMenu"
                >
                  <OfficeIcon
                    :name="currentTextAlign === 'center' ? 'juzhongduiqi' : currentTextAlign === 'right' ? 'youduiqi' : 'zuoduiqi'"
                    :size="16"
                    color="#4b5563"
                    background-color="transparent"
                  />
                  <OfficeIcon name="xiangxiajiantou" :size="12" color="#9ca3af" background-color="transparent" />
                </button>

                <div v-if="isAlignMenuOpen" class="norio-office-rich-toolbar__menu norio-office-rich-toolbar__menu--align">
                  <button
                    type="button"
                    class="norio-office-rich-toolbar__menu-item norio-office-rich-toolbar__menu-item--align"
                    :disabled="!canApplyTextAlign('left')"
                    :class="{ 'norio-office-rich-toolbar__menu-item--active': currentTextAlign === 'left' }"
                    @click="applyTextAlign('left')"
                  >
                    <OfficeColorIcon
                      v-if="currentTextAlign === 'left'"
                      name="duihao"
                      :size="16"
                      background-color="transparent"
                    />
                    <span v-else class="norio-office-rich-toolbar__menu-check" />
                    <OfficeIcon name="zuoduiqi" :size="16" color="#4b5563" background-color="transparent" />
                    <span class="norio-office-rich-toolbar__menu-label">左对齐</span>
                  </button>

                  <button
                    type="button"
                    class="norio-office-rich-toolbar__menu-item norio-office-rich-toolbar__menu-item--align"
                    :disabled="!canApplyTextAlign('center')"
                    :class="{ 'norio-office-rich-toolbar__menu-item--active': currentTextAlign === 'center' }"
                    @click="applyTextAlign('center')"
                  >
                    <OfficeColorIcon
                      v-if="currentTextAlign === 'center'"
                      name="duihao"
                      :size="16"
                      background-color="transparent"
                    />
                    <span v-else class="norio-office-rich-toolbar__menu-check" />
                    <OfficeIcon name="juzhongduiqi" :size="16" color="#4b5563" background-color="transparent" />
                    <span class="norio-office-rich-toolbar__menu-label">居中对齐</span>
                  </button>

                  <button
                    type="button"
                    class="norio-office-rich-toolbar__menu-item norio-office-rich-toolbar__menu-item--align"
                    :disabled="!canApplyTextAlign('right')"
                    :class="{ 'norio-office-rich-toolbar__menu-item--active': currentTextAlign === 'right' }"
                    @click="applyTextAlign('right')"
                  >
                    <OfficeColorIcon
                      v-if="currentTextAlign === 'right'"
                      name="duihao"
                      :size="16"
                      background-color="transparent"
                    />
                    <span v-else class="norio-office-rich-toolbar__menu-check" />
                    <OfficeIcon name="youduiqi" :size="16" color="#4b5563" background-color="transparent" />
                    <span class="norio-office-rich-toolbar__menu-label">右对齐</span>
                  </button>
                </div>
              </div>

              <button type="button" class="norio-office-rich-toolbar__button" :disabled="!canDecreaseIndent" @click="decreaseIndent">
                <OfficeIcon name="zuosuojin" :size="16" color="#4b5563" background-color="transparent" />
              </button>

              <button type="button" class="norio-office-rich-toolbar__button" :disabled="!canIncreaseIndent" @click="increaseIndent">
                <OfficeIcon name="yousuojin" :size="16" color="#4b5563" background-color="transparent" />
              </button>

              <div v-if="isBlockquoteToolbarEnabled" ref="quoteMenuRef" class="norio-office-rich-toolbar__dropdown">
                <button
                  type="button"
                  class="norio-office-rich-toolbar__button norio-office-rich-toolbar__button--select"
                  :disabled="!canOpenQuoteMenu"
                  :class="{ 'norio-office-rich-toolbar__button--active': editor?.isActive('blockquote') }"
                  @click="toggleQuoteMenu"
                >
                  <OfficeIcon name="yinyong" :size="16" color="#4b5563" background-color="transparent" />
                  <OfficeIcon name="xiangxiajiantou" :size="12" color="#9ca3af" background-color="transparent" />
                </button>

                <div v-if="isQuoteMenuOpen" class="norio-office-rich-toolbar__menu norio-office-rich-toolbar__menu--quote">
                  <div class="norio-office-rich-color-menu__section">
                    <button type="button" class="norio-office-rich-color-menu__current" :disabled="!canToggleBlockquote" @click="toggleBlockquote">
                      {{ editor?.isActive('blockquote') ? '取消引用' : '应用引用' }}
                    </button>
                  </div>

                  <div class="norio-office-rich-color-menu__section">
                    <div class="norio-office-rich-color-menu__label">边框颜色</div>
                    <div class="norio-office-rich-color-menu__row">
                      <button
                        v-for="color in quoteBorderColors"
                        :key="`quote-border-${color}`"
                        type="button"
                        class="norio-office-rich-color-menu__swatch norio-office-rich-color-menu__swatch--compact"
                        :disabled="!editor?.isActive('blockquote')"
                        :style="{ backgroundColor: color }"
                        :class="{ 'norio-office-rich-color-menu__swatch--active': currentQuoteBorderColor === color }"
                        @click="applyQuoteBorderColor(color)"
                      />
                    </div>
                  </div>

                  <div class="norio-office-rich-color-menu__section">
                    <div class="norio-office-rich-color-menu__label">背景颜色</div>
                    <div class="norio-office-rich-color-menu__row">
                      <button
                        v-for="color in quoteBackgroundColors"
                        :key="`quote-bg-${color}`"
                        type="button"
                        class="norio-office-rich-color-menu__swatch norio-office-rich-color-menu__swatch--compact"
                        :disabled="!editor?.isActive('blockquote')"
                        :style="{ backgroundColor: color }"
                        :class="{ 'norio-office-rich-color-menu__swatch--active': currentQuoteBackgroundColor === color }"
                        @click="applyQuoteBackgroundColor(color)"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                class="norio-office-rich-toolbar__button"
                :disabled="!canToggleInlineCode"
                :class="{ 'norio-office-rich-toolbar__button--active': editor?.isActive('code') }"
                @click="toggleInlineCode"
              >
                <OfficeIcon name="code" :size="16" color="#4b5563" background-color="transparent" />
              </button>

              <div v-if="isEmojiToolbarEnabled" ref="emojiToolbarMenuRef" class="norio-office-rich-toolbar__dropdown">
                <button
                  type="button"
                  class="norio-office-rich-toolbar__button"
                  :disabled="!editorEditable"
                  :class="{ 'norio-office-rich-toolbar__button--active': isEmojiToolbarMenuOpen }"
                  title="表情符号"
                  @click="toggleEmojiToolbarMenu"
                >
                  <OfficeIcon name="smile" :size="16" color="#4b5563" background-color="transparent" />
                </button>

                <div v-if="isEmojiToolbarMenuOpen" class="norio-office-rich-toolbar__menu norio-office-rich-toolbar__menu--emoji">
                  <EmojiPickerPanel @select="insertEmojiFromPicker" />
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </header>

    <div class="norio-office-rich-editor__main">
      <button
        v-if="isOutlineFeatureEnabled && !isOutlineOpen"
        ref="outlineTriggerRef"
        type="button"
        class="norio-office-rich-outline-trigger"
        :data-placement="resolvedOutlinePlacement"
        :title="outlineLabel"
        :aria-label="outlineLabel"
        :aria-controls="outlinePanelId"
        :aria-expanded="false"
        @click="toggleOutline"
      >
        <OfficeIcon name="dagang" :size="18" color="currentColor" background-color="transparent" />
      </button>
      <div
        v-if="isOutlineFeatureEnabled"
        :id="outlinePanelId"
        class="norio-office-rich-outline-shell"
        :data-open="isOutlineOpen"
        :data-placement="resolvedOutlinePlacement"
        @keydown.esc.prevent.stop="isOutlineOpen && toggleOutline()"
      >
        <OutlinePanel
          internal
          :open="isOutlineOpen"
          :placement="resolvedOutlinePlacement"
          :title="outlineLabel"
          :collapse-title="outlineCollapseTitle"
          :empty-description="outlineEmptyDescription"
          :empty-tip="outlineEmptyTip"
          :items="outlineItems"
          :active-pos="activeOutlinePos"
          @toggle="toggleOutline"
          @select="focusOutlineItem"
        />
      </div>

      <section class="norio-office-rich-editor__workspace">
        <ScrollArea class-name="norio-office-rich-editor__scroll">
          <div class="norio-office-rich-editor__stage" :style="pageStageStyle">
            <div
              ref="pageRef"
              class="norio-office-rich-editor__page"
              @mousedown.capture="handlePageMouseDown"
              @keydown.capture="handlePageEditorKeyDown"
              @beforeinput.capture="handlePageEditorInput"
              @compositionstart.capture="handlePageEditorCompositionStart"
              @compositionend.capture="handlePageEditorCompositionEnd"
              @mousemove="handlePageBlockMouseMove"
              @mouseleave="handlePageBlockMouseLeave"
              @dragenter.capture="handlePageImageDragEnter"
              @dragover.capture="handlePageImageDragOver"
              @dragleave.capture="handlePageImageDragLeave"
              @drop.capture="handlePageImageDrop"
            >
              <TextSelectionMenu
                @visibility-change="isTextSelectionBubbleVisible = $event"
                v-if="editor"
                :editor="editor" :actions="textSelectionActions"
                :enabled="editorEditable && !isPresentationMode && !blockSideMenuMode && !hasMarqueeSelection"
              />
              <TextSelectionMenu
                v-if="editor"
                scope="table"
                :editor="editor" :actions="tableSelectionActions"
                :enabled="editorEditable && !isPresentationMode && !blockSideMenuMode && !hasMarqueeSelection"
                @visibility-change="isTableSelectionBubbleVisible = $event"
                :get-referenced-virtual-element="getTableBubbleVirtualElement"
              >
                <div class="norio-office-rich-table-bubble-menu__actions">
                  <button
                    type="button"
                    class="norio-office-rich-table-bubble-menu__button"
                    :disabled="!canMergeSelectedTableCells"
                    title="合并单元格"
                    @mousedown.prevent
                    @click="mergeTableCells"
                  >
                    <OfficeIcon name="merge" :size="14" :color="canMergeSelectedTableCells ? '#4b5563' : '#c5ccd8'" background-color="transparent" />
                  </button>
                  <button
                    type="button"
                    class="norio-office-rich-table-bubble-menu__button"
                    :disabled="!canSplitSelectedTableCell"
                    title="拆分单元格"
                    @mousedown.prevent
                    @click="splitTableCell"
                  >
                    <OfficeIcon name="split" :size="14" :color="canSplitSelectedTableCell ? '#4b5563' : '#c5ccd8'" background-color="transparent" />
                  </button>
                  <div ref="tableActionColorMenuRef" class="norio-office-rich-table-bubble-menu__dropdown">
                    <button
                      type="button"
                      class="norio-office-rich-table-bubble-menu__button"
                      :class="{ 'norio-office-rich-table-bubble-menu__button--active': isTableActionColorMenuOpen }"
                      :disabled="!canApplyTableCellBackground"
                      title="设置单元格背景色"
                      @mousedown.prevent
                      @click="toggleTableActionColorMenu"
                    >
                      <OfficeIcon name="yanse" :size="14" :color="canApplyTableCellBackground ? '#4b5563' : '#c5ccd8'" background-color="transparent" />
                    </button>

                    <div v-if="isTableActionColorMenuOpen" class="norio-office-rich-table-bubble-menu__menu norio-office-rich-table-bubble-menu__menu--palette">
                      <div class="norio-office-rich-table-bubble-menu__menu-title">单元格背景颜色</div>
                      <div class="norio-office-rich-table-bubble-menu__color-grid">
                        <button
                          v-for="color in tableCellPaletteColors"
                          :key="`table-cell-${color ?? 'none'}`"
                          type="button"
                          class="norio-office-rich-table-bubble-menu__color-swatch"
                          :class="{
                            'norio-office-rich-table-bubble-menu__color-swatch--active': currentTableCellBackgroundColor === color,
                            'norio-office-rich-table-bubble-menu__color-swatch--none': color === null,
                          }"
                          :style="color ? { backgroundColor: color } : undefined"
                          @mousedown.prevent
                          @click="applyTableCellBackgroundColor(color)"
                        />
                      </div>
                      <button
                        type="button"
                        class="norio-office-rich-table-bubble-menu__reset"
                        @mousedown.prevent
                        @click="applyTableCellBackgroundColor(null)"
                      >
                        恢复默认
                      </button>
                    </div>
                  </div>
                  <div ref="tableThemeMenuRef" class="norio-office-rich-table-bubble-menu__dropdown">
                    <button
                      type="button"
                      class="norio-office-rich-table-bubble-menu__button"
                      :class="{ 'norio-office-rich-table-bubble-menu__button--active': isTableThemeMenuOpen }"
                      :disabled="!canApplyTableCellBackground"
                      title="表格主题色"
                      aria-label="表格主题色"
                      :aria-expanded="isTableThemeMenuOpen"
                      @mousedown.prevent
                      @click="toggleTableThemeMenu"
                    >
                      <OfficeIcon name="zhuti" :size="14" :color="canApplyTableCellBackground ? '#4b5563' : '#c5ccd8'" background-color="transparent" />
                    </button>
                    <TableThemePanel
                      v-if="isTableThemeMenuOpen"
                      :theme="currentTableTheme"
                      :recent-colors="recentHighlightColors"
                      :style="tableThemeMenuStyle"
                      @change="applyTableTheme"
                      @color-used="rememberHighlightColor"
                      @clear="applyTableTheme(null)"
                      @close="isTableThemeMenuOpen = false"
                      @resize="tableThemeMenuHeight = $event"
                      @reposition="syncTableThemeMenuPosition"
                    />
                  </div>
                  <button
                    type="button"
                    class="norio-office-rich-table-bubble-menu__button"
                    :disabled="!canInsertRowAround"
                    title="上增加一行"
                    @mousedown.prevent
                    @click="addTableRowBefore"
                  >
                    <OfficeIcon name="xiangshangcharu" :size="14" :color="canInsertRowAround ? '#4b5563' : '#c5ccd8'" background-color="transparent" />
                  </button>
                  <button
                    type="button"
                    class="norio-office-rich-table-bubble-menu__button"
                    :disabled="!canInsertRowAround"
                    title="下增加一行"
                    @mousedown.prevent
                    @click="addTableRowAfter"
                  >
                    <OfficeIcon name="xiangxiacharujilu-copy" :size="14" :color="canInsertRowAround ? '#4b5563' : '#c5ccd8'" background-color="transparent" />
                  </button>
                  <button
                    type="button"
                    class="norio-office-rich-table-bubble-menu__button"
                    :disabled="!canInsertColumnAround"
                    title="左增加一列"
                    @mousedown.prevent
                    @click="addTableColumnBefore"
                  >
                    <OfficeIcon name="xiangzuocharu" :size="14" :color="canInsertColumnAround ? '#4b5563' : '#c5ccd8'" background-color="transparent" />
                  </button>
                  <button
                    type="button"
                    class="norio-office-rich-table-bubble-menu__button"
                    :disabled="!canInsertColumnAround"
                    title="右增加一列"
                    @mousedown.prevent
                    @click="addTableColumnAfter"
                  >
                    <OfficeIcon name="xiangyoucharu" :size="14" :color="canInsertColumnAround ? '#4b5563' : '#c5ccd8'" background-color="transparent" />
                  </button>
                  <button
                    type="button"
                    class="norio-office-rich-table-bubble-menu__button norio-office-rich-table-bubble-menu__button--danger"
                    :disabled="!canDeleteTableSelection"
                    title="删除"
                    @mousedown.prevent
                    @click="deleteTableSelection"
                  >
                    <OfficeIcon name="delete" :size="14" :color="canDeleteTableSelection ? '#dc2626' : '#c5ccd8'" background-color="transparent" />
                  </button>
                </div>
              </TextSelectionMenu>


              <BubbleMenu
                v-if="editor"
                plugin-key="countdownBlockBubbleMenu"
                class="norio-office-rich-countdown-bubble-menu"
                :editor="editor"
                :should-show="shouldShowCountdownBlockBubbleMenu"
                :get-referenced-virtual-element="getCountdownBlockBubbleVirtualElement"
                :options="{ placement: 'top' }"
              >
                <div class="norio-office-rich-countdown-bubble-menu__toolbar">
                  <div ref="countdownBubbleMenuRef" class="norio-office-rich-countdown-bubble-menu__dropdown">
                    <button
                      ref="countdownBubbleEditButtonRef"
                      type="button"
                      class="norio-office-rich-countdown-bubble-menu__button norio-office-rich-countdown-bubble-menu__button--edit"
                      :class="{ 'norio-office-rich-countdown-bubble-menu__button--active': isCountdownBlockEditOpen }"
                      title="编辑"
                      aria-label="编辑"
                      @mousedown.prevent
                      @click="openCountdownBlockEditPanel"
                    >
                      <OfficeIcon name="edit" :size="14" color="#374151" background-color="transparent" />
                      <span>编辑</span>
                    </button>

                    <div v-if="isCountdownBlockEditOpen" class="norio-office-rich-countdown-bubble-menu__panel">
                      <div class="norio-office-rich-countdown-settings">
                        <div class="norio-office-rich-countdown-settings__header">
                          <div class="norio-office-rich-countdown-settings__title">倒计时设置</div>
                          <button type="button" class="norio-office-rich-countdown-settings__close" @click="isCountdownBlockEditOpen = false">
                            <OfficeIcon name="close" :size="16" color="#6b7280" background-color="transparent" />
                          </button>
                        </div>

                        <label class="norio-office-rich-countdown-settings__row norio-office-rich-countdown-settings__row--deadline">
                          <span class="norio-office-rich-countdown-settings__radio">
                            <input v-model="countdownInsertMode" type="radio" value="deadline" />
                            <span class="norio-office-rich-countdown-settings__radio-dot" />
                          </span>
                          <span class="norio-office-rich-countdown-settings__label">截止时间</span>
                          <button
                            ref="countdownDateTriggerRef"
                            type="button"
                            class="norio-office-rich-countdown-settings__datetime"
                            :disabled="countdownInsertMode !== 'deadline'"
                            @click="toggleCountdownDeadlinePicker"
                          >
                            <span>{{ countdownDeadlineDisplay }}</span>
                            <OfficeIcon name="xiangxiajiantou" :size="12" color="#6b7280" background-color="transparent" />
                          </button>
                        </label>

                        <div
                          v-if="countdownInsertMode === 'deadline' && isCountdownDeadlinePickerOpen"
                          ref="countdownPickerRef"
                          class="norio-office-rich-countdown-settings__picker-panel"
                          :class="`norio-office-rich-countdown-settings__picker-panel--${countdownPickerPlacement}`"
                        >
                          <div class="norio-office-rich-countdown-settings__picker-top">
                            <select
                              class="norio-office-rich-countdown-settings__picker-select norio-office-rich-countdown-settings__picker-select--year"
                              :value="String(countdownCalendarYear)"
                              @change="updateCountdownCalendarYear(($event.target as HTMLSelectElement).value)"
                            >
                              <option v-for="year in countdownYearOptions" :key="year" :value="year">{{ year }}</option>
                            </select>

                            <select
                              class="norio-office-rich-countdown-settings__picker-select norio-office-rich-countdown-settings__picker-select--month"
                              :value="String(countdownCalendarMonth)"
                              @change="updateCountdownCalendarMonth(($event.target as HTMLSelectElement).value)"
                            >
                              <option v-for="month in countdownMonthOptions" :key="month" :value="month">{{ month + 1 }}</option>
                            </select>

                            <button type="button" class="norio-office-rich-countdown-settings__today" @click="selectCountdownToday">
                              今
                            </button>
                          </div>

                          <div class="norio-office-rich-countdown-settings__weekdays">
                            <span v-for="weekday in countdownWeekdayLabels" :key="weekday" class="norio-office-rich-countdown-settings__weekday">
                              {{ weekday }}
                            </span>
                          </div>

                          <div class="norio-office-rich-countdown-settings__calendar">
                            <button
                              v-for="cell in countdownCalendarCells"
                              :key="cell.key"
                              type="button"
                              class="norio-office-rich-countdown-settings__day"
                              :class="{
                                'norio-office-rich-countdown-settings__day--muted': !cell.isCurrentMonth,
                                'norio-office-rich-countdown-settings__day--today': cell.isToday,
                                'norio-office-rich-countdown-settings__day--selected': cell.isSelected,
                              }"
                              @click="selectCountdownCalendarDate(cell.year, cell.month, cell.day)"
                            >
                              {{ cell.label }}
                            </button>
                          </div>

                          <div class="norio-office-rich-countdown-settings__time-section">
                            <div class="norio-office-rich-countdown-settings__time-label">设置时间</div>
                            <div class="norio-office-rich-countdown-settings__time-panel">
                              <input
                                v-model="countdownTimeInput"
                                class="norio-office-rich-countdown-settings__time-input"
                                type="time"
                                step="60"
                                :min="countdownTimeMin"
                                @input="applyCountdownTimeOption(countdownTimeInput)"
                                @change="applyCountdownTimeOption(countdownTimeInput)"
                              />
                              <button type="button" class="norio-office-rich-countdown-settings__time-confirm" @click="confirmCountdownDeadlinePicker">
                                确定
                              </button>
                            </div>
                          </div>
                        </div>

                        <label class="norio-office-rich-countdown-settings__row norio-office-rich-countdown-settings__row--duration">
                          <span class="norio-office-rich-countdown-settings__radio">
                            <input v-model="countdownInsertMode" type="radio" value="duration" />
                            <span class="norio-office-rich-countdown-settings__radio-dot" />
                          </span>
                          <span class="norio-office-rich-countdown-settings__label">计时长度</span>
                          <div class="norio-office-rich-countdown-settings__duration">
                            <input v-model="countdownDurationDays" class="norio-office-rich-countdown-settings__number" type="number" min="0" :disabled="countdownInsertMode !== 'duration'" />
                            <span class="norio-office-rich-countdown-settings__unit">天</span>
                            <input v-model="countdownDurationHours" class="norio-office-rich-countdown-settings__number" type="number" min="0" max="23" :disabled="countdownInsertMode !== 'duration'" />
                            <span class="norio-office-rich-countdown-settings__unit">时</span>
                            <input v-model="countdownDurationMinutes" class="norio-office-rich-countdown-settings__number" type="number" min="0" max="59" :disabled="countdownInsertMode !== 'duration'" />
                            <span class="norio-office-rich-countdown-settings__unit">分</span>
                            <input v-model="countdownDurationSeconds" class="norio-office-rich-countdown-settings__number" type="number" min="0" max="59" :disabled="countdownInsertMode !== 'duration'" />
                            <span class="norio-office-rich-countdown-settings__unit">秒</span>
                          </div>
                        </label>

                        <div class="norio-office-rich-countdown-settings__actions">
                          <button type="button" class="norio-office-rich-countdown-settings__button norio-office-rich-countdown-settings__button--secondary" @click="isCountdownBlockEditOpen = false">
                            取消
                          </button>
                          <button type="button" class="norio-office-rich-countdown-settings__button norio-office-rich-countdown-settings__button--primary" @click="updateSelectedCountdownBlock">
                            确定
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <span class="norio-office-rich-countdown-bubble-menu__divider" />

                  <button
                    type="button"
                    class="norio-office-rich-countdown-bubble-menu__button norio-office-rich-countdown-bubble-menu__button--danger"
                    title="删除"
                    aria-label="删除"
                    @mousedown.prevent
                    @click="deleteSelectedCountdownBlock"
                  >
                    <OfficeIcon name="delete" :size="14" color="#dc2626" background-color="transparent" />
                  </button>
                </div>
              </BubbleMenu>

              <div
                v-if="shouldShowWatermark && normalizedWatermark"
                class="norio-office-rich-editor__watermark"
                :style="watermarkStyle"
                aria-hidden="true"
              >
                <span
                  v-for="tile in watermarkTiles"
                  :key="tile"
                  class="norio-office-rich-editor__watermark-text"
                >
                  {{ normalizedWatermark.text }}
                </span>
              </div>

              <EditorContent v-if="editor" :editor="editor" class="norio-office-rich-editor__content" />

              <div
                v-if="isMentionEnabled && isMentionPanelOpen"
                ref="mentionPanelRef"
                class="norio-office-rich-mention-panel"
                :style="mentionPanelStyle"
                @mousedown.prevent
              >
                <div class="norio-office-rich-mention-panel__tabs">
                  <button
                    v-for="tab in mentionTabs"
                    :key="String(tab.key)"
                    type="button"
                    class="norio-office-rich-mention-panel__tab"
                    :class="{ 'norio-office-rich-mention-panel__tab--active': mentionActiveType === tab.key }"
                    @click="setMentionTab(tab.key)"
                  >
                    {{ tab.label }}
                  </button>
                </div>

                <ScrollArea class="norio-office-rich-mention-panel__scroll">
                  <div v-if="isMentionLoading" class="norio-office-rich-mention-panel__empty">加载中...</div>
                  <div v-else-if="!visibleMentionItems.length" class="norio-office-rich-mention-panel__empty">暂无可提及内容</div>
                  <template v-else>
                    <button
                      v-for="(item, index) in visibleMentionItems"
                      :key="`${item.type}-${item.id}`"
                      type="button"
                      class="norio-office-rich-mention-panel__item"
                      :class="{ 'norio-office-rich-mention-panel__item--active': index === selectedMentionIndex }"
                      @click="selectMentionItem(item, index)"
                      @dblclick="insertMentionItem(item)"
                    >
                      <span
                        class="norio-office-rich-mention-panel__avatar"
                        :data-type="item.type"
                        :style="getMentionFallbackStyle(item)"
                      >
                        <img v-if="item.type === 1 && item.avatar" :src="item.avatar" alt="" />
                        <img v-else-if="item.type === 2 && item.icon" :src="item.icon" alt="" />
                        <span v-else>{{ getMentionFallbackText(item) }}</span>
                      </span>
                      <span class="norio-office-rich-mention-panel__content">
                        <span class="norio-office-rich-mention-panel__title-row">
                          <span class="norio-office-rich-mention-panel__name">{{ item.name }}</span>
                          <span v-if="item.tag" class="norio-office-rich-mention-panel__tag">{{ item.tag }}</span>
                        </span>
                        <span v-if="item.type === 2 && item.updatedAt" class="norio-office-rich-mention-panel__meta">
                          最近修改：{{ item.updatedAt }}
                        </span>
                      </span>
                    </button>
                  </template>
                </ScrollArea>

                <div class="norio-office-rich-mention-panel__footer">
                  <button
                    type="button"
                    class="norio-office-rich-mention-panel__submit"
                    :disabled="!selectedMentionItem"
                    @click="submitSelectedMention"
                  >
                    提及
                  </button>
                </div>
              </div>

              <div
                v-if="marqueeSelectionRect || hasMarqueeSelection"
                class="norio-office-rich-marquee-selection-layer"
                :data-active="isMarqueeSelecting"
                aria-hidden="true"
              >
                <div
                  v-for="block in selectedMarqueeBlocks"
                  :key="`marquee-block-${block.pos}`"
                  class="norio-office-rich-marquee-selection-layer__block"
                  :style="{
                    left: `${block.rect.left}px`,
                    top: `${block.rect.top}px`,
                    width: `${block.rect.width}px`,
                    height: `${block.rect.height}px`,
                  }"
                />

                <div
                  v-if="marqueeSelectionRect && isMarqueeSelecting"
                  class="norio-office-rich-marquee-selection-layer__box"
                  :style="{
                    left: `${marqueeSelectionRect.left}px`,
                    top: `${marqueeSelectionRect.top}px`,
                    width: `${marqueeSelectionRect.width}px`,
                    height: `${marqueeSelectionRect.height}px`,
                  }"
                />
              </div>

              <div
                v-if="visibleBlockSideControl && editorEditable && !isPresentationMode"
                class="norio-office-rich-block-side-control"
                :class="{ 'norio-office-rich-block-side-control--empty': visibleBlockSideControl.isEmpty }"
                :style="blockSideControlStyle"
                @mouseenter="keepBlockSideControl(visibleBlockSideControl)"
                @mouseleave="handlePageBlockMouseLeave"
              >
                <button
                  v-if="visibleBlockSideControl.isEmpty"
                  type="button"
                  class="norio-office-rich-block-side-control__button norio-office-rich-block-side-control__button--empty"
                  title="插入"
                  @mousedown.prevent
                  @mouseenter="openBlockSideMenu(visibleBlockSideControl, 'insert')"
                  @click="openBlockSideMenu(visibleBlockSideControl, 'insert')"
                >
                  <OfficeIcon name="add" :size="12" color="currentColor" background-color="transparent" />
                </button>
                <template v-else>
                  <button
                    type="button"
                    class="norio-office-rich-block-side-control__button"
                    :title="visibleBlockSideControl.label"
                    @mousedown.prevent
                    @mouseenter="openBlockSideMenu(visibleBlockSideControl, 'actions')"
                    @click="openBlockSideMenu(visibleBlockSideControl, 'actions')"
                  >
                    <OfficeIcon
                      v-if="visibleBlockSideControl.iconName"
                      :name="visibleBlockSideControl.iconName"
                      :size="14"
                      color="#4b5563"
                      background-color="transparent"
                    />
                    <span v-else>{{ visibleBlockSideControl.textIcon }}</span>
                  </button>
                  <button
                    type="button"
                    class="norio-office-rich-block-side-control__button norio-office-rich-block-side-control__button--drag"
                    title="拖动"
                    @mousedown="startBlockSideDrag($event, visibleBlockSideControl)"
                  >
                    <OfficeIcon name="drag" :size="12" color="#9aa4b2" background-color="transparent" />
                  </button>
                </template>
              </div>

              <div
                v-if="visibleBlockSideControl && blockSideMenuMode"
                v-show="!(blockSideAppearanceStacked && blockSideStackedMenuModes.includes(blockSideSubmenuMode || ''))"
                ref="blockSideMenuRef"
                class="norio-office-rich-block-side-menu"
                :style="blockSideMenuStyle"
                @mouseenter="keepBlockSideControl(visibleBlockSideControl)"
                @mouseleave="handlePageBlockMouseLeave"
                @mousedown.stop
              >
                <template v-if="blockSideMenuMode === 'insert'">
                  <div class="norio-office-rich-block-side-menu__section">
                    <div class="norio-office-rich-block-side-menu__title">基础</div>
                    <div class="norio-office-rich-block-side-menu__quick">
                      <button
                        v-for="item in insertQuickItems"
                        :key="`block-quick-${item.key}`"
                        type="button"
                        class="norio-office-rich-block-side-menu__quick-button"
                        @click="insertFromBlockSideMenu(item.action)"
                      >
                        <OfficeIcon
                          v-if="item.type === 'icon'"
                          :name="item.iconName || ''"
                          :size="17"
                          color="#1f2937"
                          background-color="transparent"
                        />
                        <span v-else>{{ item.label }}</span>
                      </button>
                    </div>
                  </div>

                  <div class="norio-office-rich-block-side-menu__section">
                    <div class="norio-office-rich-block-side-menu__title">常用</div>
                    <button
                      v-for="item in blockSideGeneralInsertActions"
                      :key="`block-insert-${item.key}`"
                      type="button"
                      class="norio-office-rich-block-side-menu__item"
                      @click="insertFromBlockSideMenu(item.action)"
                    >
                      <OfficeColorIcon v-if="item.colorIconName" :name="item.colorIconName" />
                      <OfficeIcon v-else name="smile" :size="17" color="#64748b" background-color="transparent" />
                      <span>{{ getInsertItemLabel(item.key as RichTextEditorInsertMenuItemKey) }}</span>
                    </button>
                  </div>
                </template>

                <template v-else-if="blockSideMenuMode === 'actions'">
                  <div
                    v-if="visibleBlockTransformActions.length"
                    class="norio-office-rich-block-side-menu__section norio-office-rich-block-side-menu__section--grid"
                  >
                    <button
                      v-for="item in visibleBlockTransformActions"
                      :key="`block-transform-${item.key}`"
                      type="button"
                      class="norio-office-rich-block-side-menu__quick-button"
                      :class="{ 'norio-office-rich-block-side-menu__quick-button--active': currentBlockTransformAction === item.action }"
                      :title="item.label"
                      :aria-label="item.label"
                      :aria-pressed="currentBlockTransformAction === item.action"
                      @mousedown.prevent
                      @click="applyBlockTransform(item.action)"
                    >
                      <OfficeIcon
                        v-if="item.type === 'icon'"
                        :name="item.iconName || ''"
                        :size="18"
                        color="currentColor"
                        background-color="transparent"
                      />
                      <span v-else>{{ item.label }}</span>
                    </button>
                  </div>

                  <button
                    v-if="visibleBlockPropertyActions.length"
                    ref="blockSidePropertiesTriggerRef"
                    type="button"
                    class="norio-office-rich-block-side-menu__item"
                    :class="{ 'norio-office-rich-block-side-menu__item--active': blockSideSubmenuMode === 'properties' }"
                    @mouseenter="blockSideSubmenuMode = 'properties'"
                    @click="blockSideSubmenuMode = 'properties'"
                    @mousedown.prevent
                  >
                    <OfficeIcon name="zuoduiqi" :size="18" color="#4b5563" background-color="transparent" />
                    <span>缩进和对齐</span>
                    <OfficeIcon name="youjiantou" :size="14" color="#9aa4b2" background-color="transparent" />
                  </button>
                  <button
                    v-if="canShowBlockSideColor(visibleBlockSideControl)"
                    ref="blockSideColorTriggerRef"
                    type="button"
                    class="norio-office-rich-block-side-menu__item"
                    :class="{ 'norio-office-rich-block-side-menu__item--active': blockSideSubmenuMode === 'color' }"
                    :aria-expanded="blockSideSubmenuMode === 'color'"
                    @mousedown.prevent
                    @mouseenter="blockSideSubmenuMode = 'color'"
                    @click="blockSideSubmenuMode = 'color'"
                  >
                    <OfficeIcon name="yanse" :size="18" color="#4b5563" background-color="transparent" />
                    <span>颜色</span>
                    <OfficeIcon name="youjiantou" :size="14" color="#9aa4b2" background-color="transparent" />
                  </button>
                  <button
                    type="button"
                    class="norio-office-rich-block-side-menu__item"
                    :class="{ 'norio-office-rich-block-side-menu__item--strong': visibleBlockPropertyActions.length > 0 || canShowBlockSideColor(visibleBlockSideControl) }"
                    @click="cutBlockSideControl(visibleBlockSideControl)"
                  >
                    <OfficeIcon name="cut" :size="18" color="#4b5563" background-color="transparent" />
                    <span>剪切</span>
                  </button>
                  <button type="button" class="norio-office-rich-block-side-menu__item" @click="copyBlockSideControl(visibleBlockSideControl)">
                    <OfficeIcon name="xiangxiacharujilu-copy" :size="18" color="#4b5563" background-color="transparent" />
                    <span>复制</span>
                  </button>
                  <button
                    type="button"
                    class="norio-office-rich-block-side-menu__item"
                    :disabled="!editorEditable"
                    @click="pasteBlockBelow(visibleBlockSideControl)"
                  >
                    <OfficeIcon name="xiangxiacharujilu-copy" :size="18" color="#4b5563" background-color="transparent" />
                    <span>粘贴</span>
                  </button>
                  <button
                    v-if="visibleBlockSideControl.node.type.name === 'table'"
                    ref="blockSideTableThemeTriggerRef"
                    type="button"
                    class="norio-office-rich-block-side-menu__item norio-office-rich-block-side-menu__item--strong"
                    :class="{ 'norio-office-rich-block-side-menu__item--active': blockSideSubmenuMode === 'table-theme' }"
                    :aria-expanded="blockSideSubmenuMode === 'table-theme'"
                    @mousedown.prevent
                    @mouseenter="openBlockSideTableTheme"
                    @click="openBlockSideTableTheme"
                  >
                    <OfficeIcon name="zhuti" :size="18" color="#4b5563" background-color="transparent" />
                    <span>主题色</span>
                    <OfficeIcon name="youjiantou" :size="14" color="#9aa4b2" background-color="transparent" />
                  </button>
                  <template v-if="['highlightBlock', 'blockquote'].includes(visibleBlockSideControl.node.type.name)">
                    <button
                      ref="blockSideSurfaceBorderTriggerRef"
                      type="button"
                      class="norio-office-rich-block-side-menu__item norio-office-rich-block-side-menu__item--strong"
                      :class="{ 'norio-office-rich-block-side-menu__item--active': ['highlight-border', 'quote-border'].includes(blockSideSubmenuMode || '') }"
                      :aria-expanded="['highlight-border', 'quote-border'].includes(blockSideSubmenuMode || '')"
                      @mousedown.prevent
                      @mouseenter="blockSideSubmenuMode = visibleBlockSideControl.node.type.name === 'blockquote' ? 'quote-border' : 'highlight-border'"
                      @click="blockSideSubmenuMode = visibleBlockSideControl.node.type.name === 'blockquote' ? 'quote-border' : 'highlight-border'"
                    >
                      <OfficeIcon name="yanse" :size="18" color="#4b5563" background-color="transparent" />
                      <span>边框颜色</span>
                      <OfficeIcon name="youjiantou" :size="14" color="#9aa4b2" background-color="transparent" />
                    </button>
                    <button
                      ref="blockSideSurfaceFillTriggerRef"
                      type="button"
                      class="norio-office-rich-block-side-menu__item"
                      :class="{ 'norio-office-rich-block-side-menu__item--active': ['highlight-fill', 'quote-background'].includes(blockSideSubmenuMode || '') }"
                      :aria-expanded="['highlight-fill', 'quote-background'].includes(blockSideSubmenuMode || '')"
                      @mousedown.prevent
                      @mouseenter="blockSideSubmenuMode = visibleBlockSideControl.node.type.name === 'blockquote' ? 'quote-background' : 'highlight-fill'"
                      @click="blockSideSubmenuMode = visibleBlockSideControl.node.type.name === 'blockquote' ? 'quote-background' : 'highlight-fill'"
                    >
                      <OfficeIcon name="beijingse" :size="18" color="#4b5563" background-color="transparent" />
                      <span>{{ visibleBlockSideControl.node.type.name === 'blockquote' ? '背景颜色' : '填充颜色' }}</span>
                      <OfficeIcon name="youjiantou" :size="14" color="#9aa4b2" background-color="transparent" />
                    </button>
                    <button
                      v-if="visibleBlockSideControl.node.type.name === 'highlightBlock'"
                      ref="blockSideHighlightSettingsTriggerRef"
                      type="button"
                      class="norio-office-rich-block-side-menu__item"
                      :class="{ 'norio-office-rich-block-side-menu__item--active': blockSideSubmenuMode === 'highlight-settings' }"
                      :aria-expanded="blockSideSubmenuMode === 'highlight-settings'"
                      @mousedown.prevent
                      @mouseenter="blockSideSubmenuMode = 'highlight-settings'"
                      @click="blockSideSubmenuMode = 'highlight-settings'"
                    >
                      <OfficeIcon name="shezhi" :size="18" color="#4b5563" background-color="transparent" />
                      <span>设置</span>
                      <OfficeIcon name="youjiantou" :size="14" color="#9aa4b2" background-color="transparent" />
                    </button>
                  </template>
                  <template v-if="visibleBlockSideControl.node.type.name === 'horizontalRule'">
                    <button
                      ref="blockSideDividerStyleTriggerRef"
                      type="button"
                      class="norio-office-rich-block-side-menu__item norio-office-rich-block-side-menu__item--strong"
                      :class="{ 'norio-office-rich-block-side-menu__item--active': blockSideSubmenuMode === 'divider-style' }"
                      :aria-expanded="blockSideSubmenuMode === 'divider-style'"
                      @mousedown.prevent
                      @mouseenter="blockSideSubmenuMode = 'divider-style'"
                      @click="blockSideSubmenuMode = 'divider-style'"
                    >
                      <OfficeColorIcon name="fengexian" :size="18" background-color="transparent" />
                      <span>样式</span>
                      <OfficeIcon name="youjiantou" :size="14" color="#9aa4b2" background-color="transparent" />
                    </button>
                    <button
                      ref="blockSideDividerColorTriggerRef"
                      type="button"
                      class="norio-office-rich-block-side-menu__item"
                      :class="{ 'norio-office-rich-block-side-menu__item--active': blockSideSubmenuMode === 'divider-color' }"
                      :aria-expanded="blockSideSubmenuMode === 'divider-color'"
                      @mousedown.prevent
                      @mouseenter="blockSideSubmenuMode = 'divider-color'"
                      @click="blockSideSubmenuMode = 'divider-color'"
                    >
                      <OfficeIcon name="yanse" :size="18" color="#4b5563" background-color="transparent" />
                      <span>颜色</span>
                      <OfficeIcon name="youjiantou" :size="14" color="#9aa4b2" background-color="transparent" />
                    </button>
                  </template>
                  <button
                    type="button"
                    class="norio-office-rich-block-side-menu__item norio-office-rich-block-side-menu__item--strong"
                    @click="deleteBlockSideControl(visibleBlockSideControl)"
                  >
                    <OfficeIcon name="delete" :size="18" color="#4b5563" background-color="transparent" />
                    <span>删除</span>
                  </button>
                  <button
                    type="button"
                    class="norio-office-rich-block-side-menu__item norio-office-rich-block-side-menu__item--strong"
                    :class="{ 'norio-office-rich-block-side-menu__item--active': blockSideSubmenuMode === 'add-above' }"
                    :aria-expanded="blockSideSubmenuMode === 'add-above'"
                    aria-haspopup="true"
                    @mouseenter="!blockSideAppearanceStacked && (blockSideSubmenuMode = 'add-above')"
                    @click="blockSideSubmenuMode = 'add-above'"
                  >
                    <OfficeIcon name="shangfangtianjia" :size="18" color="#4b5563" background-color="transparent" />
                    <span>在上方添加</span>
                    <OfficeIcon name="youjiantou" :size="14" color="#9aa4b2" background-color="transparent" />
                  </button>
                  <button
                    type="button"
                    class="norio-office-rich-block-side-menu__item"
                    :class="{ 'norio-office-rich-block-side-menu__item--active': blockSideSubmenuMode === 'add-below' }"
                    :aria-expanded="blockSideSubmenuMode === 'add-below'"
                    aria-haspopup="true"
                    @mouseenter="!blockSideAppearanceStacked && (blockSideSubmenuMode = 'add-below')"
                    @click="blockSideSubmenuMode = 'add-below'"
                  >
                    <OfficeIcon name="xiafangtianjia" :size="18" color="#4b5563" background-color="transparent" />
                    <span>在下方添加</span>
                    <OfficeIcon name="youjiantou" :size="14" color="#9aa4b2" background-color="transparent" />
                  </button>
                </template>

              </div>

              <TableThemePanel
                v-if="visibleBlockSideControl && shouldShowBlockSideSubmenu && blockSideSubmenuMode === 'table-theme'"
                class="norio-office-rich-block-side-table-theme"
                :theme="blockSideTableTheme"
                :recent-colors="recentHighlightColors"
                :style="blockSideTableThemeStyle"
                @change="applyBlockSideTableTheme"
                @color-used="rememberHighlightColor"
                @clear="applyBlockSideTableTheme(null)"
                @close="closeBlockSideTableTheme"
                @resize="tableThemeMenuHeight = $event"
                @reposition="syncTableThemeMenuPosition"
                @mouseenter="keepBlockSideControl(visibleBlockSideControl)"
                @mouseleave="handlePageBlockMouseLeave"
                @mousedown.stop
              />

              <div
                v-if="visibleBlockSideControl && shouldShowBlockSideSubmenu && blockSideSubmenuMode !== 'table-theme'"
                v-show="!(blockSideAppearanceStacked && blockSideCustomColorKind)"
                class="norio-office-rich-block-side-submenu"
                :class="{
                  'norio-office-rich-block-side-submenu--properties': blockSideSubmenuMode === 'properties',
                  'norio-office-rich-block-side-submenu--color': blockSideSubmenuMode === 'divider-color',
                }"
                :style="blockSideSubmenuStyle"
                @mouseenter="keepBlockSideControl(visibleBlockSideControl)"
                @mouseleave="handlePageBlockMouseLeave"
                @mousedown.stop
              >
                <button
                  v-if="blockSideAppearanceStacked && blockSideStackedMenuModes.includes(blockSideSubmenuMode || '')"
                  type="button" class="norio-office-rich-block-side-menu__back" aria-label="返回句柄菜单"
                  @mousedown.prevent @click="blockSideSubmenuMode = null"
                >
                  <OfficeIcon name="zuojiantou" :size="14" color="currentColor" background-color="transparent" />
                  <span>返回</span>
                </button>
                <template v-if="blockSideSubmenuMode === 'properties'">
                  <button
                    v-for="item in visibleBlockPropertyActions"
                    :key="`block-property-${item.key}`"
                    type="button"
                    class="norio-office-rich-block-side-menu__item"
                    :class="{ 'norio-office-rich-block-side-menu__item--strong': item.action === 'indent-more', 'norio-office-rich-block-side-menu__item--active': item.action === `align-${currentBlockSideAlignment}` }"
                    :disabled="item.action === 'indent-less' ? !canDecreaseBlockSideIndent : item.action === 'indent-more' && !canIncreaseBlockSideIndent"
                    :aria-pressed="item.action.startsWith('align-') ? item.action === `align-${currentBlockSideAlignment}` : undefined"
                    @mousedown.prevent
                    @click="applyBlockProperty(item.action)"
                  >
                    <OfficeIcon :name="item.iconName" :size="18" color="#4b5563" background-color="transparent" />
                    <span>{{ item.label }}</span>
                    <span v-if="item.action === `align-${currentBlockSideAlignment}`" aria-hidden="true">✓</span>
                  </button>
                </template>

                <template v-else-if="blockSideSurfaceColorConfig">
                  <BlockColorPanel
                    :kind="blockSideSurfaceColorConfig.kind"
                    :label="blockSideSurfaceColorConfig.label"
                    :preset-colors="blockSideSurfaceColorConfig.presetColors"
                    :color="blockSideSurfaceColorConfig.color"
                    :custom-kind="blockSideCustomColorKind"
                    :hover-enabled="!blockSideAppearanceStacked"
                    @change="(_kind, color) => applyBlockSideSurfaceColor(color ?? 'transparent')"
                    @custom="openBlockSideCustomColor"
                    @reset="applyBlockSideSurfaceColor(blockSideSurfaceColorConfig.defaultColor)"
                  />
                </template>

                <template v-else-if="blockSideSubmenuMode === 'highlight-settings'">
                  <button
                    type="button"
                    class="norio-office-rich-code-block__setting-row"
                    role="switch"
                    :aria-checked="currentBlockSideHighlightAttrs.emojiEnabled"
                    @mousedown.prevent
                    @click="toggleBlockSideHighlightEmoji"
                  >
                    <span>启用表情</span>
                    <span class="norio-office-rich-code-block__switch" :data-checked="currentBlockSideHighlightAttrs.emojiEnabled ? 'true' : 'false'" aria-hidden="true">
                      <span class="norio-office-rich-code-block__switch-thumb" />
                    </span>
                  </button>
                </template>

                <template v-else-if="blockSideSubmenuMode === 'divider-style'">
                  <button
                    v-for="item in dividerStyles"
                    :key="item.value"
                    type="button"
                    class="norio-office-rich-block-side-menu__item norio-office-rich-divider-style-option"
                    :aria-label="item.label"
                    :title="item.label"
                    :class="{ 'norio-office-rich-block-side-menu__item--active': currentBlockSideDividerStyle === item.value }"
                    :aria-pressed="currentBlockSideDividerStyle === item.value"
                    @mousedown.prevent
                    @click="applyBlockSideDividerAttrs({ lineStyle: item.value })"
                  >
                    <span class="norio-office-rich-divider-style-option__preview" :style="{ borderTopStyle: item.value }" aria-hidden="true" />
                    <span aria-hidden="true">{{ currentBlockSideDividerStyle === item.value ? '✓' : '' }}</span>
                  </button>
                </template>

                <ColorPalettePanel
                  v-else-if="blockSideSubmenuMode === 'divider-color'"
                  :color="currentBlockSideDividerColor"
                  :default-color="dividerDefaultColor"
                  :recent-colors="recentColors"
                  @change="applyBlockSideDividerColor"
                />

                <BlockColorPanel
                  v-else-if="blockSideSubmenuMode === 'color'"
                  :text-color="currentBlockSideTextColors.text"
                  :background-color="currentBlockSideTextColors.background"
                  :custom-kind="blockSideCustomColorKind"
                  :hover-enabled="!blockSideAppearanceStacked"
                  @change="applyBlockSideTextColor"
                  @custom="openBlockSideCustomColor"
                  @reset="resetBlockSideTextColors"
                />

                <template v-else-if="blockSideSubmenuMode === 'add-above' || blockSideSubmenuMode === 'add-below'">
                  <div class="norio-office-rich-block-side-menu__section">
                    <div class="norio-office-rich-block-side-menu__title">基础</div>
                    <div class="norio-office-rich-block-side-menu__quick">
                      <button
                        v-for="item in insertQuickItems"
                        :key="`block-add-quick-${item.key}`"
                        type="button"
                        class="norio-office-rich-block-side-menu__quick-button"
                        @click="insertFromBlockSideMenu(item.action)"
                      >
                        <OfficeIcon
                          v-if="item.type === 'icon'"
                          :name="item.iconName || ''"
                          :size="17"
                          color="#1f2937"
                          background-color="transparent"
                        />
                        <span v-else>{{ item.label }}</span>
                      </button>
                    </div>
                  </div>
                  <div class="norio-office-rich-block-side-menu__section">
                    <div class="norio-office-rich-block-side-menu__title">常用</div>
                    <button
                      v-for="item in blockSideGeneralInsertActions"
                      :key="`block-add-insert-${item.key}`"
                      type="button"
                      class="norio-office-rich-block-side-menu__item"
                      @click="insertFromBlockSideMenu(item.action)"
                    >
                      <OfficeColorIcon v-if="item.colorIconName" :name="item.colorIconName" />
                      <OfficeIcon v-else name="smile" :size="17" color="#64748b" background-color="transparent" />
                      <span>{{ getInsertItemLabel(item.key as RichTextEditorInsertMenuItemKey) }}</span>
                    </button>
                  </div>
                </template>
              </div>

              <div
                v-if="visibleBlockSideControl && shouldShowBlockSideSubmenu && blockSideCustomColorKind"
                class="norio-office-rich-block-side-submenu norio-office-rich-block-side-submenu--color norio-office-rich-block-side-submenu--tertiary"
                :style="blockSideCustomColorStyle"
                role="dialog"
                :aria-label="blockSideCustomColorConfig.label"
                @mouseenter="keepBlockSideControl(visibleBlockSideControl)"
                @mouseleave="handlePageBlockMouseLeave"
                @mousedown.stop
              >
                <button
                  v-if="blockSideAppearanceStacked" type="button" class="norio-office-rich-block-side-menu__back norio-office-rich-block-colors__palette-back" aria-label="返回颜色菜单"
                  @mousedown.prevent @click="blockSideCustomColorKind = null"
                >
                  <OfficeIcon name="zuojiantou" :size="14" color="currentColor" background-color="transparent" />
                  <span>返回</span>
                </button>
                <ColorPalettePanel
                  :color="blockSideCustomColorConfig.color || blockSideCustomColorConfig.defaultColor"
                  :default-color="blockSideCustomColorConfig.defaultColor"
                  :recent-colors="blockSideCustomColorConfig.recentColors"
                  @change="applyBlockSideCustomColor"
                />
                <div class="norio-office-rich-color-menu__section">
                  <button type="button" class="norio-office-rich-color-menu__current" @mousedown.prevent @click="applyBlockSideCustomColor(null)">清除颜色</button>
                </div>
              </div>

              <div
                v-if="dragInsertIndicator"
                class="norio-office-rich-drag-insert-indicator"
                :style="{
                  left: `${dragInsertIndicator.left}px`,
                  top: `${dragInsertIndicator.top}px`,
                  width: `${dragInsertIndicator.width}px`,
                }"
                aria-hidden="true"
              >
                <span class="norio-office-rich-drag-insert-indicator__line" />
              </div>

              <div
                v-if="editorEditable && activeTableMetrics"
                class="norio-office-rich-table-column-track"
                :style="{
                  left: `${activeTableMetrics.left}px`,
                  top: `${activeTableMetrics.top - 14}px`,
                  width: `${activeTableMetrics.width}px`,
                }"
              >
                <span class="norio-office-rich-table-column-track__line" />
                <button
                  v-for="handle in tableColumnHandles"
                  :key="`table-column-segment-${handle.index}`"
                  type="button"
                  class="norio-office-rich-table-column-track__segment"
                  :class="{ 'norio-office-rich-table-column-track__segment--active': selectedTableColumnIndex === handle.index }"
                  :style="{
                    left: `${handle.left - activeTableMetrics.left}px`,
                    width: `${handle.width}px`,
                  }"
                  @mousedown.prevent
                  @click="selectTableColumn(handle.index)"
                />
                <button
                  v-for="point in tableColumnAddPoints"
                  :key="point.key"
                  type="button"
                  class="norio-office-rich-table-track__dot norio-office-rich-table-track__dot--column"
                  title="插入列"
                  aria-label="插入列"
                  :style="{ left: `${point.left - activeTableMetrics.left}px` }"
                  @mousedown.prevent
                  @click="insertTableColumnAt(point.insertIndex)"
                />
              </div>

              <div
                v-if="editorEditable && activeTableMetrics"
                class="norio-office-rich-table-row-track"
                :style="{
                  left: `${activeTableMetrics.left - 14}px`,
                  top: `${activeTableMetrics.top}px`,
                  height: `${activeTableMetrics.height}px`,
                }"
              >
                <span class="norio-office-rich-table-row-track__line" />
                <button
                  v-for="handle in tableRowHandles"
                  :key="`table-row-segment-${handle.index}`"
                  type="button"
                  class="norio-office-rich-table-row-track__segment"
                  :class="{ 'norio-office-rich-table-row-track__segment--active': selectedTableRowIndex === handle.index }"
                  :style="{
                    top: `${handle.top - activeTableMetrics.top}px`,
                    height: `${handle.height}px`,
                  }"
                  @mousedown.prevent
                  @click="selectTableRow(handle.index)"
                />
                <button
                  v-for="point in tableRowAddPoints"
                  :key="point.key"
                  type="button"
                  class="norio-office-rich-table-track__dot norio-office-rich-table-track__dot--row"
                  title="插入行"
                  aria-label="插入行"
                  :style="{ top: `${point.top - activeTableMetrics.top}px` }"
                  @mousedown.prevent
                  @click="insertTableRowAt(point.insertIndex)"
                />
              </div>

              <button
                v-if="false && activeTableMetrics"
                type="button"
                class="norio-office-rich-table-add-row"
                :style="tableAddRowStyle"
                @mousedown.prevent
                @click="addTableRow"
              >
                + 添加行
              </button>

            </div>
          </div>
        </ScrollArea>
      </section>

      <aside
        v-if="shouldShowCommentsPanel"
        ref="commentPanelRef"
        class="norio-office-rich-comment-panel"
        aria-label="评论"
      >
        <div class="norio-office-rich-comment-panel__header">
          <strong>{{ commentPanelTitle }}</strong>
        </div>

        <ScrollArea class-name="norio-office-rich-comment-panel__scroll">
          <div v-if="!commentPanelThreads.length" class="norio-office-rich-comment-panel__empty">
            暂无评论
          </div>

          <div v-else class="norio-office-rich-comment-panel__list">
            <article
              v-for="thread in commentPanelThreads"
              :key="thread.id"
              :ref="(element) => setCommentCardRef(thread.id, element)"
              class="norio-office-rich-comment-card"
              :class="{
                'norio-office-rich-comment-card--active': selectedCommentThread?.id === thread.id,
                'norio-office-rich-comment-card--pending': pendingCommentThread?.id === thread.id,
              }"
              @click="selectCommentThread(thread)"
            >
              <div class="norio-office-rich-comment-card__topline" />
              <div class="norio-office-rich-comment-card__anchor">
                {{ getCommentThreadAnchorText(thread) }}
              </div>

              <div class="norio-office-rich-comment-card__actions">
                <button
                  type="button"
                  title="删除"
                  :disabled="pendingCommentThread?.id === thread.id"
                  @click.stop="deleteComment(thread.id)"
                >
                  <OfficeIcon name="delete" :size="13" color="#dc2626" background-color="transparent" />
                </button>
              </div>

              <div v-if="thread.comments.length" class="norio-office-rich-comment-card__items">
                <div v-for="item in getRootCommentItems(thread)" :key="item.id" class="norio-office-rich-comment-item">
                  <div class="norio-office-rich-comment-item__avatar" :style="getCommentAvatarStyle(item.author)">
                    <img v-if="item.author.avatar" :src="item.author.avatar" alt="" />
                    <span v-else>{{ getCommentAvatarText(item.author) }}</span>
                  </div>

                  <div class="norio-office-rich-comment-item__body">
                    <div class="norio-office-rich-comment-item__meta">
                      <strong>{{ item.author.name }}</strong>
                      <span>{{ getCommentTimeLabel(item.updatedAt || item.createdAt) }}</span>
                    </div>

                    <template v-if="isEditingComment(thread.id, item)">
                      <textarea
                        class="norio-office-rich-comment-composer__input"
                        :value="editingCommentDraft"
                        rows="2"
                        @input="handleCommentEditInput"
                        @keydown="handleCommentEditKeyDown(thread.id, item, $event)"
                      />
                      <div class="norio-office-rich-comment-composer__actions">
                        <button type="button" @click.stop="cancelEditComment">取消</button>
                        <button type="button" class="norio-office-rich-comment-composer__submit" @click.stop="submitEditComment(thread.id, item)">
                          保存
                        </button>
                      </div>
                    </template>

                    <template v-else>
                      <div class="norio-office-rich-comment-item__content">{{ item.content }}</div>
                      <div v-if="item.images?.length" class="norio-office-rich-comment-images">
                        <button
                          v-for="image in item.images"
                          :key="image.url"
                          type="button"
                          class="norio-office-rich-comment-images__item"
                          @click.stop="openCommentImagePreview(image)"
                        >
                          <img :src="image.url" :alt="image.alt || image.name || ''" />
                        </button>
                      </div>
                      <div class="norio-office-rich-comment-item__actions">
                        <button type="button" @click.stop="startReplyComment(thread, item)">回复</button>
                        <button v-if="item.author.id === activeCommentUser?.id" type="button" @click.stop="startEditComment(thread.id, item)">编辑</button>
                        <button v-if="item.author.id === activeCommentUser?.id" type="button" @click.stop="deleteComment(thread.id, item)">删除</button>
                      </div>
                    </template>

                    <div v-if="getCommentReplies(thread, item).length" class="norio-office-rich-comment-replies">
                      <div
                        v-for="reply in getCommentReplies(thread, item)"
                        :key="reply.id"
                        class="norio-office-rich-comment-item norio-office-rich-comment-item--reply"
                      >
                        <div class="norio-office-rich-comment-item__avatar" :style="getCommentAvatarStyle(reply.author)">
                          <img v-if="reply.author.avatar" :src="reply.author.avatar" alt="" />
                          <span v-else>{{ getCommentAvatarText(reply.author) }}</span>
                        </div>

                        <div class="norio-office-rich-comment-item__body">
                          <div class="norio-office-rich-comment-item__meta">
                            <strong>{{ reply.author.name }}</strong>
                            <span>{{ getCommentTimeLabel(reply.updatedAt || reply.createdAt) }}</span>
                          </div>

                          <template v-if="isEditingComment(thread.id, reply)">
                            <textarea
                              class="norio-office-rich-comment-composer__input"
                              :value="editingCommentDraft"
                              rows="2"
                              @input="handleCommentEditInput"
                              @keydown="handleCommentEditKeyDown(thread.id, reply, $event)"
                            />
                            <div class="norio-office-rich-comment-composer__actions">
                              <button type="button" @click.stop="cancelEditComment">取消</button>
                              <button type="button" class="norio-office-rich-comment-composer__submit" @click.stop="submitEditComment(thread.id, reply)">
                                保存
                              </button>
                            </div>
                          </template>

                          <template v-else>
                            <div class="norio-office-rich-comment-item__content">{{ reply.content }}</div>
                            <div v-if="reply.images?.length" class="norio-office-rich-comment-images">
                              <button
                                v-for="image in reply.images"
                                :key="image.url"
                                type="button"
                                class="norio-office-rich-comment-images__item"
                                @click.stop="openCommentImagePreview(image)"
                              >
                                <img :src="image.url" :alt="image.alt || image.name || ''" />
                              </button>
                            </div>
                            <div class="norio-office-rich-comment-item__actions">
                              <button type="button" @click.stop="startReplyComment(thread, reply)">回复</button>
                              <button v-if="reply.author.id === activeCommentUser?.id" type="button" @click.stop="startEditComment(thread.id, reply)">编辑</button>
                              <button v-if="reply.author.id === activeCommentUser?.id" type="button" @click.stop="deleteComment(thread.id, reply)">删除</button>
                            </div>
                          </template>
                        </div>
                      </div>
                    </div>

                    <div
                      v-if="isReplyTargetInComment(thread, item)"
                      class="norio-office-rich-comment-composer norio-office-rich-comment-composer--inline"
                      @click.stop
                    >
                      <div v-if="getCommentDraftImages(thread.id, getReplyTargetId(thread.id) ?? undefined).length" class="norio-office-rich-comment-draft-images">
                        <span
                          v-for="(image, imageIndex) in getCommentDraftImages(thread.id, getReplyTargetId(thread.id) ?? undefined)"
                          :key="`${image.url}-${imageIndex}`"
                          class="norio-office-rich-comment-draft-images__item"
                        >
                          <img :src="image.url" :alt="image.alt || image.name || ''" />
                          <button type="button" @click="removeCommentDraftImage(thread.id, imageIndex, getReplyTargetId(thread.id) ?? undefined)">x</button>
                        </span>
                      </div>

                      <textarea
                        class="norio-office-rich-comment-composer__input"
                        :placeholder="`回复 ${getReplyTarget(thread)?.author.name ?? ''}`"
                        :value="getCommentDraft(thread.id, getReplyTargetId(thread.id) ?? undefined)"
                        rows="2"
                        @input="handleCommentDraftInput(thread.id, $event, getReplyTargetId(thread.id) ?? undefined)"
                        @keydown="handleCommentDraftKeyDown(thread.id, $event, getReplyTargetId(thread.id) ?? undefined)"
                      />

                      <div class="norio-office-rich-comment-composer__actions">
                        <button type="button" title="上传图片" @click="openCommentImagePicker(thread.id)">
                          <OfficeIcon name="image" :size="14" color="#667085" background-color="transparent" />
                        </button>
                        <span class="norio-office-rich-comment-composer__spacer" />
                        <button type="button" @click="cancelCommentReply(thread.id, getReplyTargetId(thread.id) ?? '')">取消</button>
                        <button
                          type="button"
                          class="norio-office-rich-comment-composer__submit"
                          :disabled="!activeCommentUser || (!getCommentDraft(thread.id, getReplyTargetId(thread.id) ?? undefined).trim() && !getCommentDraftImages(thread.id, getReplyTargetId(thread.id) ?? undefined).length)"
                          @click="submitComment(thread.id, getReplyTargetId(thread.id) ?? undefined)"
                        >
                          回复
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else-if="pendingCommentThread?.id !== thread.id" class="norio-office-rich-comment-card__empty">
                暂无回复
              </div>

              <div v-if="(selectedCommentThread?.id === thread.id || pendingCommentThread?.id === thread.id) && !getReplyTarget(thread)" class="norio-office-rich-comment-composer" @click.stop>
                <div v-if="getCommentDraftImages(thread.id).length" class="norio-office-rich-comment-draft-images">
                  <span
                    v-for="(image, imageIndex) in getCommentDraftImages(thread.id)"
                    :key="`${image.url}-${imageIndex}`"
                    class="norio-office-rich-comment-draft-images__item"
                  >
                    <img :src="image.url" :alt="image.alt || image.name || ''" />
                    <button type="button" @click="removeCommentDraftImage(thread.id, imageIndex)">×</button>
                  </span>
                </div>

                <textarea
                  class="norio-office-rich-comment-composer__input"
                  :placeholder="pendingCommentThread?.id === thread.id ? '输入评论' : '回复'"
                  :value="getCommentDraft(thread.id)"
                  rows="2"
                  @input="handleCommentDraftInput(thread.id, $event)"
                  @keydown="handleCommentDraftKeyDown(thread.id, $event)"
                />

                <div class="norio-office-rich-comment-composer__actions">
                  <button type="button" title="上传图片" @click="openCommentImagePicker(thread.id)">
                    <OfficeIcon name="image" :size="14" color="#667085" background-color="transparent" />
                  </button>
                  <span class="norio-office-rich-comment-composer__spacer" />
                  <button
                    v-if="pendingCommentThread?.id === thread.id"
                    type="button"
                    @click="cancelPendingComment(thread.id)"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    class="norio-office-rich-comment-composer__submit"
                    :disabled="!activeCommentUser || (!getCommentDraft(thread.id).trim() && !getCommentDraftImages(thread.id).length)"
                    @click="submitComment(thread.id)"
                  >
                    {{ pendingCommentThread?.id === thread.id ? '发布' : '回复' }}
                  </button>
                </div>
              </div>
            </article>
          </div>
        </ScrollArea>
      </aside>
    </div>

    <div
      v-if="isCommentMentionEnabled && isCommentMentionPanelOpen"
      ref="commentMentionPanelRef"
      class="norio-office-rich-mention-panel norio-office-rich-comment-mention-panel"
      :style="commentMentionPanelStyle"
      @mousedown.prevent
    >
      <div class="norio-office-rich-mention-panel__tabs">
        <button
          v-for="tab in mentionTabs"
          :key="`comment-${String(tab.key)}`"
          type="button"
          class="norio-office-rich-mention-panel__tab"
          :class="{ 'norio-office-rich-mention-panel__tab--active': commentMentionActiveType === tab.key }"
          @click="setCommentMentionTab(tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>

      <ScrollArea class="norio-office-rich-mention-panel__scroll">
        <div v-if="isCommentMentionLoading" class="norio-office-rich-mention-panel__empty">加载中...</div>
        <div v-else-if="!visibleCommentMentionItems.length" class="norio-office-rich-mention-panel__empty">暂无可提及内容</div>
        <template v-else>
          <button
            v-for="(item, index) in visibleCommentMentionItems"
            :key="`comment-${item.type}-${item.id}`"
            type="button"
            class="norio-office-rich-mention-panel__item"
            :class="{ 'norio-office-rich-mention-panel__item--active': index === selectedCommentMentionIndex }"
            @click="selectCommentMentionItem(item, index)"
            @dblclick="insertCommentMentionItem(item)"
          >
            <span
              class="norio-office-rich-mention-panel__avatar"
              :data-type="item.type"
              :style="getMentionFallbackStyle(item)"
            >
              <img v-if="item.type === 1 && item.avatar" :src="item.avatar" alt="" />
              <img v-else-if="item.type === 2 && item.icon" :src="item.icon" alt="" />
              <span v-else>{{ getMentionFallbackText(item) }}</span>
            </span>
            <span class="norio-office-rich-mention-panel__content">
              <span class="norio-office-rich-mention-panel__title-row">
                <span class="norio-office-rich-mention-panel__name">{{ item.name }}</span>
                <span v-if="item.tag" class="norio-office-rich-mention-panel__tag">{{ item.tag }}</span>
              </span>
              <span v-if="item.type === 2 && item.updatedAt" class="norio-office-rich-mention-panel__meta">
                最近修改：{{ item.updatedAt }}
              </span>
            </span>
          </button>
        </template>
      </ScrollArea>

      <div class="norio-office-rich-mention-panel__footer">
        <button
          type="button"
          class="norio-office-rich-mention-panel__submit"
          :disabled="!selectedCommentMentionItem"
          @click="submitSelectedCommentMention"
        >
          提及
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="blockDragGhost"
        class="norio-office-rich-block-drag-ghost"
        :style="blockDragGhostStyle"
        aria-hidden="true"
      >
        <div class="norio-office-rich-block-drag-ghost__content norio-office-rich-prosemirror" v-html="blockDragGhost.html" />
      </div>
    </Teleport>

    <FormulaEditorDialog
      :open="isFormulaDialogOpen"
      :value="formulaDraft"
      title="插入 LaTeX 公式"
      submit-label="插入"
      @close="closeFormulaDialog"
      @submit="insertFormulaBlock"
    />

    <input
      ref="markdownImportInputRef"
      type="file"
      accept=".md,.markdown,text/markdown,text/plain"
      hidden
      @change="handleMarkdownImportChange"
    />

    <input
      ref="localFileInputRef"
      type="file"
      hidden
      @change="handleLocalFileChange"
    />

    <input
      ref="imageUploadInputRef"
      type="file"
      accept="image/*"
      hidden
      @change="handleImageUploadChange"
    />

    <input
      ref="videoUploadInputRef"
      type="file"
      accept="video/*"
      hidden
      @change="handleVideoUploadChange"
    />

    <input
      ref="commentImageInputRef"
      type="file"
      accept="image/*"
      hidden
      @change="handleCommentImageUploadChange"
    />

    <div
      v-if="previewCommentImage"
      class="norio-office-rich-comment-image-viewer"
      role="dialog"
      aria-modal="true"
      @click.self="closeCommentImagePreview"
    >
      <button
        type="button"
        class="norio-office-rich-comment-image-viewer__close"
        aria-label="Close image preview"
        @click="closeCommentImagePreview"
      >
        <OfficeIcon name="close" :size="20" color="#ffffff" background-color="transparent" />
      </button>

      <div class="norio-office-rich-comment-image-viewer__stage">
        <img
          class="norio-office-rich-comment-image-viewer__image"
          :src="previewCommentImage.url"
          :alt="previewCommentImage.alt || previewCommentImage.name || ''"
        />
        <div
          v-if="previewCommentImage.name || previewCommentImage.description"
          class="norio-office-rich-comment-image-viewer__meta"
        >
          <div v-if="previewCommentImage.name" class="norio-office-rich-comment-image-viewer__name">
            {{ previewCommentImage.name }}
          </div>
          <div v-if="previewCommentImage.description" class="norio-office-rich-comment-image-viewer__desc">
            {{ previewCommentImage.description }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="uploadTasks.length" class="norio-office-rich-upload-panel" aria-live="polite">
      <div
        v-for="task in uploadTasks"
        :key="task.id"
        class="norio-office-rich-upload-panel__item"
        :class="{
          'norio-office-rich-upload-panel__item--uploading': task.status === 'uploading',
          'norio-office-rich-upload-panel__item--error': task.status === 'error',
        }"
      >
        <span v-if="task.status === 'uploading'" class="norio-office-rich-upload-spinner" aria-hidden="true" />
        <span v-else class="norio-office-rich-upload-panel__error-dot" aria-hidden="true">!</span>

        <div class="norio-office-rich-upload-panel__content">
          <div class="norio-office-rich-upload-panel__title">{{ getUploadTaskStatusText(task) }}</div>
          <div class="norio-office-rich-upload-panel__meta">{{ task.message || task.fileName }}</div>
        </div>

        <button
          v-if="task.status === 'error'"
          type="button"
          class="norio-office-rich-upload-panel__button"
          @click="task.retry"
        >
          重试
        </button>
        <button
          v-if="task.status === 'error'"
          type="button"
          class="norio-office-rich-upload-panel__button norio-office-rich-upload-panel__button--ghost"
          @click="removeUploadTask(task.id)"
        >
          关闭
        </button>
      </div>
    </div>

    <footer class="norio-office-rich-editor__statusbar">
      <div class="norio-office-rich-statusbar__side norio-office-rich-statusbar__side--counts">
        <div class="norio-office-rich-statusbar__item norio-office-rich-statusbar__word-count">
          <span>{{ wordCountLabel }}</span>
        </div>

        <div class="norio-office-rich-statusbar__item norio-office-rich-statusbar__line-count">
          <span>{{ lineCountLabel }}</span>
        </div>

      </div>

      <div class="norio-office-rich-statusbar__side norio-office-rich-statusbar__side--right">
        <div class="norio-office-rich-statusbar__group norio-office-rich-statusbar__group--view">
          <button
            type="button"
            class="norio-office-rich-statusbar__button"
            :class="{ 'norio-office-rich-statusbar__button--active': isPresentationMode }"
            :title="presentationLabel"
            :aria-label="presentationLabel"
            :aria-pressed="isPresentationMode"
            @click="togglePresentationMode"
          >
            <OfficeIcon name="yanshi" :size="17" color="currentColor" background-color="transparent" />
            <span class="norio-office-rich-statusbar__label norio-office-rich-statusbar__label--presentation">
              {{ presentationLabel }}
            </span>
          </button>

          <button
            type="button"
            class="norio-office-rich-statusbar__button"
            :class="{ 'norio-office-rich-statusbar__button--active': isFullscreen }"
            :title="fullscreenLabel"
            :aria-label="fullscreenLabel"
            :aria-pressed="isFullscreen"
            @click="toggleFullscreen"
          >
            <OfficeIcon :name="isFullscreen ? 'huanyuan' : 'quanpingzuidahua'" :size="17" color="currentColor" background-color="transparent" />
            <span class="norio-office-rich-statusbar__label norio-office-rich-statusbar__label--fullscreen">
              {{ fullscreenLabel }}
            </span>
          </button>
        </div>

        <div class="norio-office-rich-statusbar__group norio-office-rich-statusbar__group--zoom">
          <button type="button" class="norio-office-rich-statusbar__button norio-office-rich-statusbar__button--icon" title="缩小" aria-label="缩小" :disabled="zoom <= 50" @click="updateZoom(zoom - 10)">
            <OfficeIcon name="jianshao" :size="13" color="currentColor" background-color="transparent" />
          </button>
          <div class="norio-office-rich-statusbar__zoom">{{ zoom }}%</div>
          <button type="button" class="norio-office-rich-statusbar__button norio-office-rich-statusbar__button--icon" title="放大" aria-label="放大" :disabled="zoom >= 200" @click="updateZoom(zoom + 10)">
            <OfficeIcon name="add" :size="13" color="currentColor" background-color="transparent" />
          </button>
        </div>

        <div v-if="hasExportMenuItems" ref="statusbarExportMenuRef" class="norio-office-rich-statusbar__group norio-office-rich-statusbar__group--export" @keydown="handleStatusbarExportKeyDown">
          <button
            type="button"
            class="norio-office-rich-statusbar__button"
            :class="{ 'norio-office-rich-statusbar__button--active': isExportMenuOpen }"
            :title="exportLabel"
            :aria-label="exportLabel"
            aria-haspopup="menu"
            :aria-expanded="isExportMenuOpen"
            :disabled="!!exportingType"
            @click="toggleExportMenu"
          >
            <OfficeColorIcon name="xiazai" :size="19" background-color="transparent" />
            <span class="norio-office-rich-statusbar__label">{{ exportLabel }}</span>
            <OfficeIcon name="xiangxiajiantou" :size="11" color="currentColor" background-color="transparent" class="norio-office-rich-statusbar__caret" :class="{ 'norio-office-rich-statusbar__caret--open': isExportMenuOpen }" />
          </button>

          <div v-if="isExportMenuOpen" class="norio-office-rich-statusbar__export-menu" role="menu" :aria-label="exportLabel">
            <button v-for="item in exportMenuItems" :key="item.key" type="button" class="norio-office-rich-statusbar__export-item" role="menuitem" :disabled="!!exportingType" @click="item.onClick">
              <OfficeColorIcon :name="item.iconName" :size="20" background-color="transparent" />
              <span>{{ exportingType === item.key ? item.loadingLabel : item.label }}</span>
            </button>
          </div>
        </div>

        <div v-if="isPrintEnabled" class="norio-office-rich-statusbar__group norio-office-rich-statusbar__group--print">
          <button type="button" class="norio-office-rich-statusbar__button" :title="printLabel" :aria-label="printLabel" :disabled="!!exportingType" @click="printDocument">
            <OfficeColorIcon name="dayin" :size="19" background-color="transparent" />
            <span class="norio-office-rich-statusbar__label">{{ printLabel }}</span>
          </button>
        </div>
      </div>
    </footer>

    <div
      v-show="isPresentationMode"
      class="norio-office-rich-editor__presentation-pointer"
      :style="presentationPointerStyle"
      aria-hidden="true"
    />

    <Teleport :to="isFullscreen && rootRef ? rootRef : 'body'">
      <div
        v-if="isSlashPopupOpen"
        ref="slashMenuRef"
        class="norio-office-rich-slash-menu"
        :style="slashMenuStyle"
        :role="isSlashMenuOpen ? 'listbox' : undefined"
        :aria-label="isSlashMenuOpen ? '斜杠命令' : '表情符号'"
        @mousedown.prevent
      >
        <template v-if="isSlashMenuOpen">
          <section v-if="visibleSlashBasicCommands.length" class="norio-office-rich-slash-menu__section">
            <div class="norio-office-rich-slash-menu__title">基础</div>
            <div class="norio-office-rich-slash-menu__quick-grid">
              <button
                v-for="command in visibleSlashBasicCommands"
                :key="command.key"
                type="button"
                role="option"
                class="norio-office-rich-slash-menu__quick-item"
                :class="{ 'norio-office-rich-slash-menu__item--active': command.index === selectedSlashIndex }"
                :aria-label="command.label"
                :aria-selected="command.index === selectedSlashIndex"
                @mouseenter="selectedSlashIndex = command.index"
                @click="runSlashCommand(command)"
              >
                <OfficeIcon v-if="command.iconName" :name="command.iconName" :size="16" color="currentColor" background-color="transparent" />
                <span v-else>{{ command.key === 'paragraph' ? 'T' : command.label }}</span>
              </button>
            </div>
          </section>
          <section v-if="visibleSlashCommonCommands.length" class="norio-office-rich-slash-menu__section">
            <div class="norio-office-rich-slash-menu__title">常用</div>
            <button
              v-for="command in visibleSlashCommonCommands"
              :key="command.key"
              type="button"
              role="option"
              class="norio-office-rich-slash-menu__item"
              :class="{ 'norio-office-rich-slash-menu__item--active': command.index === selectedSlashIndex }"
              :aria-selected="command.index === selectedSlashIndex"
              @mouseenter="selectedSlashIndex = command.index"
              @click="runSlashCommand(command)"
            >
              <OfficeColorIcon v-if="command.iconName && command.isColorIcon" :name="command.iconName" :size="20" background-color="transparent" />
              <OfficeIcon v-else-if="command.iconName" :name="command.iconName" :size="16" color="currentColor" background-color="transparent" />
              <span class="norio-office-rich-slash-menu__label">{{ command.label }}</span>
            </button>
          </section>
          <section v-if="visibleSlashMoreCommands.length" class="norio-office-rich-slash-menu__section">
            <div class="norio-office-rich-slash-menu__title">更多</div>
            <button
              v-for="command in visibleSlashMoreCommands"
              :key="command.key"
              type="button"
              role="option"
              class="norio-office-rich-slash-menu__item"
              :class="{ 'norio-office-rich-slash-menu__item--active': command.index === selectedSlashIndex }"
              :aria-selected="command.index === selectedSlashIndex"
              @mouseenter="selectedSlashIndex = command.index"
              @click="runSlashCommand(command)"
            >
              <OfficeColorIcon v-if="command.iconName && command.isColorIcon" :name="command.iconName" :size="20" background-color="transparent" />
              <OfficeIcon v-else-if="command.iconName" :name="command.iconName" :size="16" color="currentColor" background-color="transparent" />
              <span class="norio-office-rich-slash-menu__label">{{ command.label }}</span>
            </button>
          </section>
          <div v-if="!visibleSlashCommands.length" class="norio-office-rich-slash-menu__empty">无匹配命令</div>
        </template>
        <EmojiPickerPanel v-else @select="handleSlashEmojiSelect" />
      </div>
    </Teleport>

  </div>
</template>
