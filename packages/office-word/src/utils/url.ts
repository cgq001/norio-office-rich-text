export function normalizeWebUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const url = new URL(candidate)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : ''
  } catch {
    return ''
  }
}

export function sanitizeImageUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  if (trimmed.startsWith('blob:')) {
    return trimmed
  }

  return normalizeWebUrl(trimmed)
}
