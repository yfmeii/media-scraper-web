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

// ── Media File Extensions ──

export const VIDEO_EXTS = ['.mkv', '.mp4', '.m4v', '.avi', '.mov'] as const;
export const SUB_EXTS = ['.srt', '.ass', '.ssa', '.sub'] as const;
export const NFO_EXTS = ['.nfo'] as const;

// ── Formatting Utilities ──

/** Format file size in human-readable units (B/KB/MB/GB/TB) */
export function formatFileSize(bytes: number | undefined): string {
  if (bytes == null || bytes === 0) return bytes === 0 ? '0 B' : '?';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

/** Format date value (timestamp, string, or Date) to YYYY-MM-DD */
export function formatDate(value: number | string | Date | undefined): string {
  if (!value) return '--';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '--';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Format a season number as "Season XX" */
export function formatSeason(season: number): string {
  return `Season ${String(season).padStart(2, '0')}`;
}

/** Format an episode number as "EXX" */
export function formatEpisode(episode: number): string {
  return `E${String(episode).padStart(2, '0')}`;
}

/** Format season+episode as "SXXEXX" */
export function formatSeasonEpisode(season: number, episode: number): string {
  return `S${String(season).padStart(2, '0')}${formatEpisode(episode)}`;
}

/** Format a rating number to one decimal place */
export function formatRating(rating: number | undefined): string {
  if (!rating) return '--';
  return rating.toFixed(1);
}

/** Format runtime in minutes to "Xh Xm" or "Xm" */
export function formatRuntime(minutes: number | undefined): string {
  if (!minutes) return '--';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Get human-readable label for a media kind */
export function getMediaKindLabel(kind: MediaKind | string): string {
  switch (kind) {
    case 'tv': return '剧集';
    case 'movie': return '电影';
    default: return '未知';
  }
}

/** Normalize 'unknown' media kind to 'movie' (default fallback) */
export function normalizeMediaKind(kind: string): 'tv' | 'movie' {
  return kind === 'tv' ? 'tv' : 'movie';
}

// ── Missing Episodes Detection ──

export interface SeasonMissingInfo {
  season: number;
  missing: number[];
}

/** Detect missing episodes in a season by finding gaps between min and max episode numbers */
export function getSeasonMissingEpisodes(episodes: MediaFile[]): number[] {
  const epNums = episodes
    .map(e => e.parsed.episode)
    .filter((n): n is number => n != null && n > 0);
  if (epNums.length < 2) return [];
  const min = Math.min(...epNums);
  const max = Math.max(...epNums);
  const have = new Set(epNums);
  const missing: number[] = [];
  for (let i = min; i <= max; i++) {
    if (!have.has(i)) missing.push(i);
  }
  return missing;
}

/** Detect missing episodes across all seasons of a show */
export function getShowMissingEpisodes(show: ShowInfo): SeasonMissingInfo[] {
  return show.seasons
    .map(s => ({ season: s.season, missing: getSeasonMissingEpisodes(s.episodes) }))
    .filter(s => s.missing.length > 0);
}

/** Format missing episodes as SxxExx badges string */
export function formatMissingSxEx(missingList: SeasonMissingInfo[]): string {
  return missingList
    .flatMap(s =>
      s.missing.map(
        ep => `S${String(s.season).padStart(2, '0')}E${String(ep).padStart(2, '0')}`,
      ),
    )
    .join(', ');
}
