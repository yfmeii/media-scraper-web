import { DEFAULT_LANGUAGE } from '@media-scraper/shared/constants';

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type TVEpisodeInput = { source: string; episode: number; episodeEnd?: number };
type PreviewTVItem = {
  kind: 'tv';
  sourcePath: string;
  showName: string;
  tmdbId: number;
  season: number;
  episodes: TVEpisodeInput[];
};
type PreviewMovieItem = {
  kind: 'movie';
  sourcePath: string;
  tmdbId: number;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function toPositiveInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return null;
  }

  return value;
}

function parseTVEpisodes(episodes: unknown): TVEpisodeInput[] | null {
  if (!Array.isArray(episodes) || episodes.length === 0) {
    return null;
  }

  const parsed = episodes.map((episode) => {
    if (!episode || typeof episode !== 'object') return null;

    const source = isNonEmptyString((episode as Record<string, unknown>).source)
      ? (episode as Record<string, unknown>).source as string
      : null;
    const episodeNumber = toPositiveInteger((episode as Record<string, unknown>).episode);
    const episodeEndValue = (episode as Record<string, unknown>).episodeEnd;
    const episodeEnd = episodeEndValue === undefined ? undefined : toPositiveInteger(episodeEndValue);

    if (!source || !episodeNumber) return null;
    if (episodeEndValue !== undefined && !episodeEnd) return null;
    if (episodeEnd !== undefined && episodeEnd < episodeNumber) return null;

    return { source, episode: episodeNumber, episodeEnd };
  });

  return parsed.every(Boolean) ? (parsed as TVEpisodeInput[]) : null;
}

function parsePreviewItems(items: unknown): Array<PreviewTVItem | PreviewMovieItem> | null {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  const parsed = items.map((item) => {
    if (!item || typeof item !== 'object') return null;

    const input = item as Record<string, unknown>;
    if (!isNonEmptyString(input.sourcePath) || !toPositiveInteger(input.tmdbId)) {
      return null;
    }

    if (input.kind === 'movie') {
      return {
        kind: 'movie' as const,
        sourcePath: input.sourcePath,
        tmdbId: input.tmdbId as number,
      };
    }

    if (input.kind === 'tv') {
      const season = toPositiveInteger(input.season);
      const episodes = parseTVEpisodes(input.episodes);
      if (!isNonEmptyString(input.showName) || !season || !episodes) {
        return null;
      }

      return {
        kind: 'tv' as const,
        sourcePath: input.sourcePath,
        showName: input.showName,
        tmdbId: input.tmdbId as number,
        season,
        episodes,
      };
    }

    return null;
  });

  return parsed.every(Boolean) ? (parsed as Array<PreviewTVItem | PreviewMovieItem>) : null;
}

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
  episodes: TVEpisodeInput[];
  language: string;
}> {
  const { sourcePath, showName, tmdbId, season, episodes, language = DEFAULT_LANGUAGE } = body;
  const parsedTmdbId = toPositiveInteger(tmdbId);
  const parsedSeason = toPositiveInteger(season);
  const parsedEpisodes = parseTVEpisodes(episodes);

  if (!isNonEmptyString(sourcePath) || !isNonEmptyString(showName) || !parsedTmdbId || !parsedSeason || !parsedEpisodes) {
    return { ok: false, error: 'Missing required parameters' };
  }

  return {
    ok: true,
    data: { sourcePath, showName, tmdbId: parsedTmdbId, season: parsedSeason, episodes: parsedEpisodes, language },
  };
}

export function parseProcessMovieBody(body: any): ParseResult<{
  sourcePath: string;
  tmdbId: number;
  language: string;
}> {
  const { sourcePath, tmdbId, language = DEFAULT_LANGUAGE } = body;
  const parsedTmdbId = toPositiveInteger(tmdbId);

  if (!isNonEmptyString(sourcePath) || !parsedTmdbId) {
    return { ok: false, error: 'Missing required parameters' };
  }

  return {
    ok: true,
    data: { sourcePath, tmdbId: parsedTmdbId, language },
  };
}

export function parseMoveToInboxBody(body: any): { sourcePath: string | undefined } {
  return { sourcePath: body?.sourcePath };
}

export function parseRefreshBody(body: any): ParseResult<{
  kind: 'tv' | 'movie';
  path: string;
  tmdbId: number;
  season?: number;
  episode?: number;
  language: string;
}> {
  const { kind, path, tmdbId, season, episode, language = DEFAULT_LANGUAGE } = body;
  const parsedTmdbId = toPositiveInteger(tmdbId);
  const parsedSeason = season === undefined ? undefined : toPositiveInteger(season);
  const parsedEpisode = episode === undefined ? undefined : toPositiveInteger(episode);

  if ((kind !== 'tv' && kind !== 'movie') || !isNonEmptyString(path) || !parsedTmdbId) {
    return { ok: false, error: 'Missing required parameters' };
  }

  if ((season !== undefined && !parsedSeason) || (episode !== undefined && !parsedEpisode)) {
    return { ok: false, error: 'Missing required parameters' };
  }

  return {
    ok: true,
    data: { kind, path, tmdbId: parsedTmdbId, season: parsedSeason, episode: parsedEpisode, language },
  };
}

export function parsePreviewBody(body: any): ParseResult<{
  items: Array<PreviewTVItem | PreviewMovieItem>;
  language: string;
}> {
  const { items, language = DEFAULT_LANGUAGE } = body;
  const parsedItems = parsePreviewItems(items);
  if (!parsedItems) {
    return { ok: false, error: 'Missing items array' };
  }

  return {
    ok: true,
    data: { items: parsedItems, language },
  };
}
