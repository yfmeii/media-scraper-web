import { afterEach, describe, expect, test } from 'bun:test';
import type { MatchResult, MediaFile, PathRecognizeResult, SearchResult } from '$lib/api';
import {
  aiRecognizeProcessInboxFile,
  autoProcessInboxFile,
  processSelectedCandidate,
} from './inboxProcess';

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function installFetchMock(
  handler: (url: string, init?: RequestInit, body?: Record<string, unknown>) => Response | Promise<Response>,
) {
  const calls: Array<{ url: string; init?: RequestInit; body?: Record<string, unknown> }> = [];

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    const body = typeof init?.body === 'string'
      ? JSON.parse(init.body)
      : undefined;

    calls.push({ url, init, body });
    return handler(url, init, body);
  }) as typeof fetch;

  return calls;
}

function makeFile(overrides?: Partial<MediaFile>): MediaFile {
  return {
    path: '/media/Inbox/Example.S01E02.mkv',
    name: 'Example.S01E02.mkv',
    relativePath: 'Example.S01E02.mkv',
    size: 2048,
    kind: 'tv',
    parsed: {
      title: 'Example',
      year: 2021,
      season: 1,
      episode: 2,
    },
    hasNfo: false,
    isProcessed: false,
    ...overrides,
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('inboxProcess helpers', () => {
  test('processes movie candidate through movie endpoint', async () => {
    const calls = installFetchMock((url, _init, body) => {
      expect(url).toBe('/api/scrape/process/movie');
      expect(body).toEqual({
        sourcePath: '/media/Inbox/Movie.mkv',
        tmdbId: 501,
      });
      return jsonResponse({ success: true, data: { message: 'done' } });
    });

    const result = await processSelectedCandidate(
      makeFile({
        path: '/media/Inbox/Movie.mkv',
        name: 'Movie.mkv',
        kind: 'movie',
        parsed: { title: 'Movie', year: 2020 },
      }),
      { id: 501, title: 'Movie', mediaType: 'movie' },
    );

    expect(calls).toHaveLength(1);
    expect(result.success).toBe(true);
    expect(result.message).toBe('done');
  });

  test('processes tv candidate with parsed season and episode fallback', async () => {
    installFetchMock((url, _init, body) => {
      expect(url).toBe('/api/scrape/process/tv');
      expect(body).toEqual({
        sourcePath: '/media/Inbox/Example.S01E02.mkv',
        showName: 'Example Show',
        tmdbId: 502,
        season: 1,
        episodes: [{ source: '/media/Inbox/Example.S01E02.mkv', episode: 2 }],
      });
      return jsonResponse({ success: true, data: { message: 'processed' } });
    });

    const result = await processSelectedCandidate(
      makeFile(),
      { id: 502, name: 'Example Show', mediaType: 'tv' },
    );

    expect(result).toEqual({ success: true, message: 'processed', taskId: undefined });
  });

  test('returns no-match result without processing when auto match is empty', async () => {
    const emptyMatch: MatchResult = { matched: false, candidates: [] };
    const calls = installFetchMock((url) => {
      expect(url).toBe('/api/scrape/match');
      return jsonResponse({ success: true, data: emptyMatch });
    });

    const result = await autoProcessInboxFile(makeFile());

    expect(calls).toHaveLength(1);
    expect(result.matchResult).toEqual(emptyMatch);
    expect(result.result).toEqual({ success: false, message: 'No match result' });
    expect(result.mediaType).toBeUndefined();
  });

  test('recognize flow returns failure when recognizer gives no result', async () => {
    const result = await aiRecognizeProcessInboxFile(makeFile(), async () => null);

    expect(result).toEqual({
      result: { success: false, message: 'Path recognition failed' },
      recognizeResult: null,
    });
  });

  test('recognize flow uses imdb fallback and processes tv payload', async () => {
    const recognizeResult: PathRecognizeResult = {
      path: 'Example.S03E09.mkv',
      title: 'Example',
      media_type: 'tv',
      year: 2021,
      season: 3,
      episode: 9,
      imdb_id: 'tt7654321',
      tmdb_id: null,
      tmdb_name: null,
      confidence: 0.91,
      reason: 'imdb matched',
    };

    const calls = installFetchMock((url, _init, body) => {
      if (url === '/api/scrape/search/imdb?imdb_id=tt7654321&language=zh-CN') {
        const imdbResult: SearchResult = { id: 503, name: 'Example Prime', mediaType: 'tv' };
        return jsonResponse({ success: true, data: [imdbResult] });
      }

      if (url === '/api/scrape/process/tv') {
        expect(body).toEqual({
          sourcePath: '/media/Inbox/Example.S01E02.mkv',
          showName: 'Example Prime',
          tmdbId: 503,
          season: 3,
          episodes: [{ source: '/media/Inbox/Example.S01E02.mkv', episode: 9 }],
        });
        return jsonResponse({ success: true, data: { message: 'recognized' } });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await aiRecognizeProcessInboxFile(makeFile(), async () => recognizeResult);

    expect(calls.map(call => call.url)).toEqual([
      '/api/scrape/search/imdb?imdb_id=tt7654321&language=zh-CN',
      '/api/scrape/process/tv',
    ]);
    expect(result.recognizeResult).toEqual(recognizeResult);
    expect(result.mediaType).toBe('tv');
    expect(result.result.success).toBe(true);
  });
});
