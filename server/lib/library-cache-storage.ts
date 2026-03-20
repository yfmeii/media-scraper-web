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

type LibraryCacheRow = {
  payload: string;
  source_mtime_ms: number;
  updated_at: number;
  last_verified_at: number;
  expires_at: number;
  payload_version: number;
};

export function parseCachedPayload<T>(payload: string): T | null {
  try {
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
}

export async function readCachedEntry<T>(kind: CacheEntryKind, path: string): Promise<CacheReadResult<T>> {
  const row = selectLibraryEntryStmt.get(path, kind) as LibraryCacheRow | null;

  if (!row) {
    return { hit: false, data: null, reason: 'missing' };
  }

  const parsed = parseCachedPayload<T>(row.payload);
  if (!parsed || row.payload_version !== LIBRARY_CACHE_PAYLOAD_VERSION) {
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

export async function writeCachedEntry(kind: CacheEntryKind, path: string, payload: unknown): Promise<void> {
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

export function deleteCachedEntry(path: string, kind: CacheEntryKind): void {
  deleteLibraryEntryStmt.run(path, kind);
}

export async function refreshCachedEntry(path: string, kind: CacheEntryKind): Promise<void> {
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
