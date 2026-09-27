type RuntimeResponse<T = unknown> = {
  ok: boolean
  payload: T
}

type RuntimeDataFileContent = {
  contentType?: string
  revision?: string
  data: number[]
}

type RuntimeURLFileContent = {
  url: string
  mimeType?: string
  revision?: string
}

type RuntimeFileContent = RuntimeDataFileContent | RuntimeURLFileContent | Record<string, unknown>

type UploadAddress = {
  uploadId: string
  method?: string
  url: string
  headers?: Record<string, string>
}

type AssetRegistration = {
  assetId?: string
  url?: string
  name?: string
  mimeType?: string
  size?: number
}

type SaveResult = {
  fileId?: string
  revision?: string
  versionId?: string
  savedAt?: string
}

export type WebOfficeRuntimeBridge = ReturnType<typeof createWebOfficeRuntimeBridge>

export function createWebOfficeRuntimeBridge(params: URLSearchParams, officeType: string) {
  const gatewayEndpoint = trimTrailingSlash(params.get('gatewayEndpoint') || '')
  const gatewayContentUrl = params.get('gatewayContentUrl') || ''
  const appId = params.get('appId') || 'dev-app'
  const fileId = params.get('fileId') || params.get('roomId') || params.get('roomNo') || 'demo-file-001'
  const token = params.get('token') || ''
  const clientId = params.get('clientId') || params.get('clientUniqueCode') || ''

  async function request<T = unknown>(action: string, payload?: Record<string, unknown>): Promise<T> {
    if (window.parent && window.parent !== window) {
      return requestParent<T>(action, payload)
    }
    if (!gatewayEndpoint) {
      throw new Error('Missing gatewayEndpoint for WebOffice runtime action.')
    }
    return requestGateway<T>(action, payload)
  }

  async function readFileContent(): Promise<{ blob: Blob; contentType: string; revision: string }> {
    const directURL = gatewayContentUrl || (gatewayEndpoint ? `${gatewayEndpoint}/api/weboffice/files/${encodeURIComponent(fileId)}/content?officeType=${encodeURIComponent(officeType)}` : '')
    if (!directURL && !(window.parent && window.parent !== window)) {
      throw new Error('Missing gatewayContentUrl for file content.')
    }
    if (window.parent && window.parent !== window) {
      const result = await request<RuntimeFileContent>('file.content')
      return normalizeRuntimeFileContent(result)
    }
    const response = await fetch(directURL, { headers: requestHeaders(false) })
    if (!response.ok) {
      throw new Error(`Load file content failed: ${response.status}`)
    }
    const contentType = response.headers.get('Content-Type') || ''
    if (contentType.includes('application/json')) {
      const payload = await response.json() as RuntimeFileContent
      return normalizeRuntimeFileContent(payload)
    }
    return {
      blob: await response.blob(),
      contentType,
      revision: response.headers.get('X-Norio-Revision') || '',
    }
  }

  async function uploadAsset(file: File, payload: Record<string, unknown>) {
    const address = await request<UploadAddress>('asset.uploadAddress', {
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      purpose: 'asset',
    })
    await uploadToAddress(address, file)
    const asset = await request<AssetRegistration>('asset.register', {
      uploadId: address.uploadId,
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      metadata: payload,
      ...payload,
    })
    return {
      assetId: asset.assetId || address.uploadId,
      url: asset.url || address.url,
      name: asset.name || file.name,
      mimeType: asset.mimeType || file.type,
      size: asset.size || file.size,
    }
  }

  async function saveBlob(blob: Blob, options: { fileName: string; mimeType: string; saveType?: string; message?: string }) {
    const address = await request<UploadAddress>('save.uploadAddress', {
      fileName: options.fileName,
      mimeType: options.mimeType,
      size: blob.size,
      purpose: 'save',
    })
    await uploadToAddress(address, blob)
    return request<SaveResult>('save.complete', {
      uploadId: address.uploadId,
      fileName: options.fileName,
      mimeType: options.mimeType,
      size: blob.size,
      saveType: options.saveType || 'manual',
      message: options.message,
    })
  }

  async function registerExport(blob: Blob, options: { fileName: string; mimeType: string }) {
    const address = await request<UploadAddress>('export.uploadAddress', {
      fileName: options.fileName,
      mimeType: options.mimeType,
      size: blob.size,
      purpose: 'export',
    })
    await uploadToAddress(address, blob)
    return request<AssetRegistration>('export.register', {
      uploadId: address.uploadId,
      kind: 'export',
      name: options.fileName,
      mimeType: options.mimeType,
      size: blob.size,
    })
  }

  function hasGateway() {
    return Boolean(gatewayEndpoint || gatewayContentUrl || (window.parent && window.parent !== window))
  }

  return {
    appId,
    fileId,
    clientId,
    hasGateway,
    readFileContent,
    uploadAsset,
    saveBlob,
    registerExport,
  }

  function requestParent<T>(action: string, payload?: Record<string, unknown>) {
    const requestId = `runtime-${Date.now()}-${Math.random().toString(16).slice(2)}`
    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        window.removeEventListener('message', handleMessage)
        reject(new Error(`Gateway action timeout: ${action}`))
      }, 30000)

      const handleMessage = (event: MessageEvent) => {
        const data = event.data as RuntimeResponse<T> & { type?: string; requestId?: string }
        if (!data || data.type !== 'norio.weboffice.gateway.response' || data.requestId !== requestId) {
          return
        }
        window.clearTimeout(timer)
        window.removeEventListener('message', handleMessage)
        if (data.ok) {
          resolve(data.payload)
        } else {
          reject(data.payload)
        }
      }

      window.addEventListener('message', handleMessage)
      window.parent.postMessage({
        type: 'norio.weboffice.gateway.request',
        requestId,
        action,
        payload,
      }, '*')
    })
  }

  async function requestGateway<T>(action: string, payload?: Record<string, unknown>) {
    const path = gatewayPath(action)
    const method = action === 'file.content' ? 'GET' : 'POST'
    const response = await fetch(`${gatewayEndpoint}${path}`, {
      method,
      headers: requestHeaders(method === 'POST'),
      body: method === 'POST'
        ? JSON.stringify({ ...(payload ?? {}), officeType })
        : undefined,
    })
    if (!response.ok) {
      throw await response.json().catch(() => new Error(response.statusText))
    }
    return response.json() as Promise<T>
  }

  function gatewayPath(action: string) {
    const encodedFileId = encodeURIComponent(fileId)
    switch (action) {
      case 'file.content':
        return `/api/weboffice/files/${encodedFileId}/content?officeType=${encodeURIComponent(officeType)}`
      case 'asset.uploadAddress':
        return `/api/weboffice/files/${encodedFileId}/assets/upload-address`
      case 'asset.register':
        return `/api/weboffice/files/${encodedFileId}/assets`
      case 'save.uploadAddress':
        return `/api/weboffice/files/${encodedFileId}/save/upload-address`
      case 'save.complete':
        return `/api/weboffice/files/${encodedFileId}/save/complete`
      case 'export.uploadAddress':
        return `/api/weboffice/files/${encodedFileId}/export/upload-address`
      case 'export.register':
        return `/api/weboffice/files/${encodedFileId}/export/register`
      default:
        throw new Error(`Unsupported Gateway action: ${action}`)
    }
  }

  function requestHeaders(withJSON: boolean) {
    const headers: Record<string, string> = {
      'X-Norio-App-Id': appId,
      'X-Norio-Client-Id': clientId,
      'X-Norio-Room-Id': fileId,
    }
    if (withJSON) {
      headers['Content-Type'] = 'application/json'
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
    return headers
  }
}

async function normalizeRuntimeFileContent(payload: RuntimeFileContent) {
  if (hasURLFileContent(payload)) {
    const response = await fetch(payload.url)
    if (!response.ok) {
      throw new Error(`Download file content failed: ${response.status}`)
    }
    return {
      blob: await response.blob(),
      contentType: payload.mimeType || response.headers.get('Content-Type') || '',
      revision: payload.revision || response.headers.get('X-Norio-Revision') || '',
    }
  }
  if (hasDataFileContent(payload)) {
    const bytes = new Uint8Array(payload.data)
    return {
      blob: new Blob([bytes], { type: payload.contentType || 'application/octet-stream' }),
      contentType: payload.contentType || '',
      revision: payload.revision || '',
    }
  }
  const raw = JSON.stringify(payload)
  return {
    blob: new Blob([raw], { type: 'application/json' }),
    contentType: 'application/json',
    revision: isRecord(payload) && typeof payload.revision === 'string' ? payload.revision : '',
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasURLFileContent(value: RuntimeFileContent): value is RuntimeURLFileContent {
  if (!isRecord(value)) {
    return false
  }
  const record = value as Record<string, unknown>
  return typeof record.url === 'string'
}

function hasDataFileContent(value: RuntimeFileContent): value is RuntimeDataFileContent {
  if (!isRecord(value)) {
    return false
  }
  const record = value as Record<string, unknown>
  return Array.isArray(record.data)
}

async function uploadToAddress(address: UploadAddress, body: Blob) {
  const response = await fetch(address.url, {
    method: address.method || 'PUT',
    headers: address.headers ?? {},
    body,
  })
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`)
  }
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/u, '')
}
