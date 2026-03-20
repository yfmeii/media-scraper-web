import { createClientApi } from '@media-scraper/shared/client-api';
import type {
  ClientApiEnvelope,
  DirectoryGroup,
  MatchResult,
  MediaFile,
  MovieInfo,
  PathRecognizeResult,
  PreviewAction,
  PreviewItem,
  PreviewPlan,
  ProcessMovieParams,
  ProcessTVParams,
  ScrapeResult,
  Stats,
  SearchResult,
  ShowInfo,
  TaskItem,
  TaskStats,
} from '@media-scraper/shared/types';

export type {
  ClientApiEnvelope,
  DirectoryGroup,
  MatchResult,
  MediaFile,
  MovieInfo,
  PathRecognizeResult,
  PreviewAction,
  PreviewItem,
  PreviewPlan,
  ProcessMovieParams,
  ProcessTVParams,
  ScrapeResult,
  Stats,
  SearchResult,
  ShowInfo,
  TaskItem,
  TaskStats,
} from '@media-scraper/shared/types';

const API_BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<ClientApiEnvelope<T>> {
  const res = await fetch(`${API_BASE}${path}`, init);
  return res.json();
}

const api = createClientApi({
  get: path => request(path),
  post: (path, payload) => request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined,
  }),
});

export const {
  fetchStats,
  fetchTVShows,
  fetchTVShowDetail,
  fetchMovies,
  fetchMovieDetail,
  fetchInbox,
  fetchInboxByDirectory,
  searchTMDB,
  searchTMDBByImdb,
  fetchTasks,
  cancelTaskApi,
  refreshMetadata,
  recognizePath,
  autoMatch,
  processTV,
  processMovie,
  moveToInbox,
  previewPlan,
} = api;
