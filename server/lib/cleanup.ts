/**
 * Safe directory cleanup after file moves.
 *
 * Abstracted filesystem operations so the logic can be tested
 * with an in-memory mock without touching real disk.
 */
import { readdir, rmdir } from 'fs/promises';
import { extname } from 'path';
import { VIDEO_EXTS } from '@media-scraper/shared';
import { MEDIA_PATHS } from './config';

// ── Filesystem abstraction ──

export interface FileSystemOps {
  /** List entries (file/dir names) in a directory */
  readdir(dirPath: string): Promise<string[]>;
  /** Remove an empty directory (must NOT be recursive) */
  rmdir(dirPath: string): Promise<void>;
}

/** Real filesystem implementation */
export const realFs: FileSystemOps = {
  readdir: (dir) => readdir(dir),
  rmdir: (dir) => rmdir(dir),
};

// ── Protected directory helpers ──

const VIDEO_EXTS_SET = new Set(VIDEO_EXTS);

/** Normalize a path by stripping trailing slashes for reliable comparison */
function normalizePath(p: string): string {
  return p.replace(/\/+$/, '');
}

/**
 * Get the list of protected directory paths that must never be deleted.
 * Uses MEDIA_PATHS getters so env-var overrides always take effect.
 */
export function getProtectedDirs(): string[] {
  return [MEDIA_PATHS.inbox, MEDIA_PATHS.tv, MEDIA_PATHS.movies].map(normalizePath);
}

/** Check if a given path is a protected media root directory */
export function isProtectedDir(dirPath: string): boolean {
  const normalized = normalizePath(dirPath);
  return getProtectedDirs().includes(normalized);
}

/** Check if a filename has a video extension */
export function isVideoFile(name: string): boolean {
  return VIDEO_EXTS_SET.has(extname(name).toLowerCase());
}

// ── Cleanup logic ──

export interface CleanupResult {
  /** Whether the directory was actually removed */
  deleted: boolean;
  /** Reason for the action taken */
  reason: 'protected' | 'has-video' | 'not-empty' | 'deleted' | 'error' | 'already-gone';
}

/**
 * Safely clean up a source directory after files have been moved out.
 *
 * Rules:
 * 1. Never delete protected media root directories (inbox/tv/movies).
 * 2. Only delete if the directory contains no valid video files.
 * 3. Only remove the directory if it's completely empty.
 * 4. Leftover non-video files (nfo, images, srt) keep the directory alive.
 *
 * @param dirPath  - the directory to potentially clean up
 * @param fs       - filesystem operations (defaults to real fs; pass mock in tests)
 */
export async function cleanupSourceDir(
  dirPath: string,
  fs: FileSystemOps = realFs,
): Promise<CleanupResult> {
  try {
    // Rule 1: never touch protected directories
    if (isProtectedDir(dirPath)) {
      return { deleted: false, reason: 'protected' };
    }

    const entries = await fs.readdir(dirPath);

    // Rule 2: don't delete if any remaining file is a video
    if (entries.some(isVideoFile)) {
      return { deleted: false, reason: 'has-video' };
    }

    // Rule 3: only delete if truly empty
    if (entries.length === 0) {
      await fs.rmdir(dirPath);
      return { deleted: true, reason: 'deleted' };
    }

    // Rule 4: non-video leftover files → keep directory
    return { deleted: false, reason: 'not-empty' };
  } catch {
    // Directory might already be gone or inaccessible
    return { deleted: false, reason: 'error' };
  }
}
