import type { MediaFile, MovieInfo, SeasonInfo, ShowInfo } from '@media-scraper/shared'

export function normalizeText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return fallback
  return trimmed
}

export function formatFileSizeLabel(size?: number): string {
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1)
  const value = size / (1024 ** index)
  return `${value.toFixed(index > 1 ? 1 : 0)} ${units[index]}`
}

export function formatVoteRating(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return ''
  return value.toFixed(1)
}

export function formatVoteRatingWithScale(value?: number): string {
  const rating = formatVoteRating(value)
  return rating ? `${rating} / 10` : '--'
}

export function getMediaFileDisplayName(file: Pick<MediaFile, 'name' | 'relativePath' | 'path' | 'parsed'>): string {
  return normalizeText(file.name)
    || normalizeText(file.relativePath)
    || normalizeText(file.parsed?.title)
    || normalizeText(file.path.split('/').pop())
    || '未知文件'
}

export function getMovieDisplayName(movie: Pick<MovieInfo, 'name' | 'path' | 'file'>): string {
  return normalizeText(movie.name)
    || normalizeText(movie.file?.name)
    || normalizeText(movie.path.split('/').pop())
    || '未命名电影'
}

export function getShowDisplayName(show: Pick<ShowInfo, 'name' | 'path'>): string {
  return normalizeText(show.name)
    || normalizeText(show.path.split('/').pop())
    || '未命名剧集'
}

export function getEpisodeTitle(ep: SeasonInfo['episodes'][number]): string {
  return normalizeText(ep.name)
    || normalizeText(ep.relativePath)
    || normalizeText(ep.path.split('/').pop())
    || '未命名剧集'
}

function padNumber(value?: number): string {
  const num = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
  return String(num).padStart(2, '0')
}

export function getEpisodeCode(ep: SeasonInfo['episodes'][number]): string {
  const season = typeof ep.parsed?.season === 'number' ? ep.parsed.season : 1
  const episode = typeof ep.parsed?.episode === 'number' ? ep.parsed.episode : 0
  const episodeEnd = typeof ep.parsed?.episodeEnd === 'number' ? ep.parsed.episodeEnd : 0
  if (episodeEnd > episode) {
    return `S${padNumber(season)}E${padNumber(episode)}-E${padNumber(episodeEnd)}`
  }
  return `S${padNumber(season)}E${padNumber(episode)}`
}

export function getInboxFileMeta(file: Pick<MediaFile, 'size' | 'relativePath' | 'kind' | 'parsed'>): string {
  const parsedTitle = normalizeText(file.parsed?.title)
  const year = file.parsed?.year ? ` (${file.parsed.year})` : ''
  if (parsedTitle) return `${parsedTitle}${year}`
  return formatFileSizeLabel(file.size) || normalizeText(file.relativePath) || file.kind || ''
}
