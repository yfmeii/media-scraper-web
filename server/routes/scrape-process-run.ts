import type { Context } from 'hono';
import { processMovie, processTVShow } from '../lib/scraper/process';
import { parseProcessMovieBody, parseProcessTVBody } from './scrape-request';
import { badRequest } from './route-utils';
import { invalidateTVShowCache, invalidateMovieCache } from '../lib/library-cache-invalidation';

export async function handleProcessTV(c: Context) {
  const parsed = parseProcessTVBody(await c.req.json());
  if (!parsed.ok) {
    return badRequest(c, parsed.error);
  }

  const { sourcePath, showName, tmdbId, season, episodes, language } = parsed.data;
  const result = await processTVShow(sourcePath, showName, tmdbId, season, episodes, language);
  if (result.success && result.destPath) {
    await invalidateTVShowCache(result.destPath);
  }
  return c.json(result);
}

export async function handleProcessMovie(c: Context) {
  const parsed = parseProcessMovieBody(await c.req.json());
  if (!parsed.ok) {
    return badRequest(c, parsed.error);
  }

  const { sourcePath, tmdbId, language } = parsed.data;
  const result = await processMovie(sourcePath, tmdbId, language);
  if (result.success && result.destPath) {
    await invalidateMovieCache(result.destPath);
  }
  return c.json(result);
}
