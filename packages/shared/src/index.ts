export type MediaKind = 'tv' | 'movie' | 'unknown';

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

export interface ProgressEvent {
  type: 'start' | 'progress' | 'complete' | 'error';
  taskId: string;
  item?: string;
  current: number;
  total: number;
  percent: number;
  message?: string;
}
