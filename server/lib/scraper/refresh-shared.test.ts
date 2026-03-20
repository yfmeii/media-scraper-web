import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ensureSeasonPath, resolveMoviePaths, writeShowAssets } from './refresh-shared';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('scraper refresh helpers', () => {
  test('resolveMoviePaths returns directory and first video when path is directory', async () => {
    const root = join(tmpdir(), `refresh-helper-${Date.now()}`);
    const movieDir = join(root, 'Movie');
    await mkdir(movieDir, { recursive: true });
    await writeFile(join(movieDir, 'note.txt'), 'x');
    await writeFile(join(movieDir, 'Movie.mkv'), 'video');

    const resolved = await resolveMoviePaths(movieDir);

    expect(resolved.movieDir).toBe(movieDir);
    expect(resolved.movieFilePath).toBe(join(movieDir, 'Movie.mkv'));
    await rm(root, { recursive: true, force: true });
  });

  test('ensureSeasonPath returns null when season folder is missing', async () => {
    const root = join(tmpdir(), `refresh-season-${Date.now()}`);
    await mkdir(root, { recursive: true });

    const result = await ensureSeasonPath(root, 2);

    expect(result).toBeNull();
    await rm(root, { recursive: true, force: true });
  });

  test('ensureSeasonPath returns season folder when present', async () => {
    const root = join(tmpdir(), `refresh-season-hit-${Date.now()}`);
    const seasonDir = join(root, 'Season 02');
    await mkdir(seasonDir, { recursive: true });

    const result = await ensureSeasonPath(root, 2);

    expect(result).toBe(seasonDir);
    await rm(root, { recursive: true, force: true });
  });

  test('writeShowAssets writes poster and fanart when fetch succeeds', async () => {
    const root = join(tmpdir(), `refresh-assets-${Date.now()}`);
    await mkdir(root, { recursive: true });
    globalThis.fetch = async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 });

    await writeShowAssets(root, '/poster.jpg', '/fanart.jpg');

    expect(await Bun.file(join(root, 'poster.jpg')).exists()).toBe(true);
    expect(await Bun.file(join(root, 'fanart.jpg')).exists()).toBe(true);
    await rm(root, { recursive: true, force: true });
  });

  test('resolveMoviePaths returns file path when input is already a file', async () => {
    const root = join(tmpdir(), `refresh-file-${Date.now()}`);
    await mkdir(root, { recursive: true });
    const moviePath = join(root, 'Movie.mkv');
    await writeFile(moviePath, 'video');

    const resolved = await resolveMoviePaths(moviePath);

    expect(resolved.movieDir).toBe(root);
    expect(resolved.movieFilePath).toBe(moviePath);
    await rm(root, { recursive: true, force: true });
  });
});
