export const dividerDefaultColor = '#dfe5ee'

export const dividerStyles = [
  { value: 'solid', label: '实线' },
  { value: 'dashed', label: '虚线' },
  { value: 'dotted', label: '点状线' },
] as const

export function normalizeDividerStyle(value: unknown) {
  return dividerStyles.find(item => item.value === value)?.value ?? 'solid'
}

export function normalizeDividerColor(value: unknown): string | null {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value.toLowerCase() : null
}
