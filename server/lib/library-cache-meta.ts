import { stat } from 'fs/promises';

export const LIBRARY_CACHE_PAYLOAD_VERSION = 2;
export const LIBRARY_CACHE_STALE_AFTER_MS = 5 * 60 * 1000;

export type CacheEntryKind = 'tv' | 'movie';

export type CacheReadResult<T> = {
  hit: boolean;
  data: T | null;
  reason: 'hit' | 'missing' | 'expired' | 'mtime_changed' | 'invalid_payload';
};

export async function getDirectoryMtimeMs(path: string): Promise<number> {
  try {
    const result = await stat(path);
    return Math.trunc(result.mtimeMs);
  } catch {
    return 0;
  }
}

export function getNextExpiry(now = Date.now()): number {
  return now + LIBRARY_CACHE_STALE_AFTER_MS;
}
