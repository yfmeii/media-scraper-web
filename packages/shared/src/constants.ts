import type { TaskStatus, TaskType } from './types';

export const DEFAULT_LANGUAGE = 'zh-CN' as const;

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

export const CLIENT_API_ENDPOINTS = {
  fetchStats: '/media/stats',
  fetchTVShows: '/media/tv?include=assets&group=status&detail=summary',
  fetchTVShowDetail: '/media/tv/detail',
  fetchMovies: '/media/movies?include=assets&detail=summary',
  fetchMovieDetail: '/media/movies/detail',
  fetchInbox: '/media/inbox',
  fetchInboxByDirectory: '/media/inbox?view=dir',
  fetchTasks: '/tasks',
  fetchTaskStats: '/tasks/stats',
  cancelTask: '/tasks',
  searchTMDBBase: '/scrape/search',
  searchTMDBByImdb: '/scrape/search/imdb',
  refreshMetadata: '/scrape/refresh',
  recognizePath: '/scrape/recognize',
  autoMatch: '/scrape/match',
  processTV: '/scrape/process/tv',
  processMovie: '/scrape/process/movie',
  moveToInbox: '/scrape/move-to-inbox',
  previewPlan: '/scrape/preview',
} as const;

export const VIDEO_EXTS = ['.mkv', '.mp4', '.m4v', '.avi', '.mov'] as const;
export const SUB_EXTS = ['.srt', '.ass', '.ssa', '.sub'] as const;
export const NFO_EXTS = ['.nfo'] as const;
