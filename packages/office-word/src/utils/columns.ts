export const MAX_COLUMNS = 4
export const MIN_COLUMN_WIDTH = 10

function roundWidth(value: number) {
  return Math.round(value * 1000) / 1000
}

export function createEqualColumnWidths(count: number) {
  if (count <= 0) {
    return []
  }

  const base = 100 / count
  const widths = Array.from({ length: count }, () => roundWidth(base))
  const total = widths.reduce((sum, width) => sum + width, 0)
  widths[count - 1] = roundWidth(widths[count - 1] + (100 - total))
  return widths
}

export function normalizeColumnWidths(input: unknown, count: number) {
  if (count <= 0) {
    return []
  }

  if (!Array.isArray(input) || input.length !== count) {
    return createEqualColumnWidths(count)
  }

  const values = input
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)

  if (values.length !== count) {
    return createEqualColumnWidths(count)
  }

  let total = values.reduce((sum, value) => sum + value, 0)
  if (total <= 0) {
    return createEqualColumnWidths(count)
  }

  const widths = values.map((value) => (value / total) * 100)
  const minTotal = MIN_COLUMN_WIDTH * count
  if (minTotal > 100) {
    return createEqualColumnWidths(count)
  }

  let expandable = widths.map((width) => width)
  let adjusted = expandable.map((width) => (width < MIN_COLUMN_WIDTH ? MIN_COLUMN_WIDTH : width))
  let diff = adjusted.reduce((sum, width) => sum + width, 0) - 100

  while (diff > 0.001) {
    const flexibleIndexes = adjusted
      .map((width, index) => ({ width, index }))
      .filter(({ width }) => width > MIN_COLUMN_WIDTH + 0.001)

    if (!flexibleIndexes.length) {
      return createEqualColumnWidths(count)
    }

    const share = diff / flexibleIndexes.length
    let consumed = 0

    flexibleIndexes.forEach(({ index }) => {
      const available = adjusted[index] - MIN_COLUMN_WIDTH
      const delta = Math.min(available, share)
      adjusted[index] -= delta
      consumed += delta
    })

    if (consumed <= 0.001) {
      return createEqualColumnWidths(count)
    }

    diff -= consumed
  }

  adjusted = adjusted.map((width) => roundWidth(width))
  total = adjusted.reduce((sum, width) => sum + width, 0)
  adjusted[count - 1] = roundWidth(adjusted[count - 1] + (100 - total))
  return adjusted
}
