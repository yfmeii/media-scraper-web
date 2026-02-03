const API_BASE = '/api';

export interface Stats {
  tvShows: number;
  tvEpisodes: number;
  tvProcessed: number;
  movies: number;
  moviesProcessed: number;
  inbox: number;
}

export interface MediaFile {
  path: string;
  name: string;
  size: number;
  kind: 'tv' | 'movie' | 'unknown';
  parsed: {
    title: string;
    year?: number;
    season?: number;
    episode?: number;
    resolution?: string;
    codec?: string;
  };
  hasNfo: boolean;
  isProcessed: boolean;
}

export interface ShowInfo {
  path: string;
  name: string;
  year?: number;
  seasons: { season: number; episodes: MediaFile[] }[];
  hasNfo: boolean;
  isProcessed: boolean;
  groupStatus?: 'scraped' | 'unscraped' | 'supplement';
  assets?: { hasPoster: boolean; hasNfo: boolean; hasFanart: boolean };
  posterPath?: string;
  tmdbId?: number;
  supplementCount?: number;
}

export interface MovieInfo {
  path: string;
  name: string;
  year?: number;
  hasNfo: boolean;
  isProcessed: boolean;
  assets?: { hasPoster: boolean; hasNfo: boolean };
  posterPath?: string;
  tmdbId?: number;
}

export interface SearchResult {
  id: number;
  name?: string;
  title?: string;
  originalName?: string;
  originalTitle?: string;
  overview?: string;
  releaseDate?: string;
  firstAirDate?: string;
  voteAverage?: number;
  posterPath?: string;
}

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

export interface DirectoryGroup {
  path: string;
  name: string;
  files: MediaFile[];
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

// Task interfaces
export interface TaskItem {
  id: string;
  type: 'scrape' | 'ingest' | 'refresh' | 'scan' | 'batch';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  target: string;
  progress: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  logs?: string[];
}

export interface TaskStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
}

export async function fetchTasks(limit = 10): Promise<{ tasks: TaskItem[]; stats: TaskStats }> {
  const res = await fetch(`${API_BASE}/tasks?limit=${limit}`);
  const data = await res.json();
  return {
    tasks: data.data || [],
    stats: data.stats || { total: 0, pending: 0, running: 0, completed: 0, failed: 0, cancelled: 0 },
  };
}

export async function fetchTaskStats(): Promise<TaskStats> {
  const res = await fetch(`${API_BASE}/tasks/stats`);
  const data = await res.json();
  return data.data || { total: 0, pending: 0, running: 0, completed: 0, failed: 0, cancelled: 0 };
}

export async function fetchActiveTasks(): Promise<TaskItem[]> {
  const res = await fetch(`${API_BASE}/tasks/active`);
  const data = await res.json();
  return data.data || [];
}

export async function cancelTaskApi(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/tasks/${id}/cancel`, { method: 'POST' });
  const data = await res.json();
  return data.success;
}

// Scrape APIs
export interface ScrapeResult {
  success: boolean;
  message?: string;
  taskId?: string;
}

export async function scrapeShow(showPath: string, tmdbId: number, language = 'zh-CN'): Promise<ScrapeResult> {
  const res = await fetch(`${API_BASE}/scrape/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'tv', path: showPath, tmdbId, language }),
  });
  const data = await res.json();
  return { success: data.success, message: data.error || data.data?.message, taskId: data.taskId };
}

export async function supplementShow(showPath: string, language = 'zh-CN'): Promise<ScrapeResult> {
  const res = await fetch(`${API_BASE}/scrape/supplement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ showPath, language }),
  });
  const data = await res.json();
  return { success: data.success, message: data.error || data.data?.message, taskId: data.taskId };
}

export async function refreshMetadata(kind: 'tv' | 'movie', path: string, tmdbId: number, language = 'zh-CN'): Promise<ScrapeResult> {
  const res = await fetch(`${API_BASE}/scrape/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, path, tmdbId, language }),
  });
  const data = await res.json();
  return { success: data.success, message: data.error || data.data?.message, taskId: data.taskId };
}

export async function fixAssets(kind: 'tv' | 'movie', path: string, tmdbId: number, language = 'zh-CN'): Promise<ScrapeResult> {
  const res = await fetch(`${API_BASE}/scrape/fix-assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, path, tmdbId, language }),
  });
  const data = await res.json();
  return { success: data.success, message: data.error || data.data?.message, taskId: data.taskId };
}

export interface MatchResult {
  matched: boolean;
  result?: {
    id: number;
    name: string;
    originalName?: string;
    date?: string;
    posterPath?: string;
    score: number;
  };
  candidates: Array<{
    id: number;
    name: string;
    originalName?: string;
    date?: string;
    posterPath?: string;
    overview?: string;
  }>;
  ambiguous?: boolean;
}

export async function autoMatch(path: string, kind: 'tv' | 'movie', title?: string, year?: number, language = 'zh-CN'): Promise<MatchResult> {
  const res = await fetch(`${API_BASE}/scrape/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, kind, title, year, language }),
  });
  const data = await res.json();
  return data.data || { matched: false, candidates: [] };
}

// Batch scrape with disambiguation mode
export interface BatchScrapeItem {
  sourcePath: string;
  kind: 'tv' | 'movie';
  showName?: string;
  tmdbId?: number;
  season?: number;
  episodes?: Array<{ source: string; episode: number; episodeEnd?: number }>;
  candidates?: Array<{ id: number; name: string }>;
}

export interface BatchScrapeResult {
  success: boolean;
  processed: number;
  failed: number;
  taskId?: string;
}

export async function batchScrapeWithDisambiguation(
  items: BatchScrapeItem[],
  disambiguationMode: 'manual' | 'ai',
  language = 'zh-CN'
): Promise<BatchScrapeResult> {
  const res = await fetch(`${API_BASE}/scrape/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, disambiguationMode, language }),
  });
  const data = await res.json();
  return {
    success: data.success,
    processed: data.processed || 0,
    failed: data.failed || 0,
    taskId: data.taskId,
  };
}

// Process TV show from inbox
export interface ProcessTVParams {
  sourcePath: string;
  showName: string;
  tmdbId: number;
  season: number;
  episodes: Array<{ source: string; episode: number; episodeEnd?: number }>;
  language?: string;
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

// Process movie from inbox
export interface ProcessMovieParams {
  sourcePath: string;
  tmdbId: number;
  language?: string;
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

// Preview move plan
export interface PreviewItem {
  sourcePath: string;
  kind: 'tv' | 'movie';
  tmdbId?: number;
  showName?: string;
  season?: number;
  episodes?: Array<{ source: string; episode: number; episodeEnd?: number }>;
}

export interface PreviewAction {
  type: 'move' | 'create-nfo' | 'download-poster' | 'create-dir';
  source?: string;
  destination: string;
  willOverwrite: boolean;
}

export interface PreviewPlan {
  actions: PreviewAction[];
  impactSummary: {
    filesMoving: number;
    nfoCreating: number;
    nfoOverwriting: number;
    postersDownloading: number;
    directoriesCreating: string[];
  };
}

export async function previewPlan(items: PreviewItem[], language = 'zh-CN'): Promise<PreviewPlan> {
  const res = await fetch(`${API_BASE}/scrape/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, language }),
  });
  const data = await res.json();
  return data.data || { actions: [], impactSummary: { filesMoving: 0, nfoCreating: 0, nfoOverwriting: 0, postersDownloading: 0, directoriesCreating: [] } };
}

// SSE Progress subscription
export interface ProgressEvent {
  type: 'start' | 'progress' | 'complete' | 'error';
  taskId: string;
  item?: string;
  current: number;
  total: number;
  percent: number;
  message?: string;
}

export function subscribeToProgress(callback: (event: ProgressEvent) => void): () => void {
  const eventSource = new EventSource(`${API_BASE}/progress`);
  
  eventSource.addEventListener('progress', (e) => {
    try {
      const data = JSON.parse(e.data);
      callback(data);
    } catch {}
  });
  
  eventSource.onerror = () => {
    // Reconnect on error
    setTimeout(() => {
      eventSource.close();
    }, 1000);
  };
  
  return () => eventSource.close();
}
