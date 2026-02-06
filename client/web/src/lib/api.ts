import {
  DEFAULT_LANGUAGE,
  CLIENT_API_ENDPOINTS,
  createEmptyMatchResult,
  createEmptyPreviewPlan,
  createEmptyTaskStats,
} from '@media-scraper/shared';
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
  const res = await fetch(`${API_BASE}${CLIENT_API_ENDPOINTS.fetchStats}`);
  const data = await res.json();
  return data.data;
}

export async function fetchTVShows(): Promise<ShowInfo[]> {
  const res = await fetch(`${API_BASE}${CLIENT_API_ENDPOINTS.fetchTVShows}`);
  const data = await res.json();
  return data.data || [];
}

export async function fetchMovies(): Promise<MovieInfo[]> {
  const res = await fetch(`${API_BASE}${CLIENT_API_ENDPOINTS.fetchMovies}`);
  const data = await res.json();
  return data.data || [];
}

export async function fetchInbox(): Promise<MediaFile[]> {
  const res = await fetch(`${API_BASE}${CLIENT_API_ENDPOINTS.fetchInbox}`);
  const data = await res.json();
  return data.data || [];
}

export async function fetchInboxByDirectory(): Promise<DirectoryGroup[]> {
  const res = await fetch(`${API_BASE}${CLIENT_API_ENDPOINTS.fetchInboxByDirectory}`);
  const data = await res.json();
  return data.data || [];
}

export async function searchTMDB(type: 'tv' | 'movie', query: string, year?: number): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query });
  if (year) params.set('year', year.toString());
  const res = await fetch(`${API_BASE}${CLIENT_API_ENDPOINTS.searchTMDBBase}/${type}?${params}`);
  const data = await res.json();
  return data.data || [];
}

export async function fetchTasks(limit = 10): Promise<{ tasks: TaskItem[]; stats: TaskStats }> {
  const res = await fetch(`${API_BASE}${CLIENT_API_ENDPOINTS.fetchTasks}?limit=${limit}`);
  const data = await res.json();
  return {
    tasks: data.data || [],
    stats: data.stats || createEmptyTaskStats(),
  };
}

export async function cancelTaskApi(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}${CLIENT_API_ENDPOINTS.cancelTask}/${id}/cancel`, { method: 'POST' });
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
  const res = await fetch(`${API_BASE}${CLIENT_API_ENDPOINTS.refreshMetadata}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, path, tmdbId, season, episode, language }),
  });
  const data = await res.json();
  return { success: data.success, message: data.error || data.data?.message, taskId: data.taskId };
}

// AI 路径识别
export async function recognizePath(path: string, kind: 'tv' | 'movie'): Promise<PathRecognizeResult | null> {
  const res = await fetch(`${API_BASE}${CLIENT_API_ENDPOINTS.recognizePath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, kind }),
  });
  const data = await res.json();
  return data.success ? data.data : null;
}

export async function autoMatch(path: string, kind: 'tv' | 'movie', title?: string, year?: number, language = DEFAULT_LANGUAGE): Promise<MatchResult> {
  const res = await fetch(`${API_BASE}${CLIENT_API_ENDPOINTS.autoMatch}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, kind, title, year, language }),
  });
  const data = await res.json();
  return data.data || createEmptyMatchResult();
}

export async function processTV(params: ProcessTVParams): Promise<ScrapeResult> {
  const res = await fetch(`${API_BASE}${CLIENT_API_ENDPOINTS.processTV}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  return { success: data.success, message: data.error || data.message };
}

export async function processMovie(params: ProcessMovieParams): Promise<ScrapeResult> {
  const res = await fetch(`${API_BASE}${CLIENT_API_ENDPOINTS.processMovie}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  return { success: data.success, message: data.error || data.message };
}

// Move file back to inbox
export async function moveToInbox(sourcePath: string): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}${CLIENT_API_ENDPOINTS.moveToInbox}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourcePath }),
  });
  const data = await res.json();
  return { success: data.success, message: data.error || data.message };
}

export async function previewPlan(items: PreviewItem[], language = DEFAULT_LANGUAGE): Promise<PreviewPlan> {
  const res = await fetch(`${API_BASE}${CLIENT_API_ENDPOINTS.previewPlan}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, language }),
  });
  const data = await res.json();
  return data.data || createEmptyPreviewPlan();
}
