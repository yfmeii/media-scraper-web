import { DEFAULT_LANGUAGE } from '@media-scraper/shared/constants';

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function parseSearchParams(query: { q?: string; year?: string; language?: string }): ParseResult<{
  query: string;
  year?: number;
  language: string;
}> {
  if (!query.q) {
    return { ok: false, error: 'Missing query parameter' };
  }

  return {
    ok: true,
    data: {
      query: query.q,
      year: query.year ? parseInt(query.year, 10) : undefined,
      language: query.language || DEFAULT_LANGUAGE,
    },
  };
}

export function parseImdbSearchParams(query: { imdb_id?: string; id?: string; language?: string }): ParseResult<{
  imdbId: string;
  language: string;
}> {
  const imdbId = query.imdb_id || query.id;
  if (!imdbId) {
    return { ok: false, error: 'Missing imdb_id parameter' };
  }

  return {
    ok: true,
    data: {
      imdbId,
      language: query.language || DEFAULT_LANGUAGE,
    },
  };
}

export function parseMatchBody(body: any): ParseResult<{
  path: string;
  kind: 'tv' | 'movie' | undefined;
  title?: string;
  year?: number;
  language: string;
}> {
  const { path, kind: inputKind, title, year, language = DEFAULT_LANGUAGE } = body;
  if (!path) {
    return { ok: false, error: 'Missing path' };
  }

  return {
    ok: true,
    data: {
      path,
      kind: inputKind === 'tv' || inputKind === 'movie' ? inputKind : undefined,
      title,
      year,
      language,
    },
  };
}

export function parseRecognizeBody(body: any): ParseResult<{
  filePath: string;
  language: string;
}> {
  const { path: filePath, language = DEFAULT_LANGUAGE } = body;
  if (!filePath) {
    return { ok: false, error: 'Missing path' };
  }

  return {
    ok: true,
    data: { filePath, language },
  };
}

export function parseProcessTVBody(body: any): ParseResult<{
  sourcePath: string;
  showName: string;
  tmdbId: number;
  season: number;
  episodes: unknown[];
  language: string;
}> {
  const { sourcePath, showName, tmdbId, season, episodes, language = DEFAULT_LANGUAGE } = body;
  if (!sourcePath || !showName || !tmdbId || !season || !episodes) {
    return { ok: false, error: 'Missing required parameters' };
  }

  return {
    ok: true,
    data: { sourcePath, showName, tmdbId, season, episodes, language },
  };
}

export function parseProcessMovieBody(body: any): ParseResult<{
  sourcePath: string;
  tmdbId: number;
  language: string;
}> {
  const { sourcePath, tmdbId, language = DEFAULT_LANGUAGE } = body;
  if (!sourcePath || !tmdbId) {
    return { ok: false, error: 'Missing required parameters' };
  }

  return {
    ok: true,
    data: { sourcePath, tmdbId, language },
  };
}

export function parseMoveToInboxBody(body: any): { sourcePath: string | undefined } {
  return { sourcePath: body?.sourcePath };
}

export function parseRefreshBody(body: any): ParseResult<{
  kind: string;
  path: string;
  tmdbId: number;
  season?: number;
  episode?: number;
  language: string;
}> {
  const { kind, path, tmdbId, season, episode, language = DEFAULT_LANGUAGE } = body;
  if (!kind || !path || !tmdbId) {
    return { ok: false, error: 'Missing required parameters' };
  }

  return {
    ok: true,
    data: { kind, path, tmdbId, season, episode, language },
  };
}

export function parsePreviewBody(body: any): ParseResult<{
  items: unknown[];
  language: string;
}> {
  const { items, language = DEFAULT_LANGUAGE } = body;
  if (!items || !Array.isArray(items)) {
    return { ok: false, error: 'Missing items array' };
  }

  return {
    ok: true,
    data: { items, language },
  };
}
