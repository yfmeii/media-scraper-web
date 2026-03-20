import type { MediaFile, MovieInfo, ShowInfo } from '@media-scraper/shared/types';
import {
  deleteLibraryEntryStmt,
  selectLibraryEntryStmt,
  touchLibraryEntryStmt,
  upsertLibraryEntryStmt,
} from './library-cache-db';
import {
  type CacheEntryKind,
  type CacheReadResult,
  getDirectoryMtimeMs,
  getNextExpiry,
  LIBRARY_CACHE_PAYLOAD_VERSION,
} from './library-cache-meta';
import { buildMovieBaseSummary, buildShowBaseSummary, enrichShowStatus, mergeMovieDetail, mergeShowDetail } from './library-summary';

async function readCachedEntry<T>(kind: CacheEntryKind, path: string): Promise<CacheReadResult<T>> {
  const row = selectLibraryEntryStmt.get(path, kind) as {
    payload: string;
    source_mtime_ms: number;
    updated_at: number;
    last_verified_at: number;
    expires_at: number;
    payload_version: number;
  } | null;

  if (!row) {
    return { hit: false, data: null, reason: 'missing' };
  }

  let parsed: T;
  try {
    parsed = JSON.parse(row.payload) as T;
  } catch {
    deleteLibraryEntryStmt.run(path, kind);
    return { hit: false, data: null, reason: 'invalid_payload' };
  }

  if (row.payload_version !== LIBRARY_CACHE_PAYLOAD_VERSION) {
    deleteLibraryEntryStmt.run(path, kind);
    return { hit: false, data: null, reason: 'invalid_payload' };
  }

  const now = Date.now();
  if (row.expires_at > now) {
    touchLibraryEntryStmt.run(path, kind, now, row.last_verified_at || now, row.expires_at);
    return { hit: true, data: parsed, reason: 'hit' };
  }

  const currentMtimeMs = await getDirectoryMtimeMs(path);
  if (currentMtimeMs !== row.source_mtime_ms) {
    deleteLibraryEntryStmt.run(path, kind);
    return { hit: false, data: null, reason: 'mtime_changed' };
  }

  const nextExpiry = getNextExpiry(now);
  touchLibraryEntryStmt.run(path, kind, now, now, nextExpiry);
  return { hit: true, data: parsed, reason: 'expired' };
}

async function writeCachedEntry(kind: CacheEntryKind, path: string, payload: unknown): Promise<void> {
  const now = Date.now();
  const currentMtimeMs = await getDirectoryMtimeMs(path);
  const expiresAt = getNextExpiry(now);
  upsertLibraryEntryStmt.run(
    path,
    kind,
    JSON.stringify(payload),
    currentMtimeMs,
    LIBRARY_CACHE_PAYLOAD_VERSION,
    now,
    now,
    now,
    expiresAt,
  );
}

export async function getCachedShowSummary(params: {
  showPath: string;
  name: string;
  includeAssets: boolean;
  loadFiles: () => Promise<MediaFile[]>;
}): Promise<ShowInfo | null> {
  const cached = await readCachedEntry<ShowInfo>('tv', params.showPath);
  if (cached.hit) return cached.data;

  const files = await params.loadFiles();
  if (files.length === 0) {
    deleteLibraryEntryStmt.run(params.showPath, 'tv');
    return null;
  }

  const summary = await buildShowBaseSummary({
    showPath: params.showPath,
    name: params.name,
    files,
    includeAssets: params.includeAssets,
  });
  await writeCachedEntry('tv', params.showPath, summary);
  return summary;
}

export async function getCachedMovieSummary(params: {
  moviePath: string;
  entryName: string;
  includeAssets: boolean;
  loadMovieFile: () => Promise<MediaFile | null>;
}): Promise<MovieInfo | null> {
  const cached = await readCachedEntry<MovieInfo>('movie', params.moviePath);
  if (cached.hit) return cached.data;

  const movieFile = await params.loadMovieFile();
  if (!movieFile) {
    deleteLibraryEntryStmt.run(params.moviePath, 'movie');
    return null;
  }

  const summary = await buildMovieBaseSummary({
    moviePath: params.moviePath,
    entryName: params.entryName,
    movieFile,
    includeAssets: params.includeAssets,
  });
  await writeCachedEntry('movie', params.moviePath, summary);
  return summary;
}

export async function invalidateLibraryCache(path: string, kind: CacheEntryKind): Promise<void> {
  deleteLibraryEntryStmt.run(path, kind);
}

export async function refreshLibraryCache(path: string, kind: CacheEntryKind): Promise<void> {
  const row = selectLibraryEntryStmt.get(path, kind) as { payload: string } | null;
  if (!row) return;

  const now = Date.now();
  const currentMtimeMs = await getDirectoryMtimeMs(path);
  const nextExpiry = getNextExpiry(now);

  upsertLibraryEntryStmt.run(
    path,
    kind,
    row.payload,
    currentMtimeMs,
    LIBRARY_CACHE_PAYLOAD_VERSION,
    now,
    now,
    now,
    nextExpiry,
  );
}

export { enrichShowStatus, mergeMovieDetail, mergeShowDetail };
