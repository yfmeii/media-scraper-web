import type { Context } from 'hono';
import { DEFAULT_LANGUAGE } from '@media-scraper/shared/constants';
import { invalidateLibraryCache } from '../lib/library-cache';
import { invalidateMovieCache, invalidateTVShowCache } from '../lib/library-cache-invalidation';
import { processMovie, processTVShow } from '../lib/scraper/process';
import { refreshMetadata } from '../lib/scraper/refresh';
import {
  isNonEmptyString,
  parseTVEpisodes,
  toPositiveInteger,
  type ParseResult,
  type TVEpisodeInput,
} from './scrape-request';
import { badRequest } from './route-utils';
export { handleMoveToInbox } from './scrape-process-move';
export { handlePreview } from './scrape-process-preview';

type ProcessTVRequest = {
  sourcePath: string;
  showName: string;
  tmdbId: number;
  season: number;
  episodes: TVEpisodeInput[];
  language: string;
};

type ProcessMovieRequest = {
  sourcePath: string;
  tmdbId: number;
  language: string;
};

type RefreshRequest = {
  kind: 'tv' | 'movie';
  path: string;
  tmdbId: number;
  season?: number;
  episode?: number;
  language: string;
};

function parseProcessTVBody(body: any): ParseResult<ProcessTVRequest> {
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

function parseProcessMovieBody(body: any): ParseResult<ProcessMovieRequest> {
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

function parseRefreshBody(body: any): ParseResult<RefreshRequest> {
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

async function processTV(payload: ProcessTVRequest) {
  const result = await processTVShow(
    payload.sourcePath,
    payload.showName,
    payload.tmdbId,
    payload.season,
    payload.episodes,
    payload.language,
  );

  if (result.success && result.destPath) {
    await invalidateTVShowCache(result.destPath);
  }

  return result;
}

async function processMovieRoute(payload: ProcessMovieRequest) {
  const result = await processMovie(payload.sourcePath, payload.tmdbId, payload.language);

  if (result.success && result.destPath) {
    await invalidateMovieCache(result.destPath);
  }

  return result;
}

async function refreshRoute(payload: RefreshRequest) {
  const result = await refreshMetadata(
    payload.kind,
    payload.path,
    payload.tmdbId,
    payload.season,
    payload.episode,
    payload.language,
  );

  if (result.success) {
    await invalidateLibraryCache(payload.path, payload.kind);
  }

  return result;
}

export async function handleProcessTV(c: Context) {
  const parsed = parseProcessTVBody(await c.req.json());
  if (!parsed.ok) {
    return badRequest(c, parsed.error);
  }

  return c.json(await processTV(parsed.data));
}

export async function handleProcessMovie(c: Context) {
  const parsed = parseProcessMovieBody(await c.req.json());
  if (!parsed.ok) {
    return badRequest(c, parsed.error);
  }

  return c.json(await processMovieRoute(parsed.data));
}

export async function handleRefresh(c: Context) {
  const parsed = parseRefreshBody(await c.req.json());
  if (!parsed.ok) {
    return badRequest(c, parsed.error);
  }

  return c.json(await refreshRoute(parsed.data));
}
