export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '-'
  }

  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ['KB', 'MB', 'GB'] as const
  let value = bytes / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(digits)} ${units[unitIndex]}`
}

export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) {
    return '-'
  }

  const percent = ratio * 100
  const digits = Math.abs(percent) >= 10 ? 0 : 1
  const sign = percent > 0 ? '-' : percent < 0 ? '+' : ''
  return `${sign}${Math.abs(percent).toFixed(digits)}%`
}

export function buildOutputName(inputName: string): string {
  const trimmed = inputName.trim() || 'image.png'
  const stem = trimmed.replace(/\.(png|apng|jpe?g|jfif|webp|avif|gif|bmp|ico|tiff?|heic|heif)$/i, '')
  return `${stem || 'image'}.quant.png`
}
