import { afterEach, describe, expect, test } from 'bun:test';
import type { MediaFile, SearchResult } from '$lib/api';
import { buildInboxPreviewItem, resolveInboxTargetPath } from './inboxPreview';

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function installFetchMock(handler: (url: string, body?: Record<string, unknown>) => Response | Promise<Response>) {
  const calls: Array<{ url: string; body?: Record<string, unknown> }> = [];

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ url, body });
    return handler(url, body);
  }) as typeof fetch;

  return calls;
}

function makeMovieFile(overrides?: Partial<MediaFile>): MediaFile {
  return {
    path: '/media/Inbox/Arrival.mkv',
    name: 'Arrival.mkv',
    relativePath: 'Arrival.mkv',
    size: 1024,
    kind: 'movie',
    parsed: { title: 'Arrival', year: 2016 },
    hasNfo: false,
    isProcessed: false,
    ...overrides,
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('inboxPreview helpers', () => {
  test('builds movie preview item from title-only candidate', () => {
    const file = makeMovieFile();
    const candidate: SearchResult = { id: 11, title: 'Arrival', mediaType: 'movie' };

    expect(buildInboxPreviewItem({ file, candidate, season: 9, episode: 9 })).toEqual({
      sourcePath: '/media/Inbox/Arrival.mkv',
      kind: 'movie',
      tmdbId: 11,
      showName: 'Arrival',
    });
  });

  test('returns create-dir fallback path when preview has no move action', async () => {
    const calls = installFetchMock((url, body) => {
      expect(url).toBe('/api/scrape/preview');
      expect(body).toMatchObject({
        items: [{
          sourcePath: '/media/Inbox/Arrival.mkv',
          kind: 'movie',
          tmdbId: 12,
          showName: 'Arrival',
        }],
      });

      return jsonResponse({
        success: true,
        data: {
          actions: [{ type: 'create-dir', destination: '/media/Movies/Arrival (2016)', willOverwrite: false }],
          impactSummary: {
            filesMoving: 1,
            nfoCreating: 1,
            nfoOverwriting: 0,
            postersDownloading: 1,
            directoriesCreating: ['/media/Movies/Arrival (2016)'],
          },
        },
      });
    });

    const path = await resolveInboxTargetPath({
      showDetailModal: true,
      file: makeMovieFile(),
      candidate: { id: 12, title: 'Arrival', mediaType: 'movie' },
      season: 1,
      episode: 1,
    });

    expect(calls).toHaveLength(1);
    expect(path).toBe('/media/Movies/Arrival (2016)');
  });
});
