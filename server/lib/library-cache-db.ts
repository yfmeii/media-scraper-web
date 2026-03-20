import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { Database } from 'bun:sqlite';

const DB_PATH = join(process.cwd(), '.cache', 'library-cache.sqlite');

mkdirSync(dirname(DB_PATH), { recursive: true });

export const libraryCacheDb = new Database(DB_PATH, { create: true });

libraryCacheDb.exec(`
  CREATE TABLE IF NOT EXISTS library_entries (
    path TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL,
    source_mtime_ms INTEGER NOT NULL,
    payload_version INTEGER NOT NULL DEFAULT 2,
    updated_at INTEGER NOT NULL,
    last_accessed_at INTEGER NOT NULL DEFAULT 0,
    last_verified_at INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_library_entries_kind ON library_entries(kind);
`);

function ensureColumn(name: string, definition: string) {
  const columns = libraryCacheDb.query<{ name: string }>('PRAGMA table_info(library_entries)').all() as Array<{ name: string }>;
  if (columns.some(column => column.name === name)) return;
  libraryCacheDb.exec(`ALTER TABLE library_entries ADD COLUMN ${name} ${definition}`);
}

ensureColumn('payload_version', 'INTEGER NOT NULL DEFAULT 2');
ensureColumn('last_accessed_at', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('last_verified_at', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('expires_at', 'INTEGER NOT NULL DEFAULT 0');

export const selectLibraryEntryStmt = libraryCacheDb.query<{
  payload: string;
  source_mtime_ms: number;
  updated_at: number;
  last_verified_at: number;
  expires_at: number;
  payload_version: number;
}>('SELECT payload, source_mtime_ms, updated_at, last_verified_at, expires_at, payload_version FROM library_entries WHERE path = ?1 AND kind = ?2');

export const upsertLibraryEntryStmt = libraryCacheDb.query(
  'INSERT INTO library_entries (path, kind, payload, source_mtime_ms, payload_version, updated_at, last_accessed_at, last_verified_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) ON CONFLICT(path) DO UPDATE SET kind = excluded.kind, payload = excluded.payload, source_mtime_ms = excluded.source_mtime_ms, payload_version = excluded.payload_version, updated_at = excluded.updated_at, last_accessed_at = excluded.last_accessed_at, last_verified_at = excluded.last_verified_at, expires_at = excluded.expires_at',
);

export const deleteLibraryEntryStmt = libraryCacheDb.query('DELETE FROM library_entries WHERE path = ?1 AND kind = ?2');

export const touchLibraryEntryStmt = libraryCacheDb.query(
  'UPDATE library_entries SET last_accessed_at = ?3, last_verified_at = ?4, expires_at = ?5 WHERE path = ?1 AND kind = ?2',
);
