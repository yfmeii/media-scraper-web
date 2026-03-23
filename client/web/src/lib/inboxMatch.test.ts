import { afterEach, describe, expect, test } from 'bun:test';
import type { MediaFile } from '$lib/api';
import { loadInboxDetailMatch, searchInboxCandidates } from './inboxMatch';

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

const file = {
  path: '/inbox/andor.s01e01.mkv',
  name: 'andor.s01e01.mkv',
  relativePath: 'andor.s01e01.mkv',
  size: 1,
  kind: 'tv',
  parsed: { title: 'Andor', year: 2022, season: 1, episode: 1 },
  hasNfo: false,
  isProcessed: false,
} satisfies MediaFile;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('inboxMatch helpers', () => {
  test('loads auto-match candidates and derives selection metadata', async () => {
    const calls = installFetchMock((url, body) => {
      expect(url).toBe('/api/scrape/match');
      expect(body).toMatchObject({ path: '/inbox/andor.s01e01.mkv', title: 'Andor', year: 2022 });
      return jsonResponse({
        success: true,
        data: {
          matched: true,
          result: { id: 101, name: 'Andor', mediaType: 'tv', score: 0.92 },
          candidates: [{ id: 101, name: 'Andor', mediaType: 'tv' }],
        },
      });
    });

    const result = await loadInboxDetailMatch(file);

    expect(calls).toHaveLength(1);
    expect(result).toMatchObject({
      candidates: [{ id: 101, name: 'Andor', mediaType: 'tv' }],
      selectedCandidate: { id: 101, name: 'Andor', mediaType: 'tv' },
      isAutoMatched: true,
      matchScore: 0.92,
    });
  });

  test('returns empty search results for blank query', async () => {
    expect(await searchInboxCandidates('   ')).toEqual([]);
  });

  test('searches TMDB for non-empty query', async () => {
    const calls = installFetchMock((url) => {
      expect(url).toBe('/api/scrape/search/multi?q=Arrival');
      return jsonResponse({
        success: true,
        data: [{ id: 201, title: 'Arrival', mediaType: 'movie' }],
      });
    });

    expect(await searchInboxCandidates('Arrival')).toEqual([
      { id: 201, title: 'Arrival', mediaType: 'movie' },
    ]);
    expect(calls).toHaveLength(1);
  });
});
