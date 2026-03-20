import { invalidateLibraryCache } from './library-cache';
import { MEDIA_PATHS } from './config';
import type { CacheEntryKind } from './library-cache-meta';

export async function invalidateTVShowCache(destPath: string): Promise<void> {
  const showPath = destPath.replace(/\/Season \d+$/, '');
  await invalidateLibraryCache(showPath, 'tv');
}

export async function invalidateMovieCache(destPath: string): Promise<void> {
  await invalidateLibraryCache(destPath, 'movie');
}

export function resolveMoveToInboxCachePath(sourcePath: string): { kind: CacheEntryKind; cachePath: string } | null {
  if (!sourcePath) return null;

  const kind: CacheEntryKind = sourcePath.startsWith(MEDIA_PATHS.tv) ? 'tv' : 'movie';
  const cachePath = kind === 'tv'
    ? sourcePath.split('/Season ')[0] || sourcePath
    : sourcePath.substring(0, sourcePath.lastIndexOf('/'));

  return cachePath ? { kind, cachePath } : null;
}

export async function invalidateMovedItemCache(sourcePath: string): Promise<void> {
  const resolved = resolveMoveToInboxCachePath(sourcePath);
  if (!resolved) return;
  await invalidateLibraryCache(resolved.cachePath, resolved.kind);
}
