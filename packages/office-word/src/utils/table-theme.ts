export type TableThemeColors = {
  header: string
  odd: string
  even: string
}

export const tableThemePresets = [
  { id: 'blue', name: '经典蓝', header: '#1670d2', odd: '#e8f2ff', even: '#ffffff' },
  { id: 'green', name: '清新绿', header: '#21864b', odd: '#e7f5ec', even: '#ffffff' },
  { id: 'purple', name: '优雅紫', header: '#7950c5', odd: '#f0eafa', even: '#ffffff' },
  { id: 'orange', name: '活力橙', header: '#c75312', odd: '#fff0e5', even: '#ffffff' },
  { id: 'pink', name: '玫瑰粉', header: '#c9346d', odd: '#fceaf1', even: '#ffffff' },
  { id: 'gray', name: '简约灰', header: '#586574', odd: '#edf0f3', even: '#ffffff' },
] as const

export function normalizeTableTheme(value: unknown): TableThemeColors | null {
  if (!value || typeof value !== 'object') return null
  const colors = value as Partial<TableThemeColors>
  if (![colors.header, colors.odd, colors.even].every(color => typeof color === 'string' && /^#[\da-f]{6}$/i.test(color))) {
    return null
  }
  return { header: colors.header!.toLowerCase(), odd: colors.odd!.toLowerCase(), even: colors.even!.toLowerCase() }
}

function getHeaderTextColor(color: string) {
  const channels = [1, 3, 5].map(offset => {
    const value = Number.parseInt(color.slice(offset, offset + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  return luminance > 0.179 ? '#16213a' : '#ffffff'
}

export function getTableThemeHTMLAttributes(value: unknown): Record<string, string> {
  const theme = normalizeTableTheme(value)
  if (!theme) return {}
  return {
    'data-table-theme': 'true',
    'data-table-theme-header': theme.header,
    'data-table-theme-odd': theme.odd,
    'data-table-theme-even': theme.even,
    style: `--norio-office-rich-table-header:${theme.header};--norio-office-rich-table-header-text:${getHeaderTextColor(theme.header)};--norio-office-rich-table-odd:${theme.odd};--norio-office-rich-table-even:${theme.even};`,
  }
}
