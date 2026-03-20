import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { fixMissingAssets, getSeasonNumberFromEntry, supplementTVShow } from './maintenance-shared';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('scraper maintenance helpers', () => {
  test('getSeasonNumberFromEntry parses season number and defaults to 1', () => {
    expect(getSeasonNumberFromEntry('Season 02')).toBe(2);
    expect(getSeasonNumberFromEntry('Specials')).toBe(1);
  });

  test('supplementTVShow returns failure when tvshow.nfo has no tmdb id', async () => {
    const root = join(tmpdir(), `supplement-no-tmdb-${Date.now()}`);
    await mkdir(root, { recursive: true });
    await writeFile(join(root, 'tvshow.nfo'), '<tvshow></tvshow>', 'utf-8');

    const result = await supplementTVShow(root, 'zh-CN');

    expect(result).toEqual({
      success: false,
      message: 'Cannot find TMDB ID in tvshow.nfo',
      processed: 0,
    });
    await rm(root, { recursive: true, force: true });
  });

  test('fixMissingAssets creates movie nfo when assets already exist', async () => {
    const root = join(tmpdir(), `fix-movie-assets-${Date.now()}`);
    const movieDir = join(root, 'Movie');
    const moviePath = join(movieDir, 'Movie.mkv');
    await mkdir(movieDir, { recursive: true });
    await writeFile(moviePath, 'video');
    await writeFile(join(movieDir, 'poster.jpg'), 'poster');
    await writeFile(join(movieDir, 'fanart.jpg'), 'fanart');

    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes('/movie/99')) {
        return new Response(JSON.stringify({
          id: 99,
          title: 'Movie',
          original_title: 'Movie',
          overview: 'Overview',
          poster_path: '/poster.jpg',
          backdrop_path: '/fanart.jpg',
          release_date: '2024-01-01',
          vote_average: 7,
          runtime: 120,
          genres: [],
        }), { status: 200 });
      }
      return new Response(new Uint8Array([1]), { status: 200 });
    };

    const result = await fixMissingAssets('movie', moviePath, 99, 'zh-CN');

    expect(result.success).toBe(true);
    expect(result.fixed).toEqual(['movie.nfo']);
    expect(await Bun.file(join(movieDir, 'Movie.nfo')).exists()).toBe(true);
    await rm(root, { recursive: true, force: true });
  });
});
