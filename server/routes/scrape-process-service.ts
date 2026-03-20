import { invalidateLibraryCache } from '../lib/library-cache';
import { invalidateMovieCache, invalidateTVShowCache } from '../lib/library-cache-invalidation';
import { processMovie, processTVShow } from '../lib/scraper/process';
import { refreshMetadata } from '../lib/scraper/refresh';
import { parseProcessMovieBody, parseProcessTVBody, parseRefreshBody } from './scrape-request';

type ProcessTVRequest = Extract<ReturnType<typeof parseProcessTVBody>, { ok: true }>['data'];
type ProcessMovieRequest = Extract<ReturnType<typeof parseProcessMovieBody>, { ok: true }>['data'];
type RefreshRequest = Extract<ReturnType<typeof parseRefreshBody>, { ok: true }>['data'];

export async function runProcessTV(payload: ProcessTVRequest) {
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

export async function runProcessMovie(payload: ProcessMovieRequest) {
  const result = await processMovie(payload.sourcePath, payload.tmdbId, payload.language);

  if (result.success && result.destPath) {
    await invalidateMovieCache(result.destPath);
  }

  return result;
}

export async function runRefresh(payload: RefreshRequest) {
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
