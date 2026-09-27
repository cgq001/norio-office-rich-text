<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { JSONContent } from '@tiptap/core'
import type {
  RichTextEditorCommentCreatePayload,
  RichTextEditorCommentDeletePayload,
  RichTextEditorCommentMentionProviderPayload,
  RichTextEditorCommentReplyPayload,
  RichTextEditorCommentResolvePayload,
  RichTextEditorCommentSubmitPayload,
  RichTextEditorCommentThread,
  RichTextEditorCommentUpdatePayload,
  RichTextEditorCommentUser,
  RichTextEditorCollaborationOptions,
  RichTextEditorCollaborationUser,
  RichTextEditorMentionItem,
  RichTextEditorMentionProviderPayload,
  RichTextEditorUploadInput,
  RichTextEditorUploadResult,
  RichTextEditorInstance,
} from '@norio-office/rich-text'
import { RichTextEditor } from '@norio-office/rich-text'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'
import { createWebOfficeRuntimeBridge } from './weboffice-runtime'

type CollaborationParticipant = {
  awarenessClientId: number | string
  userId: string
  userName: string
  clientType: string
  clientUniqueCode: string
  color?: string
  isCurrentUser: boolean
}

type EditorCommandMessage = {
  type?: string
  requestId?: string
  action?: string
  payload?: unknown
}

type RuntimeExportOptions = {
  format?: string
  fileName?: string
  mimeType?: string
}

type RuntimeSaveOptions = {
  saveType?: string
  message?: string
}

const params = new URLSearchParams(window.location.search)
const collaborationEnabled = ['1', 'true', 'yes'].includes((params.get('collab') ?? '').toLowerCase())
const collabServerUrl = params.get('server') || params.get('ws') || 'ws://127.0.0.1:1234/collaboration'
const collabRoom = params.get('room') || 'tenant-demo:rich:document-demo'
const collabToken = params.get('token')
const clientId = getOrCreateClientId()
const accessUserId = params.get('userId') || params.get('uid') || clientId
const accessUserName = params.get('userName') || params.get('name') || `Word 用户 ${accessUserId.slice(0, 6)}`
const clientType = normalizeClientType(params.get('clientType') || params.get('platform') || params.get('terminal') || 'web')
const clientUniqueCode = params.get('clientUniqueCode') || params.get('uniqueCode') || params.get('deviceId') || clientId
const documentName = params.get('documentName') || params.get('docName') || 'Norion 产品设计文档'
const ownsInitialContent = collaborationEnabled && ['1', 'true', 'yes'].includes((params.get('init') ?? params.get('initialize') ?? '').toLowerCase())
const runtimeBridge = createWebOfficeRuntimeBridge(params, 'rich')
const editorMode = ref<'edit' | 'preview'>(params.get('readonly') === 'true' || params.get('mode') === 'view' ? 'preview' : 'edit')
const runtimeDirty = ref(false)
const runtimeLastSavedAt = ref('')

const demoColors = ['#2563eb', '#f97316', '#16a34a', '#9333ea', '#dc2626', '#0f766e']

const user: RichTextEditorCollaborationUser = {
  id: accessUserId,
  userId: accessUserId,
  name: accessUserName,
  displayName: accessUserName,
  clientType,
  clientUniqueCode,
  color: pickUserColor(accessUserId),
}
const commentUser: RichTextEditorCommentUser = {
  id: accessUserId,
  name: accessUserName,
  color: user.color,
}
const ydoc = new Y.Doc()
const provider = collaborationEnabled
  ? new WebsocketProvider(
      collabServerUrl,
      collabRoom,
      ydoc,
      {
        params: {
          roomNo: collabRoom,
          roomId: collabRoom,
          userId: accessUserId,
          userName: accessUserName,
          clientType,
          clientUniqueCode,
          uniqueCode: clientUniqueCode,
          clientId: clientUniqueCode,
          docType: 'rich',
          documentType: 'rich',
          ...(collabToken ? { token: collabToken } : {}),
        },
      },
    )
  : null
const debugText = ydoc.getText('debug')
const debugValue = ref(debugText.toString())
const docUpdateCount = ref(0)
const contentFragmentLength = ref(ydoc.getXmlFragment('content').length)
const editorRef = ref<RichTextEditorInstance | null>(null)
const connectionStatus = ref<'connecting' | 'connected' | 'disconnected'>(collaborationEnabled ? 'connecting' : 'disconnected')
const isSynced = ref(false)
const wsConnected = ref(provider?.wsconnected ?? false)
const bcConnected = ref(provider?.bcconnected ?? false)
const onlineParticipants = ref<CollaborationParticipant[]>([])
const gatewayLoadStatus = ref(runtimeBridge.hasGateway() ? '等待文件' : '未配置')
const gatewaySaveStatus = ref(runtimeBridge.hasGateway() ? '等待保存' : '未配置')
const gatewayHydrated = ref(!runtimeBridge.hasGateway() || (collaborationEnabled && !ownsInitialContent))
const initialGatewayContent = ref<JSONContent | null>(null)
const onlineUserIds = computed(() => Array.from(new Set(onlineParticipants.value.map((item) => item.userId))))
let detachDocDebug: (() => void) | null = null
let detachPresenceBroadcast: (() => void) | null = null

function syncProviderFlags() {
  wsConnected.value = provider?.wsconnected ?? false
  bcConnected.value = provider?.bcconnected ?? false
}

function getOrCreateClientId() {
  const key = 'office-word-playground-client-id'
  const existing = window.sessionStorage.getItem(key)
  if (existing) {
    return existing
  }

  const next = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `client_${Date.now()}_${Math.random().toString(16).slice(2)}`
  window.sessionStorage.setItem(key, next)
  return next
}

function normalizeClientType(value: string) {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'web' || normalized === 'android' || normalized === 'ios' || normalized === 'desktop') {
    return normalized
  }
  if (normalized === 'iso') {
    return 'ios'
  }
  return 'web'
}

function pickUserColor(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return demoColors[hash % demoColors.length]
}

function startPresenceBroadcast(activeProvider: WebsocketProvider) {
  const awareness = activeProvider.awareness

  awareness.setLocalStateField('officePresence', {
    docType: 'rich',
    roomId: collabRoom,
    userId: accessUserId,
    userName: accessUserName,
    clientType,
    clientUniqueCode,
    color: user.color,
    updatedAt: Date.now(),
  })

  const broadcast = () => {
    const participants = readAwarenessParticipants(activeProvider)
    onlineParticipants.value = participants

    window.dispatchEvent(new CustomEvent('office:collaboration-users-change', {
      detail: {
        docType: 'rich',
        roomId: collabRoom,
        currentUserId: accessUserId,
        currentClientUniqueCode: clientUniqueCode,
        userIds: Array.from(new Set(participants.map((item) => item.userId))),
        participants,
      },
    }))
  }

  awareness.on('update', broadcast)
  broadcast()

  return () => {
    awareness.off('update', broadcast)
  }
}

function readAwarenessParticipants(activeProvider: WebsocketProvider): CollaborationParticipant[] {
  return Array.from(activeProvider.awareness.getStates().entries())
    .map(([awarenessClientId, state]) => normalizeAwarenessParticipant(awarenessClientId, state))
    .filter((item): item is CollaborationParticipant => item !== null)
}

function normalizeAwarenessParticipant(awarenessClientId: number, state: unknown): CollaborationParticipant | null {
  if (!state || typeof state !== 'object') {
    return null
  }

  const source = state as {
    officePresence?: Record<string, unknown>
    officeExcel?: Record<string, unknown>
    user?: Record<string, unknown>
  }
  const presence = source.officePresence ?? source.officeExcel ?? source.user ?? {}
  const userId = String(presence.userId ?? presence.id ?? '').trim()

  if (!userId) {
    return null
  }

  const clientCode = String(presence.clientUniqueCode ?? presence.clientId ?? '').trim()
  return {
    awarenessClientId,
    userId,
    userName: String(presence.userName ?? presence.displayName ?? presence.name ?? userId),
    clientType: String(presence.clientType ?? 'web'),
    clientUniqueCode: clientCode,
    color: typeof presence.color === 'string' ? presence.color : undefined,
    isCurrentUser: userId === accessUserId && (!clientCode || clientCode === clientUniqueCode),
  }
}

provider?.on('status', (event) => {
  connectionStatus.value = event.status
  syncProviderFlags()
})

provider?.on('sync', (synced) => {
  isSynced.value = synced
  syncProviderFlags()
})

if (provider) {
  detachPresenceBroadcast = startPresenceBroadcast(provider)
}

const statusLabel = computed(() => {
  if (connectionStatus.value === 'connected') {
    return '已连接'
  }

  if (connectionStatus.value === 'connecting') {
    return '连接中'
  }

  return '已断开'
})

const collabSummary = computed(() => {
  if (!collaborationEnabled) {
    return '单人模式'
  }

  return `${connectionStatus.value}${isSynced.value ? ' / 已同步' : ' / 同步中'}`
})

const sampleContent: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Norion 产品设计文档' }],
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: '张晓明  |  今天 10:30  |  浏览 1024' }],
    },
    { type: 'horizontalRule' },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: '1. 产品概述' }],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Norion 是一款面向团队的',
        },
        {
          type: 'text',
          marks: [{ type: 'commentMark', attrs: { threadId: 'demo-comment-thread-1' } }],
          text: '协同笔记软件',
        },
        {
          type: 'text',
          text: '，致力于帮助团队更高效地记录、整理和分享知识，提升团队协作效率。',
        },
      ],
    },
    {
      type: 'highlightBlock',
      attrs: {
        emoji: 'i',
        emojiEnabled: true,
        borderColor: '#cfe0ff',
        backgroundColor: '#f8fbff',
      },
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', marks: [{ type: 'bold' }], text: '核心目标' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: '打造流畅的笔记编辑体验' }] }],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      marks: [{ type: 'commentMark', attrs: { threadId: 'demo-comment-thread-2' } }],
                      text: '提供强大的协同功能',
                    },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: '保障数据安全与隐私' }] }],
            },
          ],
        },
      ],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: '2. 核心功能' }],
    },
    {
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: '2.1 笔记编辑' }],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '支持富文本编辑' }] }],
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '支持 Markdown 语法' }] }],
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '支持插入图片、表格、代码块等' }] }],
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '支持模板和快捷键' }] }],
        },
      ],
    },
    {
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: '2.2 协同功能' }],
    },
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: '功能点' }] }] },
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: '描述' }] }] },
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: '状态' }] }] },
          ],
        },
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '多人实时协作' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '多人同时编辑同一篇笔记' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '已完成' }] }] },
          ],
        },
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      marks: [{ type: 'commentMark', attrs: { threadId: 'demo-comment-thread-3' } }],
                      text: '评论与讨论',
                    },
                  ],
                },
              ],
            },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '在笔记中进行评论和讨论' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '已完成' }] }] },
          ],
        },
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '@ 提及' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '提及团队成员并通知' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '开发中' }] }] },
          ],
        },
      ],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: '3. 产品架构' }],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: '4. 体验设计' }],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: '5. 未来规划' }],
    },
  ],
}

const content = ref<JSONContent | null>(collaborationEnabled ? null : sampleContent)
const demoCommentNow = Date.now()
const demoCommentImage = {
  url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" rx="18" fill="%23eef4ff"/><rect x="34" y="34" width="252" height="112" rx="12" fill="%23ffffff" stroke="%234c7dff" stroke-width="3"/><circle cx="74" cy="76" r="18" fill="%234c7dff"/><path d="M104 65h140M104 88h108M58 120h204" stroke="%23667485" stroke-width="10" stroke-linecap="round"/></svg>',
  name: 'comment-demo-image.svg',
  mimeType: 'image/svg+xml',
}
const comments = ref<RichTextEditorCommentThread[]>([
  {
    id: 'demo-comment-thread-1',
    anchorText: '协同笔记软件',
    status: 'open',
    comments: [
      {
        id: 'demo-comment-1',
        content: '这里可以补一条对协同定位的说明。',
        author: {
          id: 'user-1001',
          name: '崔国强',
          color: '#4c7dff',
        },
        createdAt: new Date(demoCommentNow - 2 * 60 * 1000).toISOString(),
      },
      {
        id: 'demo-comment-1-reply-1',
        parentId: 'demo-comment-1',
        content: '@张晓明 这里可以再补一句“评论数据由业务侧保存”。',
        author: {
          id: 'user-1002',
          name: '张晓明',
          color: '#16a34a',
        },
        createdAt: new Date(demoCommentNow - 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: 'demo-comment-thread-2',
    anchorText: '提供强大的协同功能',
    status: 'open',
    comments: [
      {
        id: 'demo-comment-2',
        content: '这条用来测试多回复场景，点卡片可以定位到高亮块里的文字。',
        author: {
          id: 'user-1003',
          name: '李思雨',
          color: '#9333ea',
        },
        createdAt: new Date(demoCommentNow - 8 * 60 * 1000).toISOString(),
      },
      {
        id: 'demo-comment-2-reply-1',
        parentId: 'demo-comment-2',
        content: '收到，我试一下回复、编辑和删除。',
        author: commentUser,
        createdAt: new Date(demoCommentNow - 4 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: 'demo-comment-thread-3',
    anchorText: '评论与讨论',
    status: 'open',
    comments: [
      {
        id: 'demo-comment-3',
        content: '这条带了一张图片，用来验证评论图片展示和上传后的数据结构。',
        images: [demoCommentImage],
        author: {
          id: 'user-1004',
          name: '王一航',
          color: '#f97316',
        },
        createdAt: new Date(demoCommentNow - 15 * 60 * 1000).toISOString(),
      },
    ],
  },
])
const canMountEditor = computed(() => (!collaborationEnabled || isSynced.value) && gatewayHydrated.value)
const collaborationOptions = computed<RichTextEditorCollaborationOptions | null>(() => {
  if (!collaborationEnabled) {
    return null
  }

  return {
    document: ydoc,
    field: 'content',
    provider,
    user,
    initializeContent: ownsInitialContent,
    initialContent: ownsInitialContent ? (initialGatewayContent.value ?? sampleContent) : null,
  }
})

const mentionMockItems: RichTextEditorMentionItem[] = [
  { id: 'user-1001', name: '崔国强', type: 1 },
  { id: 'user-1002', name: '张晓明', type: 1 },
  { id: 'user-1003', name: '李思雨', type: 1 },
  { id: 'user-1004', name: '王一航', type: 1 },
  { id: 'user-1005', name: '陈小北', type: 1 },
  { id: 'user-1006', name: '赵云飞', type: 1 },
  { id: 'user-1007', name: '刘佳宁', type: 1 },
  { id: 'user-1008', name: '周明远', type: 1 },
  { id: 'user-1009', name: '黄若琳', type: 1 },
  { id: 'user-1010', name: '孙嘉诚', type: 1 },
  { id: 'doc-2001', name: 'IT资产管理系统', type: 2, tag: '外部', updatedAt: '2025年12月1日' },
  { id: 'doc-2002', name: '服务器', type: 2, updatedAt: '刚刚' },
  { id: 'doc-2003', name: '第二章 gorm', type: 2, updatedAt: '3月11日 10:54' },
  { id: 'doc-2004', name: 'AI 爆款生成模板', type: 2, tag: '外部', updatedAt: '2025年12月18日' },
  { id: 'doc-2005', name: '项目管理', type: 2, updatedAt: '2025年12月4日' },
  { id: 'doc-2006', name: '客户满意度调研表', type: 2, tag: '模板', updatedAt: '2025年11月28日' },
  { id: 'doc-2007', name: '研发排期计划', type: 2, updatedAt: '2025年10月9日' },
  { id: 'doc-2008', name: '设计规范说明', type: 2, updatedAt: '2025年9月16日' },
  { id: 'doc-2009', name: '会议纪要模板', type: 2, updatedAt: '2025年8月22日' },
  { id: 'doc-2010', name: '上线检查清单', type: 2, updatedAt: '2025年7月30日' },
]

async function handleMentionSearch(payload: RichTextEditorMentionProviderPayload) {
  await new Promise((resolve) => window.setTimeout(resolve, 120))

  const query = payload.query.trim().toLowerCase()
  return mentionMockItems.filter((item) => {
    const typeMatched = payload.type === 'all' || !payload.type || item.type === payload.type
    const queryMatched = !query || item.name.toLowerCase().includes(query) || item.id.toLowerCase().includes(query)
    return typeMatched && queryMatched
  })
}

async function handleCommentMentionSearch(payload: RichTextEditorCommentMentionProviderPayload) {
  await new Promise((resolve) => window.setTimeout(resolve, 120))
  console.log('comment mention search:', payload)

  const query = payload.query.trim().toLowerCase()
  return mentionMockItems.filter((item) => {
    const typeMatched = payload.type === 'all' || !payload.type || item.type === payload.type
    const queryMatched = !query || item.name.toLowerCase().includes(query) || item.id.toLowerCase().includes(query)
    return typeMatched && queryMatched
  })
}

function handleMentionItemClick(item: RichTextEditorMentionItem) {
  console.log('mention item click:', item)
}

function handleMentionSubmit(item: RichTextEditorMentionItem) {
  console.log('mention submit:', item)
}

function handleCommentMentionItemClick(item: RichTextEditorMentionItem) {
  console.log('comment mention item click:', item)
}

function handleCommentMentionSubmit(item: RichTextEditorMentionItem) {
  console.log('comment mention submit:', item)
}

function handleCommentSubmit(payload: RichTextEditorCommentSubmitPayload) {
  console.log('comment submit:', payload)
}

async function uploadCommentImage(payload: RichTextEditorUploadInput): Promise<RichTextEditorUploadResult> {
  return uploadToGateway(payload, 'comment-image')
}

async function uploadToGateway(payload: RichTextEditorUploadInput, kind: string): Promise<RichTextEditorUploadResult> {
  if (!runtimeBridge.hasGateway()) {
    return {
      url: URL.createObjectURL(payload.file),
      name: payload.file.name,
      size: payload.file.size,
      mimeType: payload.file.type,
    }
  }
  const asset = await runtimeBridge.uploadAsset(payload.file, {
    kind,
    name: payload.file.name,
    mimeType: payload.file.type,
  })
  return {
    url: asset.url,
    name: asset.name,
    size: asset.size,
    mimeType: asset.mimeType,
  }
}

async function saveRichTextToGateway() {
  if (!runtimeBridge.hasGateway()) {
    throw new Error('Gateway is not ready.')
  }
  gatewaySaveStatus.value = '保存中'
  try {
    const json = editorRef.value?.getJSON() ?? content.value ?? sampleContent
    const blob = new Blob([JSON.stringify(json)], { type: 'application/json' })
    const result = await runtimeBridge.saveBlob(blob, {
      fileName: `${runtimeBridge.fileId || 'rich-text'}.json`,
      mimeType: 'application/json',
      saveType: 'manual',
      message: 'Saved from Rich Text playground',
    })
    gatewaySaveStatus.value = result.versionId ? `已保存 ${result.versionId}` : '已保存'
    runtimeLastSavedAt.value = result.savedAt || new Date().toISOString()
    setRuntimeDirty(false)
    emitEditorEvent('saveStatusChange', { status: 'saved', result })
    return result
  } catch (error) {
    gatewaySaveStatus.value = error instanceof Error ? error.message : '保存失败'
    emitEditorEvent('saveStatusChange', { status: 'failed', error: normalizeRuntimeError(error) })
    console.error('[rich-text] save to Gateway failed', error)
    throw error
  }
}

async function saveRichTextToGatewayWithOptions(payload: unknown) {
  if (!runtimeBridge.hasGateway()) {
    throw new Error('Gateway is not ready.')
  }
  const options = isRecord(payload) ? payload as RuntimeSaveOptions : {}
  gatewaySaveStatus.value = '保存中'
  try {
    const json = editorRef.value?.getJSON() ?? content.value ?? sampleContent
    const blob = new Blob([JSON.stringify(json)], { type: 'application/json' })
    const result = await runtimeBridge.saveBlob(blob, {
      fileName: `${runtimeBridge.fileId || 'rich-text'}.json`,
      mimeType: 'application/json',
      saveType: options.saveType || 'manual',
      message: options.message || 'Saved from WebOffice Runtime',
    })
    gatewaySaveStatus.value = result.versionId ? `已保存 ${result.versionId}` : '已保存'
    runtimeLastSavedAt.value = result.savedAt || new Date().toISOString()
    setRuntimeDirty(false)
    emitEditorEvent('saveStatusChange', { status: 'saved', result })
    return result
  } catch (error) {
    gatewaySaveStatus.value = error instanceof Error ? error.message : '保存失败'
    emitEditorEvent('saveStatusChange', { status: 'failed', error: normalizeRuntimeError(error) })
    throw error
  }
}

async function exportRichTextToGateway(options: RuntimeExportOptions = {}) {
  if (!runtimeBridge.hasGateway()) {
    throw new Error('Gateway is not ready.')
  }
  const format = (options.format || 'html').toLowerCase()
  const fileName = options.fileName || `${runtimeBridge.fileId || 'rich-text'}.${format === 'image' ? 'png' : format}`
  const blob = await createRichTextExportBlob(format, options.mimeType)
  return runtimeBridge.registerExport(blob, {
    fileName,
    mimeType: blob.type || options.mimeType || 'application/octet-stream',
  })
}

async function createRichTextExportBlob(format: string, mimeType?: string) {
  if (format === 'pdf') {
    const blob = await editorRef.value?.exportPdf()
    if (!blob) {
      throw new Error('PDF export failed.')
    }
    return blob
  }
  if (format === 'image' || format === 'png') {
    const blob = await editorRef.value?.exportImage({ type: 'image/png' })
    if (!blob) {
      throw new Error('Image export failed.')
    }
    return blob
  }
  if (format === 'json') {
    const json = editorRef.value?.getJSON() ?? content.value ?? sampleContent
    return new Blob([JSON.stringify(json)], { type: mimeType || 'application/json' })
  }
  const html = editorRef.value?.exportHtml() ?? ''
  return new Blob([html], { type: mimeType || 'text/html;charset=utf-8' })
}

async function hydrateRichTextFromGatewayContent() {
  if (!runtimeBridge.hasGateway()) {
    gatewayHydrated.value = true
    return
  }
  if (collaborationEnabled && !ownsInitialContent) {
    gatewayLoadStatus.value = '协同端跳过文件初始化'
    gatewayHydrated.value = true
    return
  }
  gatewayLoadStatus.value = '加载中'
  try {
    const file = await runtimeBridge.readFileContent()
    const raw = await file.blob.text()
    const nextContent = normalizeGatewayJSONContent(JSON.parse(raw))
    if (collaborationEnabled) {
      initialGatewayContent.value = nextContent
    } else {
      content.value = nextContent
    }
    gatewayLoadStatus.value = file.revision ? `已加载 ${file.revision}` : '已加载'
    setRuntimeDirty(false)
  } catch (error) {
    gatewayLoadStatus.value = error instanceof Error ? error.message : '加载失败'
    console.error('[rich-text] load from Gateway failed', error)
  } finally {
    gatewayHydrated.value = true
  }
}

function normalizeGatewayJSONContent(value: unknown): JSONContent {
  if (isRecord(value)) {
    if (isRecord(value.document)) {
      return value.document as JSONContent
    }
    if (isRecord(value.content) && typeof value.content.type === 'string') {
      return value.content as JSONContent
    }
  }
  return value as JSONContent
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function handleCommentCreate(payload: RichTextEditorCommentCreatePayload) {
  comments.value = [
    ...comments.value,
    {
      id: payload.threadId,
      anchorText: payload.anchorText,
      status: 'open',
      comments: [
        {
          id: payload.commentId,
          content: payload.content,
          images: payload.images,
          mentions: payload.mentions,
          author: payload.author,
          createdAt: payload.createdAt,
        },
      ],
    },
  ]
}

function handleCommentReply(payload: RichTextEditorCommentReplyPayload) {
  comments.value = comments.value.map((thread) =>
    thread.id === payload.threadId
      ? {
          ...thread,
          comments: [
            ...thread.comments,
            {
              id: payload.commentId,
              parentId: payload.parentId,
              content: payload.content,
              images: payload.images,
              mentions: payload.mentions,
              author: payload.author,
              createdAt: payload.createdAt,
            },
          ],
        }
      : thread,
  )
}

function handleCommentUpdate(payload: RichTextEditorCommentUpdatePayload) {
  comments.value = comments.value.map((thread) =>
    thread.id === payload.threadId
      ? {
          ...thread,
          comments: thread.comments.map((item) =>
            item.id === payload.commentId
              ? {
                  ...item,
                  content: payload.content,
                  images: payload.images ?? item.images,
                  mentions: payload.mentions,
                  updatedAt: payload.updatedAt,
                }
              : item,
          ),
        }
      : thread,
  )
}

function handleCommentDelete(payload: RichTextEditorCommentDeletePayload) {
  if (!payload.commentId) {
    comments.value = comments.value.filter((thread) => thread.id !== payload.threadId)
    return
  }

  comments.value = comments.value
    .map((thread) =>
      thread.id === payload.threadId
        ? { ...thread, comments: thread.comments.filter((item) => item.id !== payload.commentId && item.parentId !== payload.commentId) }
        : thread,
    )
    .filter((thread) => thread.comments.length > 0)
}

function handleCommentResolve(payload: RichTextEditorCommentResolvePayload) {
  comments.value = comments.value.map((thread) =>
    thread.id === payload.threadId
      ? { ...thread, status: payload.resolved ? 'resolved' : 'open' }
      : thread,
  )
}

function syncDocDebugState() {
  debugValue.value = debugText.toString()
  contentFragmentLength.value = ydoc.getXmlFragment('content').length
}

function handleDebugTextChange() {
  const nextValue = debugValue.value
  const currentValue = debugText.toString()

  if (nextValue === currentValue) {
    return
  }

  debugText.delete(0, currentValue.length)
  debugText.insert(0, nextValue)
}

function handleContentUpdate(value: JSONContent | null) {
  content.value = value
  setRuntimeDirty(true)
}

function handleRuntimeMessage(event: MessageEvent) {
  if (event.source !== window.parent) {
    return
  }
  const message = event.data as EditorCommandMessage
  if (!message || message.type !== 'norio.weboffice.editor.command' || !message.requestId || !message.action) {
    return
  }
  void runRuntimeCommand(message.action, message.payload)
    .then((payload) => postEditorResponse(message.requestId!, true, payload))
    .catch((error) => postEditorResponse(message.requestId!, false, normalizeRuntimeError(error)))
}

async function runRuntimeCommand(action: string, payload: unknown) {
  switch (action) {
    case 'getState':
      return getRuntimeState()
    case 'setMode': {
      const mode = isRecord(payload) && payload.mode === 'view' ? 'preview' : 'edit'
      editorMode.value = mode
      return getRuntimeState()
    }
    case 'save':
      emitEditorEvent('saveStatusChange', { status: 'saving' })
      return saveRichTextToGatewayWithOptions(payload)
    case 'export':
      return exportRichTextToGateway(isRecord(payload) ? payload as RuntimeExportOptions : {})
    case 'setCommandBars':
      return { accepted: true }
    case 'closeDocument':
      return { closed: true, dirty: runtimeDirty.value }
    default:
      throw new Error(`Unsupported Rich Text runtime command: ${action}`)
  }
}

function getRuntimeState() {
  return {
    phase: canMountEditor.value ? (runtimeDirty.value ? 'dirty' : 'ready') : 'loading',
    fileId: runtimeBridge.fileId,
    officeType: 'rich',
    dirty: runtimeDirty.value,
    readonly: editorMode.value === 'preview',
    lastSavedAt: runtimeLastSavedAt.value || undefined,
    document: editorRef.value?.getJSON() ?? content.value,
    collaboration: {
      enabled: collaborationEnabled,
      roomId: collabRoom,
      status: connectionStatus.value,
      synced: isSynced.value,
      participants: onlineParticipants.value,
    },
  }
}

function setRuntimeDirty(dirty: boolean) {
  if (runtimeDirty.value === dirty) {
    return
  }
  runtimeDirty.value = dirty
  emitEditorEvent('dirtyChange', { dirty })
}

function postEditorResponse(requestId: string, ok: boolean, payload: unknown) {
  window.parent?.postMessage({
    type: 'norio.weboffice.editor.response',
    requestId,
    ok,
    payload: toRuntimeMessagePayload(payload),
  }, '*')
}

function emitEditorEvent(event: string, payload: unknown) {
  window.parent?.postMessage({
    type: 'norio.weboffice.editor.event',
    event,
    payload: toRuntimeMessagePayload(payload),
  }, '*')
}

function toRuntimeMessagePayload(payload: unknown): unknown {
  // Runtime messages contain JSON data; Vue proxies cannot be structured-cloned.
  return payload === undefined ? undefined : JSON.parse(JSON.stringify(payload))
}

function normalizeRuntimeError(error: unknown) {
  if (error instanceof Error) {
    return { code: 'EDITOR_COMMAND_FAILED', message: error.message, retryable: false }
  }
  if (isRecord(error)) {
    return {
      code: String(error.code ?? 'EDITOR_COMMAND_FAILED'),
      message: String(error.message ?? error.error ?? 'Editor command failed'),
      retryable: Boolean(error.retryable ?? false),
    }
  }
  return { code: 'EDITOR_COMMAND_FAILED', message: 'Editor command failed', retryable: false }
}

onMounted(() => {
  window.addEventListener('message', handleRuntimeMessage)
  emitEditorEvent('ready', getRuntimeState())
  void hydrateRichTextFromGatewayContent()

  const handleDebugUpdate = () => {
    debugValue.value = debugText.toString()
  }

  const handleDocUpdate = () => {
    docUpdateCount.value += 1
    syncDocDebugState()
    if (collaborationEnabled) {
      setRuntimeDirty(true)
    }
  }

  debugText.observe(handleDebugUpdate)
  ydoc.on('update', handleDocUpdate)
  syncDocDebugState()

  detachDocDebug = () => {
    debugText.unobserve(handleDebugUpdate)
    ydoc.off('update', handleDocUpdate)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('message', handleRuntimeMessage)
  detachDocDebug?.()
  detachPresenceBroadcast?.()
  provider?.destroy()
  ydoc.destroy()
})
</script>

<template>
  <div class="playground-shell">
    <div class="playground-card">
      <div class="playground-header">
        <div>
          <p class="playground-kicker">Office Word Playground</p>
          <h1>富文本协同接入</h1>
          <p class="playground-tip">
            使用统一协同服务接入富文本，room 建议保持 tenant:rich:documentId 结构。
          </p>
        </div>
        <div class="playground-meta">
          <span class="playground-status" :data-status="connectionStatus">{{ statusLabel }}</span>
          <span>用户：{{ accessUserName }}</span>
          <span>用户ID：{{ accessUserId }}</span>
          <span>房间：{{ collabRoom }}</span>
          <span>接入端：{{ clientType }}</span>
          <span>唯一码：{{ clientUniqueCode }}</span>
          <span>初始化权：{{ ownsInitialContent ? 'yes' : 'no' }}</span>
          <span v-if="runtimeBridge.hasGateway()">file：{{ gatewayLoadStatus }}</span>
          <span v-if="runtimeBridge.hasGateway()">save：{{ gatewaySaveStatus }}</span>
          <button v-if="runtimeBridge.hasGateway()" type="button" @click="saveRichTextToGateway">保存到 Gateway</button>
          <span>ws：{{ wsConnected ? 'connected' : 'disconnected' }}</span>
          <span>bc：{{ bcConnected ? 'on' : 'off' }}</span>
          <span>sync：{{ isSynced ? 'ready' : 'pending' }}</span>
        </div>
      </div>

      <div class="playground-info">
        <code>server={{ collabServerUrl }}</code>
        <code>room={{ collabRoom }}</code>
        <code>mode={{ collabSummary }}</code>
        <code>docType=rich</code>
        <code>user={{ accessUserName }}</code>
        <code>userId={{ accessUserId }}</code>
        <code>clientType={{ clientType }}</code>
        <code>uniqueCode={{ clientUniqueCode }}</code>
        <code>init={{ ownsInitialContent ? 'owner' : 'skip' }}</code>
        <code>onlineUserIds={{ onlineUserIds.join(', ') }}</code>
        <code>doc-updates={{ docUpdateCount }}</code>
        <code>content-fragment={{ contentFragmentLength }}</code>
      </div>

      <div v-if="collaborationEnabled" class="playground-info">
        <input
          v-model="debugValue"
          class="playground-debug-input"
          type="text"
          placeholder="shared yjs debug text"
          @input="handleDebugTextChange"
        />
      </div>
      <div class="mainEdit">
         <RichTextEditor
          v-if="canMountEditor"
          ref="editorRef"
          v-model="content"
          :document-name="documentName"
          :collaboration="collaborationOptions"
          :comments="comments"
          :comment-user="commentUser"
          :show-comments="false"
          :upload-image="(payload) => uploadToGateway(payload, 'image')"
          :upload-video="(payload) => uploadToGateway(payload, 'video')"
          :upload-file="(payload) => uploadToGateway(payload, 'file')"
          :upload-comment-image="uploadCommentImage"
          :comment-mention-provider="handleCommentMentionSearch"
          :outlinePlacement="'left'"
          :mode="editorMode"
          :editable="editorMode === 'edit'"
          @update:model-value="handleContentUpdate"
          @mention-search="handleMentionSearch"
          @mention-item-click="handleMentionItemClick"
          @mention-submit="handleMentionSubmit"
          @comment-create="handleCommentCreate"
          @comment-reply="handleCommentReply"
          @comment-update="handleCommentUpdate"
          @comment-delete="handleCommentDelete"
          @comment-resolve="handleCommentResolve"
          @comment-submit="handleCommentSubmit"
          @comment-mention-item-click="handleCommentMentionItemClick"
          @comment-mention-submit="handleCommentMentionSubmit"
          :mention="true"
          :show-outline="true"
        />
        <div v-else class="playground-loading">正在同步协同房间...</div>
      </div>
     
    </div>
  </div>
</template>
