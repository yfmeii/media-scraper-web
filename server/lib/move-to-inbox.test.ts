import { afterAll, describe, expect, test } from 'bun:test';
import { access, mkdir, mkdtemp, readFile, rename, rm, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { moveMediaToInbox, MoveToInboxError } from './move-to-inbox';

let tempRoot = '';

async function ensureTempRoot() {
  if (!tempRoot) {
    tempRoot = await mkdtemp(join(tmpdir(), 'media-scraper-move-'));
  }
  return tempRoot;
}

afterAll(async () => {
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

describe('moveMediaToInbox', () => {
  test('moves video and subtitle back to inbox and removes generated nfo', async () => {
    const root = await ensureTempRoot();
    const inboxPath = join(root, 'Inbox');
    const tvPath = join(root, 'TV');
    const sourceDir = join(tvPath, 'Demo Show', 'Season 01');
    await mkdir(sourceDir, { recursive: true });
    await mkdir(inboxPath, { recursive: true });

    const sourcePath = join(sourceDir, 'Demo.Show.S01E01.mkv');
    const subtitlePath = join(sourceDir, 'Demo.Show.S01E01.srt');
    const nfoPath = join(sourceDir, 'Demo.Show.S01E01.nfo');
    await writeFile(sourcePath, 'video');
    await writeFile(subtitlePath, 'subtitle');
    await writeFile(nfoPath, '<episodedetails />');

    const result = await moveMediaToInbox(sourcePath, {
      inboxPath,
      tvPath,
      moviesPath: join(root, 'Movies'),
      move: rename,
      unlinkFile: unlink,
    });

    expect(result.success).toBe(true);
    expect(result.destPath).toBe(join(inboxPath, 'Demo.Show.S01E01.mkv'));
    expect(await readFile(result.destPath, 'utf-8')).toBe('video');
    expect(await readFile(join(inboxPath, 'Demo.Show.S01E01.srt'), 'utf-8')).toBe('subtitle');
    await expect(access(sourcePath)).rejects.toThrow();
    await expect(access(subtitlePath)).rejects.toThrow();
    await expect(access(nfoPath)).rejects.toThrow();
  });

  test('rejects paths outside library roots', async () => {
    const root = await ensureTempRoot();
    await expect(moveMediaToInbox(join(root, 'Elsewhere', 'movie.mkv'), {
      inboxPath: join(root, 'Inbox'),
      tvPath: join(root, 'TV'),
      moviesPath: join(root, 'Movies'),
      move: rename,
      unlinkFile: unlink,
    })).rejects.toEqual(expect.objectContaining<Partial<MoveToInboxError>>({
      message: 'File is not in library (TV/Movies)',
      status: 400,
    }));
  });
});
