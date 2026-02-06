import type {
  DirectoryGroup,
  MatchResult,
  MediaFile,
  MovieInfo,
  PathRecognizeResult,
  PreviewItem,
  PreviewPlan,
  ProcessMovieParams,
  ProcessTVParams,
  ScrapeResult,
  SearchResult,
  ShowInfo,
  Stats,
  TaskItem,
  TaskStats,
} from '@media-scraper/shared'
import { DEFAULT_LANGUAGE } from '@media-scraper/shared'
import { get, post } from './request'

// ── Stats ──
export async function fetchStats(): Promise<Stats> {
  const res = await get<Stats>('/media/stats')
  return res.data!
}

// ── Media ──
export async function fetchTVShows(): Promise<ShowInfo[]> {
  const res = await get<ShowInfo[]>('/media/tv?include=assets&group=status')
  return res.data || []
}

export async function fetchMovies(): Promise<MovieInfo[]> {
  const res = await get<MovieInfo[]>('/media/movies?include=assets')
  return res.data || []
}

// ── Inbox ──
export async function fetchInbox(): Promise<MediaFile[]> {
  const res = await get<MediaFile[]>('/media/inbox')
  return res.data || []
}

export async function fetchInboxByDirectory(): Promise<DirectoryGroup[]> {
  const res = await get<DirectoryGroup[]>('/media/inbox?view=dir')
  return res.data || []
}

// ── Search & Match ──
export async function searchTMDB(type: 'tv' | 'movie', query: string, year?: number): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query })
  if (year) params.set('year', year.toString())
  const res = await get<SearchResult[]>(`/scrape/search/${type}?${params}`)
  return res.data || []
}

export async function autoMatch(
  path: string,
  kind: 'tv' | 'movie',
  title?: string,
  year?: number,
  language = DEFAULT_LANGUAGE,
): Promise<MatchResult> {
  const res = await post<MatchResult>('/scrape/match', { path, kind, title, year, language })
  return res.data || { matched: false, candidates: [] }
}

export async function recognizePath(path: string, kind: 'tv' | 'movie'): Promise<PathRecognizeResult | null> {
  const res = await post<PathRecognizeResult>('/scrape/recognize', { path, kind })
  return res.success ? (res.data ?? null) : null
}

// ── Process ──
export async function processTV(params: ProcessTVParams): Promise<ScrapeResult> {
  const res = await post<{ message?: string }>('/scrape/process/tv', params as unknown as Record<string, unknown>)
  return { success: res.success, message: res.error || res.data?.message }
}

export async function processMovie(params: ProcessMovieParams): Promise<ScrapeResult> {
  const res = await post<{ message?: string }>('/scrape/process/movie', params as unknown as Record<string, unknown>)
  return { success: res.success, message: res.error || res.data?.message }
}

// ── Preview ──
export async function previewPlan(items: PreviewItem[], language = DEFAULT_LANGUAGE): Promise<PreviewPlan> {
  const res = await post<PreviewPlan>('/scrape/preview', { items, language })
  return res.data || {
    actions: [],
    impactSummary: {
      filesMoving: 0,
      nfoCreating: 0,
      nfoOverwriting: 0,
      postersDownloading: 0,
      directoriesCreating: [],
    },
  }
}

// ── Refresh ──
export async function refreshMetadata(
  kind: 'tv' | 'movie',
  path: string,
  tmdbId: number,
  options?: { season?: number, episode?: number, language?: string },
): Promise<ScrapeResult> {
  const { season, episode, language = DEFAULT_LANGUAGE } = options || {}
  const res = await post<{ message?: string }>('/scrape/refresh', { kind, path, tmdbId, season, episode, language })
  return { success: res.success, message: res.error || res.data?.message, taskId: res.taskId }
}

// ── Tasks ──
export async function fetchTasks(limit = 10): Promise<{ tasks: TaskItem[], stats: TaskStats }> {
  const res = await get<TaskItem[]>(`/tasks?limit=${limit}`)
  return {
    tasks: res.data || [],
    stats: (res as unknown as { stats: TaskStats }).stats || { total: 0, pending: 0, running: 0, success: 0, failed: 0 },
  }
}

// ── Move to Inbox ──
export async function moveToInbox(sourcePath: string): Promise<{ success: boolean, message?: string }> {
  const res = await post<{ message?: string }>('/scrape/move-to-inbox', { sourcePath })
  return { success: res.success, message: res.error || res.data?.message }
}
