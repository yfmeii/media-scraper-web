import { afterEach, describe, expect, test } from 'bun:test';
import type { MatchResult, MediaFile, PathRecognizeResult } from '$lib/api';
import {
  aiRecognizeProcessInboxFile,
  autoProcessInboxFile,
  processSelectedCandidate,
} from './inboxProcessCore';

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function installFetchMock(
  handler: (url: string, body?: Record<string, unknown>) => Response | Promise<Response>,
) {
  const calls: Array<{ url: string; body?: Record<string, unknown> }> = [];

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ url, body });
    return handler(url, body);
  }) as typeof fetch;

  return calls;
}

function makeFile(overrides?: Partial<MediaFile>): MediaFile {
  return {
    path: '/media/Inbox/Show.S01E02.mkv',
    name: 'Show.S01E02.mkv',
    relativePath: 'nested/Show.S01E02.mkv',
    size: 2048,
    kind: 'tv',
    parsed: {
      title: 'Show',
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

describe('inboxProcessCore helpers', () => {
  test('prefers explicit season and episode overrides for tv processing', async () => {
    const calls = installFetchMock((url, body) => {
      expect(url).toBe('/api/scrape/process/tv');
      expect(body).toEqual({
        sourcePath: '/media/Inbox/Show.S01E02.mkv',
        showName: 'Manual Show',
        tmdbId: 701,
        season: 4,
        episodes: [{ source: '/media/Inbox/Show.S01E02.mkv', episode: 8 }],
      });
      return jsonResponse({ success: true, data: { message: 'ok' } });
    });

    const result = await processSelectedCandidate(
      makeFile(),
      { id: 701, title: 'Manual Show', mediaType: 'tv' },
      { season: 4, episode: 8 },
    );

    expect(calls).toHaveLength(1);
    expect(result).toEqual({ success: true, message: 'ok', taskId: undefined });
  });

  test('auto process forwards match result into movie processing', async () => {
    const matchResult: MatchResult = {
      matched: true,
      result: { id: 702, name: 'Arrival', mediaType: 'movie', score: 0.93 },
      candidates: [],
    };

    const calls = installFetchMock((url, body) => {
      if (url === '/api/scrape/match') {
        expect(body).toMatchObject({ path: '/media/Inbox/Arrival.mkv', title: 'Arrival', year: 2016 });
        return jsonResponse({ success: true, data: matchResult });
      }
      if (url === '/api/scrape/process/movie') {
        expect(body).toEqual({ sourcePath: '/media/Inbox/Arrival.mkv', tmdbId: 702 });
        return jsonResponse({ success: true, data: { message: 'movie done' } });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await autoProcessInboxFile(makeFile({
      path: '/media/Inbox/Arrival.mkv',
      name: 'Arrival.mkv',
      relativePath: 'Arrival.mkv',
      kind: 'movie',
      parsed: { title: 'Arrival', year: 2016 },
    }));

    expect(calls.map(call => call.url)).toEqual(['/api/scrape/match', '/api/scrape/process/movie']);
    expect(result.mediaType).toBe('movie');
    expect(result.matchResult).toEqual(matchResult);
    expect(result.result).toEqual({ success: true, message: 'movie done', taskId: undefined });
  });

  test('recognize process fails when tmdb id is still missing', async () => {
    const recognizeResult: PathRecognizeResult = {
      path: 'nested/Show.S01E02.mkv',
      title: 'Show',
      media_type: 'tv',
      year: 2021,
      season: 2,
      episode: 6,
      imdb_id: null,
      tmdb_id: null,
      tmdb_name: null,
      recognize_candidates: [{
        title: 'Show',
        media_type: 'tv',
        year: 2021,
        season: 2,
        episode: 6,
        imdb_id: null,
        tmdb_id: null,
        tmdb_name: null,
        confidence: 0.88,
        reason: 'parsed only',
      }],
      confidence: 0.88,
      reason: 'parsed only',
    };

    const calls = installFetchMock(() => {
      throw new Error('No API call expected');
    });

    const result = await aiRecognizeProcessInboxFile(makeFile(), async input => {
      expect(input).toBe('nested/Show.S01E02.mkv');
      return recognizeResult;
    });

    expect(calls).toHaveLength(0);
    expect(result).toEqual({
      result: { success: false, message: 'Missing TMDB ID' },
      recognizeResult,
      mediaType: 'tv',
    });
  });

  test('recognize process routes movie payload without imdb lookup when tmdb id exists', async () => {
    const recognizeResult: PathRecognizeResult = {
      path: 'Arrival.mkv',
      title: 'Arrival',
      media_type: 'movie',
      year: 2016,
      season: null,
      episode: null,
      imdb_id: null,
      tmdb_id: 703,
      tmdb_name: 'Arrival',
      recognize_candidates: [{
        title: 'Arrival',
        media_type: 'movie',
        year: 2016,
        season: null,
        episode: null,
        imdb_id: null,
        tmdb_id: 703,
        tmdb_name: 'Arrival',
        preferred_tmdb_id: 703,
        confidence: 0.94,
        reason: 'direct tmdb match',
      }],
      confidence: 0.94,
      reason: 'direct tmdb match',
    };

    const calls = installFetchMock((url, body) => {
      expect(url).toBe('/api/scrape/process/movie');
      expect(body).toEqual({ sourcePath: '/media/Inbox/Arrival.mkv', tmdbId: 703 });
      return jsonResponse({ success: true, data: { message: 'recognized movie' } });
    });

    const result = await aiRecognizeProcessInboxFile(
      makeFile({
        path: '/media/Inbox/Arrival.mkv',
        name: 'Arrival.mkv',
        relativePath: 'Arrival.mkv',
        kind: 'movie',
        parsed: { title: 'Arrival', year: 2016 },
      }),
      async () => recognizeResult,
    );

    expect(calls.map(call => call.url)).toEqual(['/api/scrape/process/movie']);
    expect(result.mediaType).toBe('movie');
    expect(result.result).toEqual({ success: true, message: 'recognized movie', taskId: undefined });
  });
});
