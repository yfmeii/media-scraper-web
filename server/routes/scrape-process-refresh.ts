import type { Context } from 'hono';
import { refreshMetadata } from '../lib/scraper/refresh';
import { parseRefreshBody } from './scrape-request';
import { badRequest } from './route-utils';
import { invalidateLibraryCache } from '../lib/library-cache';

export async function handleRefresh(c: Context) {
  const parsed = parseRefreshBody(await c.req.json());
  const payload = parsed.ok
    ? parsed.data
    : { kind: undefined, path: undefined, tmdbId: undefined, season: undefined, episode: undefined, language: undefined };
  const { kind, path, tmdbId, season, episode, language } = payload;

  console.log('[refresh] Request:', { kind, path, tmdbId, season, episode, language });

  if (!parsed.ok) {
    console.log('[refresh] Missing required parameters');
    return badRequest(c, parsed.error);
  }

  const result = await refreshMetadata(kind, path, tmdbId, season, episode, language);
  if (result.success) {
    await invalidateLibraryCache(path, kind);
  }
  console.log('[refresh] Result:', result);
  return c.json(result);
}
