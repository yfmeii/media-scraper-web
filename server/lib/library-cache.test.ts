import { beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { deleteCachedEntry, readCachedEntry, refreshCachedEntry, writeCachedEntry, parseCachedPayload } from './library-cache-storage';

describe('library cache policy', () => {
  const root = join(tmpdir(), `media-cache-${Date.now()}`);

  beforeEach(async () => {
    await rm(root, { recursive: true, force: true });
    await mkdir(root, { recursive: true });
  });

  test('parseCachedPayload returns null for invalid json', () => {
    expect(parseCachedPayload('{oops')).toBeNull();
  });

  test('write/read cycle returns cache hit before expiry', async () => {
    const showDir = join(root, 'Show');
    await mkdir(showDir, { recursive: true });
    await writeFile(join(showDir, 'tvshow.nfo'), '<tvshow />', 'utf8');

    await writeCachedEntry('tv', showDir, { name: 'Show', seasonCount: 1 });
    const result = await readCachedEntry<{ name: string; seasonCount: number }>('tv', showDir);

    expect(result.hit).toBe(true);
    expect(result.reason).toBe('hit');
    expect(result.data).toEqual({ name: 'Show', seasonCount: 1 });
  });

  test('refreshCachedEntry keeps payload readable', async () => {
    const movieDir = join(root, 'Movie');
    await mkdir(movieDir, { recursive: true });
    await writeFile(join(movieDir, 'Movie.nfo'), '<movie />', 'utf8');

    await writeCachedEntry('movie', movieDir, { name: 'Movie', year: 2024 });
    await refreshCachedEntry(movieDir, 'movie');

    const result = await readCachedEntry<{ name: string; year: number }>('movie', movieDir);
    expect(result.hit).toBe(true);
    expect(result.data?.year).toBe(2024);
  });

  test('deleteCachedEntry removes stored payload', async () => {
    const showDir = join(root, 'DeleteMe');
    await mkdir(showDir, { recursive: true });
    await writeCachedEntry('tv', showDir, { ok: true });
    deleteCachedEntry(showDir, 'tv');

    const result = await readCachedEntry('tv', showDir);
    expect(result).toEqual({ hit: false, data: null, reason: 'missing' });
  });
});
