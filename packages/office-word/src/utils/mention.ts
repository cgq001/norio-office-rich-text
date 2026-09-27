export const mentionAvatarColors = [
  '#4f7cff',
  '#22c55e',
  '#f97316',
  '#a855f7',
  '#06b6d4',
  '#ef4444',
  '#14b8a6',
  '#f59e0b',
  '#6366f1',
  '#ec4899',
  '#3b82f6',
  '#84cc16',
  '#fb7185',
  '#8b5cf6',
  '#0ea5e9',
  '#10b981',
  '#f43f5e',
  '#d946ef',
  '#2dd4bf',
  '#eab308',
]

export function getMentionAvatarText(name: string) {
  const chars = Array.from(name.trim())
  return chars.slice(-2).join('') || 'NA'
}

export function getMentionAvatarColor(id: string) {
  const chars = Array.from(String(id))
  const lastChar = chars[chars.length - 1] ?? '0'
  const colorIndex = lastChar.charCodeAt(0) % mentionAvatarColors.length
  return mentionAvatarColors[colorIndex]
}

export function getMentionAvatarStyle(id: string) {
  return {
    backgroundColor: getMentionAvatarColor(id),
  }
}
