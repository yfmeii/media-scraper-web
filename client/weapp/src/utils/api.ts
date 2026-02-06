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
import {
  DEFAULT_LANGUAGE,
  CLIENT_API_ENDPOINTS,
  createEmptyMatchResult,
  createEmptyPreviewPlan,
  createEmptyTaskStats,
} from '@media-scraper/shared'
import { get, post } from './request'

// ── Stats ──
export async function fetchStats(): Promise<Stats> {
  const res = await get<Stats>(CLIENT_API_ENDPOINTS.fetchStats)
  return res.data!
}

// ── Media ──
export async function fetchTVShows(): Promise<ShowInfo[]> {
  const res = await get<ShowInfo[]>(CLIENT_API_ENDPOINTS.fetchTVShows)
  return res.data || []
}

export async function fetchMovies(): Promise<MovieInfo[]> {
  const res = await get<MovieInfo[]>(CLIENT_API_ENDPOINTS.fetchMovies)
  return res.data || []
}

// ── Inbox ──
export async function fetchInbox(): Promise<MediaFile[]> {
  const res = await get<MediaFile[]>(CLIENT_API_ENDPOINTS.fetchInbox)
  return res.data || []
}

export async function fetchInboxByDirectory(): Promise<DirectoryGroup[]> {
  const res = await get<DirectoryGroup[]>(CLIENT_API_ENDPOINTS.fetchInboxByDirectory)
  return res.data || []
}

// ── Search & Match ──
export async function searchTMDB(type: 'tv' | 'movie', query: string, year?: number): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query })
  if (year) params.set('year', year.toString())
  const res = await get<SearchResult[]>(`${CLIENT_API_ENDPOINTS.searchTMDBBase}/${type}?${params}`)
  return res.data || []
}

export async function autoMatch(
  path: string,
  kind: 'tv' | 'movie',
  title?: string,
  year?: number,
  language = DEFAULT_LANGUAGE,
): Promise<MatchResult> {
  const res = await post<MatchResult>(CLIENT_API_ENDPOINTS.autoMatch, { path, kind, title, year, language })
  return res.data || createEmptyMatchResult()
}

export async function recognizePath(path: string, kind: 'tv' | 'movie'): Promise<PathRecognizeResult | null> {
  const res = await post<PathRecognizeResult>(CLIENT_API_ENDPOINTS.recognizePath, { path, kind })
  return res.success ? (res.data ?? null) : null
}

// ── Process ──
export async function processTV(params: ProcessTVParams): Promise<ScrapeResult> {
  const res = await post<{ message?: string }>(CLIENT_API_ENDPOINTS.processTV, params as unknown as Record<string, unknown>)
  return { success: res.success, message: res.error || res.data?.message }
}

export async function processMovie(params: ProcessMovieParams): Promise<ScrapeResult> {
  const res = await post<{ message?: string }>(CLIENT_API_ENDPOINTS.processMovie, params as unknown as Record<string, unknown>)
  return { success: res.success, message: res.error || res.data?.message }
}

// ── Preview ──
export async function previewPlan(items: PreviewItem[], language = DEFAULT_LANGUAGE): Promise<PreviewPlan> {
  const res = await post<PreviewPlan>(CLIENT_API_ENDPOINTS.previewPlan, { items, language })
  return res.data || createEmptyPreviewPlan()
}

// ── Refresh ──
export async function refreshMetadata(
  kind: 'tv' | 'movie',
  path: string,
  tmdbId: number,
  options?: { season?: number, episode?: number, language?: string },
): Promise<ScrapeResult> {
  const { season, episode, language = DEFAULT_LANGUAGE } = options || {}
  const res = await post<{ message?: string }>(CLIENT_API_ENDPOINTS.refreshMetadata, { kind, path, tmdbId, season, episode, language })
  return { success: res.success, message: res.error || res.data?.message, taskId: res.taskId }
}

// ── Tasks ──
export async function fetchTasks(limit = 10): Promise<{ tasks: TaskItem[], stats: TaskStats }> {
  const res = await get<TaskItem[]>(`${CLIENT_API_ENDPOINTS.fetchTasks}?limit=${limit}`)
  return {
    tasks: res.data || [],
    stats: (res as unknown as { stats: TaskStats }).stats || createEmptyTaskStats(),
  }
}

// ── Move to Inbox ──
export async function moveToInbox(sourcePath: string): Promise<{ success: boolean, message?: string }> {
  const res = await post<{ message?: string }>(CLIENT_API_ENDPOINTS.moveToInbox, { sourcePath })
  return { success: res.success, message: res.error || res.data?.message }
}
