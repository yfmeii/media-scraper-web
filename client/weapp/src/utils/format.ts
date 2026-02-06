/**
 * WeApp formatting utilities.
 *
 * Common formatters are re-exported from @media-scraper/shared.
 * Only WeApp-specific helpers (truncateFilename) are defined locally.
 *
 * NOTE: format.wxs still has its own copies because WXS cannot import
 * external packages — this is a WeChat platform limitation.
 */
export {
  formatFileSize,
  formatDate,
  formatRating,
  formatRuntime,
  getMediaKindLabel,
  normalizeMediaKind,
  formatSeason,
  formatEpisode,
  formatSeasonEpisode,
} from '@media-scraper/shared'

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
