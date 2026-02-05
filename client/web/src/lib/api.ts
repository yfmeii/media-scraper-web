import { DEFAULT_LANGUAGE } from '@media-scraper/shared';
import type {
  Stats,
  SearchResult,
  ScrapeResult,
  MatchResult,
  PathRecognizeResult,
  ProcessTVParams,
  ProcessMovieParams,
  PreviewItem,
  MediaFile,
  ShowInfo,
  MovieInfo,
  DirectoryGroup,
  TaskItem,
  TaskStats,
  PreviewAction,
  PreviewPlan,
} from '@media-scraper/shared';

export type {
  Stats,
  SearchResult,
  ScrapeResult,
  MatchResult,
  PathRecognizeResult,
  ProcessTVParams,
  ProcessMovieParams,
  PreviewItem,
  MediaFile,
  ShowInfo,
  MovieInfo,
  DirectoryGroup,
  TaskItem,
  TaskStats,
  PreviewAction,
  PreviewPlan
} from '@media-scraper/shared';

const API_BASE = '/api';

export async function fetchStats(): Promise<Stats> {
  const res = await fetch(`${API_BASE}/media/stats`);
  const data = await res.json();
  return data.data;
}

export async function fetchTVShows(): Promise<ShowInfo[]> {
  const res = await fetch(`${API_BASE}/media/tv?include=assets&group=status`);
  const data = await res.json();
  return data.data || [];
}

export async function fetchMovies(): Promise<MovieInfo[]> {
  const res = await fetch(`${API_BASE}/media/movies?include=assets`);
  const data = await res.json();
  return data.data || [];
}

export async function fetchInbox(): Promise<MediaFile[]> {
  const res = await fetch(`${API_BASE}/media/inbox`);
  const data = await res.json();
  return data.data || [];
}

export async function fetchInboxByDirectory(): Promise<DirectoryGroup[]> {
  const res = await fetch(`${API_BASE}/media/inbox?view=dir`);
  const data = await res.json();
  return data.data || [];
}

export async function searchTMDB(type: 'tv' | 'movie', query: string, year?: number): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query });
  if (year) params.set('year', year.toString());
  const res = await fetch(`${API_BASE}/scrape/search/${type}?${params}`);
  const data = await res.json();
  return data.data || [];
}

export async function fetchTasks(limit = 10): Promise<{ tasks: TaskItem[]; stats: TaskStats }> {
  const res = await fetch(`${API_BASE}/tasks?limit=${limit}`);
  const data = await res.json();
  return {
    tasks: data.data || [],
    stats: data.stats || { total: 0, pending: 0, running: 0, success: 0, failed: 0 },
  };
}

export async function fetchTaskStats(): Promise<TaskStats> {
  const res = await fetch(`${API_BASE}/tasks/stats`);
  const data = await res.json();
  return data.data || { total: 0, pending: 0, running: 0, success: 0, failed: 0 };
}

export async function cancelTaskApi(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/tasks/${id}/cancel`, { method: 'POST' });
  const data = await res.json();
  return data.success;
}

// Scrape APIs
export async function refreshMetadata(
  kind: 'tv' | 'movie', 
  path: string, 
  tmdbId: number, 
  options?: { season?: number; episode?: number; language?: string }
): Promise<ScrapeResult> {
  const { season, episode, language = DEFAULT_LANGUAGE } = options || {};
  const res = await fetch(`${API_BASE}/scrape/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, path, tmdbId, season, episode, language }),
  });
  const data = await res.json();
  return { success: data.success, message: data.error || data.data?.message, taskId: data.taskId };
}

// AI 路径识别
export async function recognizePath(path: string, kind: 'tv' | 'movie'): Promise<PathRecognizeResult | null> {
  const res = await fetch(`${API_BASE}/scrape/recognize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, kind }),
  });
  const data = await res.json();
  return data.success ? data.data : null;
}

export async function autoMatch(path: string, kind: 'tv' | 'movie', title?: string, year?: number, language = DEFAULT_LANGUAGE): Promise<MatchResult> {
  const res = await fetch(`${API_BASE}/scrape/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, kind, title, year, language }),
  });
  const data = await res.json();
  return data.data || { matched: false, candidates: [] };
}

export async function processTV(params: ProcessTVParams): Promise<ScrapeResult> {
  const res = await fetch(`${API_BASE}/scrape/process/tv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  return { success: data.success, message: data.error || data.message };
}

export async function processMovie(params: ProcessMovieParams): Promise<ScrapeResult> {
  const res = await fetch(`${API_BASE}/scrape/process/movie`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  return { success: data.success, message: data.error || data.message };
}

// Move file back to inbox
export async function moveToInbox(sourcePath: string): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/scrape/move-to-inbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourcePath }),
  });
  const data = await res.json();
  return { success: data.success, message: data.error || data.message };
}

export async function previewPlan(items: PreviewItem[], language = DEFAULT_LANGUAGE): Promise<PreviewPlan> {
  const res = await fetch(`${API_BASE}/scrape/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, language }),
  });
  const data = await res.json();
  return data.data || { actions: [], impactSummary: { filesMoving: 0, nfoCreating: 0, nfoOverwriting: 0, postersDownloading: 0, directoriesCreating: [] } };
}
