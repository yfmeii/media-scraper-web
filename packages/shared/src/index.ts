export type MediaKind = 'tv' | 'movie' | 'unknown';

// Default language for TMDB and related APIs
export const DEFAULT_LANGUAGE = 'zh-CN' as const;

export interface ParsedInfo {
  title: string;
  year?: number;
  season?: number;
  episode?: number;
  episodeEnd?: number;
  resolution?: string;
  source?: string;
  codec?: string;
}

export interface MediaFile {
  path: string;
  name: string;
  relativePath: string;
  size: number;
  kind: MediaKind;
  parsed: ParsedInfo;
  hasNfo: boolean;
  isProcessed: boolean;
}

export interface AssetFlags {
  hasPoster: boolean;
  hasNfo: boolean;
  hasFanart?: boolean;
}

export interface SeasonInfo {
  season: number;
  episodes: MediaFile[];
  hasNfo?: boolean;
  assets?: AssetFlags;
}

export interface ShowInfo {
  path: string;
  name: string;
  year?: number;
  seasons: SeasonInfo[];
  hasNfo: boolean;
  isProcessed: boolean;
  posterPath?: string;
  overview?: string;
  status?: string;
  backdropPath?: string;
  voteAverage?: number;
  assets?: AssetFlags;
  tmdbId?: number;
  groupStatus?: 'scraped' | 'unscraped' | 'supplement';
  supplementCount?: number;
}

export interface MovieInfo {
  path: string;
  name: string;
  year?: number;
  file: MediaFile;
  hasNfo: boolean;
  isProcessed: boolean;
  posterPath?: string;
  overview?: string;
  tagline?: string;
  runtime?: number;
  backdropPath?: string;
  voteAverage?: number;
  assets?: AssetFlags;
  tmdbId?: number;
}

export interface DirectoryGroup {
  path: string;
  name: string;
  files: MediaFile[];
  summary: {
    total: number;
    tv: number;
    movie: number;
    unknown: number;
  };
}

export type TaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
export type TaskType = 'scrape' | 'process' | 'refresh' | 'supplement' | 'fix-assets';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: '等待',
  running: '进行中',
  success: '完成',
  failed: '失败',
  cancelled: '已取消',
};

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  scrape: '刮削',
  process: '处理',
  refresh: '刷新',
  supplement: '补刮',
  'fix-assets': '修复资产',
};

export interface TaskItem {
  id: string;
  type: TaskType;
  target: string;
  status: TaskStatus;
  progress: number;
  message?: string;
  eta?: number;
  logs: string[];
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
}

export interface TaskStats {
  pending: number;
  running: number;
  success: number;
  failed: number;
  total: number;
  cancelled?: number;
}

export interface ScrapePlanAction {
  type: 'move' | 'create-nfo' | 'download-poster' | 'create-dir';
  source?: string;
  destination: string;
  willOverwrite: boolean;
}

export interface ScrapePlan {
  actions: ScrapePlanAction[];
  impactSummary: {
    filesMoving: number;
    nfoCreating: number;
    nfoOverwriting: number;
    postersDownloading: number;
    directoriesCreating: string[];
  };
}

export type PreviewAction = ScrapePlanAction;
export type PreviewPlan = ScrapePlan;

export interface Stats {
  tvShows: number;
  tvEpisodes: number;
  tvProcessed: number;
  movies: number;
  moviesProcessed: number;
  inbox: number;
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

export interface ScrapeResult {
  success: boolean;
  message?: string;
  taskId?: string;
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

export interface PathRecognizeResult {
  path: string;
  title: string;
  media_type: 'tv' | 'movie';
  year: number | null;
  season: number | null;
  episode: number | null;
  tmdb_id: number | null;
  tmdb_name: string | null;
  confidence: number;
  reason: string;
}

export interface ProcessTVParams {
  sourcePath: string;
  showName: string;
  tmdbId: number;
  season: number;
  episodes: Array<{ source: string; episode: number; episodeEnd?: number }>;
  language?: string;
}

export interface ProcessMovieParams {
  sourcePath: string;
  tmdbId: number;
  language?: string;
}

export interface PreviewItem {
  sourcePath: string;
  kind: 'tv' | 'movie';
  tmdbId?: number;
  showName?: string;
  season?: number;
  episodes?: Array<{ source: string; episode: number; episodeEnd?: number }>;
}
