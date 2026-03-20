import { describe, expect, test } from 'bun:test';
import {
  parseImdbSearchParams,
  parseMatchBody,
  parsePreviewBody,
  parseProcessMovieBody,
  parseProcessTVBody,
  parseRecognizeBody,
  parseRefreshBody,
  parseSearchParams,
} from './scrape-request';

describe('scrape request parsers', () => {
  test('parses search and imdb query params', () => {
    expect(parseSearchParams({})).toEqual({ ok: false, error: 'Missing query parameter' });
    expect(parseSearchParams({ q: 'Andor', year: '2022' })).toEqual({
      ok: true,
      data: { query: 'Andor', year: 2022, language: 'zh-CN' },
    });

    expect(parseImdbSearchParams({})).toEqual({ ok: false, error: 'Missing imdb_id parameter' });
    expect(parseImdbSearchParams({ imdb_id: 'tt1', language: 'en-US' })).toEqual({
      ok: true,
      data: { imdbId: 'tt1', language: 'en-US' },
    });
  });

  test('parses match and recognize bodies', () => {
    expect(parseMatchBody({})).toEqual({ ok: false, error: 'Missing path' });
    expect(parseMatchBody({ path: '/inbox/a.mkv', kind: 'tv', title: 'A', year: 2024 })).toEqual({
      ok: true,
      data: { path: '/inbox/a.mkv', kind: 'tv', title: 'A', year: 2024, language: 'zh-CN' },
    });

    expect(parseRecognizeBody({})).toEqual({ ok: false, error: 'Missing path' });
    expect(parseRecognizeBody({ path: 'A.mkv' })).toEqual({
      ok: true,
      data: { filePath: 'A.mkv', language: 'zh-CN' },
    });
  });

  test('parses process and refresh bodies', () => {
    expect(parseProcessTVBody({ sourcePath: '/a' })).toEqual({ ok: false, error: 'Missing required parameters' });
    expect(parseProcessMovieBody({ sourcePath: '/a' })).toEqual({ ok: false, error: 'Missing required parameters' });
    expect(parseRefreshBody({ kind: 'tv', path: '/a' })).toEqual({ ok: false, error: 'Missing required parameters' });

    expect(parseProcessTVBody({
      sourcePath: '/a',
      showName: 'Show',
      tmdbId: 1,
      season: 2,
      episodes: [{ episode: 3 }],
    })).toEqual({
      ok: true,
      data: {
        sourcePath: '/a',
        showName: 'Show',
        tmdbId: 1,
        season: 2,
        episodes: [{ episode: 3 }],
        language: 'zh-CN',
      },
    });

    expect(parseProcessMovieBody({ sourcePath: '/a', tmdbId: 1 })).toEqual({
      ok: true,
      data: { sourcePath: '/a', tmdbId: 1, language: 'zh-CN' },
    });

    expect(parseRefreshBody({ kind: 'tv', path: '/a', tmdbId: 1, season: 2, episode: 4 })).toEqual({
      ok: true,
      data: { kind: 'tv', path: '/a', tmdbId: 1, season: 2, episode: 4, language: 'zh-CN' },
    });
  });

  test('parses preview body', () => {
    expect(parsePreviewBody({ items: null })).toEqual({ ok: false, error: 'Missing items array' });
    expect(parsePreviewBody({ items: [{ sourcePath: '/a' }] })).toEqual({
      ok: true,
      data: { items: [{ sourcePath: '/a' }], language: 'zh-CN' },
    });
  });
});
