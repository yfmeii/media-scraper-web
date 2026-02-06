export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const size = bytes / 1024 ** i
  return `${size.toFixed(i > 1 ? 1 : 0)} ${units[i]}`
}

export function formatDate(ts: number | string | undefined): string {
  if (!ts) return '--'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatRating(rating: number | undefined): string {
  if (!rating) return '--'
  return rating.toFixed(1)
}

export function formatRuntime(minutes: number | undefined): string {
  if (!minutes) return '--'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function truncateFilename(name: string, maxLen = 28): string {
  if (name.length <= maxLen) return name
  const ext = name.lastIndexOf('.')
  if (ext > 0 && name.length - ext <= 5) {
    const base = name.substring(0, ext)
    const suffix = name.substring(ext)
    const trimLen = maxLen - suffix.length - 2
    return `${base.substring(0, trimLen)}..${suffix}`
  }
  return `${name.substring(0, maxLen - 2)}..`
}

export function getMediaKindLabel(kind: string): string {
  switch (kind) {
    case 'tv': return '剧集'
    case 'movie': return '电影'
    default: return '未知'
  }
}
