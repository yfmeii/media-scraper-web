import { CLIENT_API_ENDPOINTS, DEFAULT_LANGUAGE } from './constants';
import { createEmptyMatchResult, createEmptyPreviewPlan, createEmptyTaskStats } from './defaults';
import type {
  ClientApiEnvelope,
  ClientApiTransport,
  MatchResult,
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
  DirectoryGroup,
  MediaFile,
} from './types';

type SearchTMDBType = 'tv' | 'movie' | 'multi';

function toScrapeResult(response: ClientApiEnvelope<{ message?: string }>): ScrapeResult {
  return {
    success: response.success,
    message: response.error || response.message || response.data?.message,
    taskId: response.taskId,
  };
}

function resolveSearchTMDBArgs(
  typeOrQuery: SearchTMDBType | string,
  queryOrYear?: string | number,
  maybeYear?: number,
): { type: SearchTMDBType; query: string; year?: number } {
  const hasType = typeOrQuery === 'tv' || typeOrQuery === 'movie' || typeOrQuery === 'multi';
  return {
    type: hasType ? typeOrQuery : 'multi',
    query: hasType ? String(queryOrYear || '') : String(typeOrQuery || ''),
    year: hasType ? maybeYear : (typeof queryOrYear === 'number' ? queryOrYear : undefined),
  };
}

function resolveAutoMatchArgs(
  path: string,
  kindOrTitle?: 'tv' | 'movie' | string,
  titleOrYear?: string | number,
  yearOrLanguage?: number | string,
  maybeLanguage?: string,
): { path: string; kind?: 'tv' | 'movie'; title?: string; year?: number; language: string } {
  const hasKind = kindOrTitle === 'tv' || kindOrTitle === 'movie';
  return {
    path,
    kind: hasKind ? kindOrTitle : undefined,
    title: hasKind
      ? (typeof titleOrYear === 'string' ? titleOrYear : undefined)
      : (typeof kindOrTitle === 'string' ? kindOrTitle : undefined),
    year: hasKind
      ? (typeof yearOrLanguage === 'number' ? yearOrLanguage : (typeof titleOrYear === 'number' ? titleOrYear : undefined))
      : (typeof titleOrYear === 'number' ? titleOrYear : undefined),
    language: hasKind
      ? (typeof maybeLanguage === 'string' ? maybeLanguage : (typeof yearOrLanguage === 'string' ? yearOrLanguage : DEFAULT_LANGUAGE))
      : (typeof yearOrLanguage === 'string' ? yearOrLanguage : DEFAULT_LANGUAGE),
  };
}

export function createClientApi(transport: ClientApiTransport) {
  async function fetchStats(): Promise<Stats> {
    const res = await transport.get<Stats>(CLIENT_API_ENDPOINTS.fetchStats);
    return res.data!;
  }

  async function fetchTVShows(): Promise<ShowInfo[]> {
    const res = await transport.get<ShowInfo[]>(CLIENT_API_ENDPOINTS.fetchTVShows);
    return res.data || [];
  }

  async function fetchTVShowDetail(path: string): Promise<ShowInfo | null> {
    const params = new URLSearchParams({ path });
    const res = await transport.get<ShowInfo>(`${CLIENT_API_ENDPOINTS.fetchTVShowDetail}?${params}`);
    return res.data || null;
  }

  async function fetchMovies(): Promise<MovieInfo[]> {
    const res = await transport.get<MovieInfo[]>(CLIENT_API_ENDPOINTS.fetchMovies);
    return res.data || [];
  }

  async function fetchMovieDetail(path: string): Promise<MovieInfo | null> {
    const params = new URLSearchParams({ path });
    const res = await transport.get<MovieInfo>(`${CLIENT_API_ENDPOINTS.fetchMovieDetail}?${params}`);
    return res.data || null;
  }

  async function fetchInbox(): Promise<MediaFile[]> {
    const res = await transport.get<MediaFile[]>(CLIENT_API_ENDPOINTS.fetchInbox);
    return res.data || [];
  }

  async function fetchInboxByDirectory(): Promise<DirectoryGroup[]> {
    const res = await transport.get<DirectoryGroup[]>(CLIENT_API_ENDPOINTS.fetchInboxByDirectory);
    return res.data || [];
  }

  async function searchTMDB(query: string, year?: number): Promise<SearchResult[]>;
  async function searchTMDB(type: SearchTMDBType, query: string, year?: number): Promise<SearchResult[]>;
  async function searchTMDB(
    typeOrQuery: SearchTMDBType | string,
    queryOrYear?: string | number,
    maybeYear?: number,
  ): Promise<SearchResult[]> {
    const { type, query, year } = resolveSearchTMDBArgs(typeOrQuery, queryOrYear, maybeYear);
    if (!query.trim()) return [];
    const params = new URLSearchParams({ q: query });
    if (year) params.set('year', year.toString());
    const res = await transport.get<SearchResult[]>(`${CLIENT_API_ENDPOINTS.searchTMDBBase}/${type}?${params}`);
    return res.data || [];
  }

  async function searchTMDBByImdb(imdbId: string, language = DEFAULT_LANGUAGE): Promise<SearchResult[]> {
    const normalized = imdbId.trim();
    if (!normalized) return [];
    const params = new URLSearchParams({ imdb_id: normalized, language });
    const res = await transport.get<SearchResult[]>(`${CLIENT_API_ENDPOINTS.searchTMDBByImdb}?${params}`);
    return res.data || [];
  }

  async function fetchTasks(limit = 10): Promise<{ tasks: TaskItem[]; stats: TaskStats }> {
    const res = await transport.get<TaskItem[]>(`${CLIENT_API_ENDPOINTS.fetchTasks}?limit=${limit}`);
    return {
      tasks: res.data || [],
      stats: (res.stats as TaskStats | undefined) || createEmptyTaskStats(),
    };
  }

  async function cancelTaskApi(id: string): Promise<boolean> {
    const res = await transport.post(CLIENT_API_ENDPOINTS.cancelTask + `/${id}/cancel`);
    return res.success;
  }

  async function refreshMetadata(
    kind: 'tv' | 'movie',
    path: string,
    tmdbId: number,
    options?: { season?: number; episode?: number; language?: string },
  ): Promise<ScrapeResult> {
    const { season, episode, language = DEFAULT_LANGUAGE } = options || {};
    const res = await transport.post<{ message?: string }>(CLIENT_API_ENDPOINTS.refreshMetadata, {
      kind,
      path,
      tmdbId,
      season,
      episode,
      language,
    });
    return toScrapeResult(res);
  }

  async function recognizePath(path: string, kind?: 'tv' | 'movie'): Promise<PathRecognizeResult | null> {
    const res = await transport.post<PathRecognizeResult>(
      CLIENT_API_ENDPOINTS.recognizePath,
      kind ? { path, kind } : { path },
    );
    return res.success ? (res.data ?? null) : null;
  }

  async function autoMatch(path: string, title?: string, year?: number, language?: string): Promise<MatchResult>;
  async function autoMatch(path: string, kind: 'tv' | 'movie', title?: string, year?: number, language?: string): Promise<MatchResult>;
  async function autoMatch(
    path: string,
    kindOrTitle?: 'tv' | 'movie' | string,
    titleOrYear?: string | number,
    yearOrLanguage?: number | string,
    maybeLanguage?: string,
  ): Promise<MatchResult> {
    const payload = resolveAutoMatchArgs(path, kindOrTitle, titleOrYear, yearOrLanguage, maybeLanguage);
    const res = await transport.post<MatchResult>(CLIENT_API_ENDPOINTS.autoMatch, payload as unknown as Record<string, unknown>);
    return res.data || createEmptyMatchResult();
  }

  async function processTV(params: ProcessTVParams): Promise<ScrapeResult> {
    const res = await transport.post<{ message?: string }>(CLIENT_API_ENDPOINTS.processTV, params as unknown as Record<string, unknown>);
    return toScrapeResult(res);
  }

  async function processMovie(params: ProcessMovieParams): Promise<ScrapeResult> {
    const res = await transport.post<{ message?: string }>(CLIENT_API_ENDPOINTS.processMovie, params as unknown as Record<string, unknown>);
    return toScrapeResult(res);
  }

  async function moveToInbox(sourcePath: string): Promise<{ success: boolean; message?: string }> {
    const res = await transport.post<{ message?: string }>(CLIENT_API_ENDPOINTS.moveToInbox, { sourcePath });
    return { success: res.success, message: res.error || res.message || res.data?.message };
  }

  async function previewPlan(items: PreviewItem[], language = DEFAULT_LANGUAGE): Promise<PreviewPlan> {
    const res = await transport.post<PreviewPlan>(CLIENT_API_ENDPOINTS.previewPlan, { items, language });
    return res.data || createEmptyPreviewPlan();
  }

  return {
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
  };
}
