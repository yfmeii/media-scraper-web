import { afterEach, describe, expect, test } from 'bun:test';
import type { MediaFile, PathRecognizeResult, PreviewPlan, SearchResult } from '$lib/api';
import {
  buildInboxPreviewItem,
  loadInboxDetailMatch,
  resolveInboxAiRecognize,
  resolveInboxTargetPath,
  searchInboxCandidates,
} from './inboxDetail';

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
    path: '/media/Inbox/Show.S01E02.mkv',
    name: 'Show.S01E02.mkv',
    relativePath: 'Show.S01E02.mkv',
    size: 1024,
    kind: 'tv',
    parsed: {
      title: 'Show',
      year: 2024,
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

describe('inboxDetail helpers', () => {
  test('builds preview item from selected file and candidate', () => {
    const file = makeFile();
    const candidate: SearchResult = { id: 100, name: 'Matched Show' };

    expect(buildInboxPreviewItem({ file: null, candidate, season: 1, episode: 1 })).toBeNull();
    expect(buildInboxPreviewItem({ file, candidate: null, season: 1, episode: 1 })).toBeNull();

    expect(buildInboxPreviewItem({ file, candidate, season: 3, episode: 7 })).toEqual({
      sourcePath: file.path,
      kind: 'tv',
      tmdbId: 100,
      showName: 'Matched Show',
      season: 3,
      episodes: [{ source: file.path, episode: 7, episodeEnd: undefined }],
    });
  });

  test('loads auto-match result and maps selected candidate', async () => {
    const calls = installFetchMock((url, _init, body) => {
      expect(url).toBe('/api/scrape/match');
      expect(body).toMatchObject({
        path: '/media/Inbox/Show.S01E02.mkv',
        title: 'Show',
        year: 2024,
      });

      return jsonResponse({
        success: true,
        data: {
          matched: true,
          result: { id: 101, name: 'Show', mediaType: 'tv', score: 0.88 },
          candidates: [
            { id: 101, name: 'Show', mediaType: 'tv', date: '2024-01-01' },
            { id: 102, name: 'Show Again', mediaType: 'tv', date: '2022-01-01' },
          ],
        },
      });
    });

    const result = await loadInboxDetailMatch(makeFile());

    expect(calls).toHaveLength(1);
    expect(result.isAutoMatched).toBe(true);
    expect(result.matchScore).toBe(0.88);
    expect(result.selectedCandidate?.id).toBe(101);
    expect(result.candidates.map(item => item.id)).toEqual([101, 102]);
  });

  test('searches candidates only when query is not blank', async () => {
    const calls = installFetchMock((url) => {
      expect(url).toContain('/api/scrape/search/multi?q=Alien');
      return jsonResponse({
        success: true,
        data: [{ id: 201, title: 'Alien', mediaType: 'movie' }],
      });
    });

    expect(await searchInboxCandidates('   ')).toEqual([]);
    expect(calls).toHaveLength(0);

    const results = await searchInboxCandidates('Alien');
    expect(calls).toHaveLength(1);
    expect(results[0]?.id).toBe(201);
  });

  test('resolves AI recognize candidates from backend and fallback searches', async () => {
    const recognizeResult: PathRecognizeResult = {
      path: 'Show.S02E05.mkv',
      title: 'Show',
      media_type: 'tv',
      year: 2023,
      season: 2,
      episode: 5,
      imdb_id: 'tt1234567',
      tmdb_id: 301,
      tmdb_name: 'Show Prime',
      confidence: 0.82,
      reason: 'matched by path',
      candidates: [],
    };

    const calls = installFetchMock((url) => {
      if (url === '/api/scrape/recognize') {
        return jsonResponse({ success: true, data: recognizeResult });
      }

      if (url.includes('/api/scrape/search/imdb')) {
        return jsonResponse({
          success: true,
          data: [{ id: 301, name: 'Show Prime', mediaType: 'tv', firstAirDate: '2023-01-01' }],
        });
      }

      if (url.includes('/api/scrape/search/multi')) {
        return jsonResponse({
          success: true,
          data: [{ id: 302, name: 'Show Backup', mediaType: 'tv', firstAirDate: '2022-01-01' }],
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const resolved = await resolveInboxAiRecognize(makeFile({ relativePath: 'Show.S02E05.mkv' }));

    expect(calls.map(call => call.url)).toEqual([
      '/api/scrape/recognize',
      '/api/scrape/search/imdb?imdb_id=tt1234567&language=zh-CN',
      '/api/scrape/search/multi?q=Show+Prime',
    ]);
    expect(resolved.aiRecognizeResult?.tmdb_id).toBe(301);
    expect(resolved.matchCandidates.map(item => item.id)).toEqual([301, 302]);
    expect(resolved.selectedCandidate?.id).toBe(301);
    expect(resolved.editSeason).toBe(2);
    expect(resolved.editEpisode).toBe(5);
    expect(resolved.operationMessage).toContain('AI 识别为剧集');
  });

  test('returns failure message when AI recognize does not resolve', async () => {
    installFetchMock((url) => {
      expect(url).toBe('/api/scrape/recognize');
      return jsonResponse({ success: false, error: 'boom' });
    });

    const resolved = await resolveInboxAiRecognize(makeFile());

    expect(resolved).toEqual({
      aiRecognizeResult: null,
      matchCandidates: [],
      selectedCandidate: null,
      operationMessage: '❌ AI 识别失败，请手动搜索',
    });
  });

  test('resolves preview target path for detail modal', async () => {
    const plan: PreviewPlan = {
      actions: [
        {
          type: 'move',
          source: '/media/Inbox/Show.S01E02.mkv',
          destination: '/media/TV/Matched Show/Season 01/Matched Show - S01E02.mkv',
          willOverwrite: false,
        },
      ],
      impactSummary: {
        filesMoving: 1,
        nfoCreating: 1,
        nfoOverwriting: 0,
        postersDownloading: 1,
        directoriesCreating: ['/media/TV/Matched Show/Season 01'],
      },
    };

    installFetchMock((url, _init, body) => {
      expect(url).toBe('/api/scrape/preview');
      expect(body).toMatchObject({
        items: [
          {
            sourcePath: '/media/Inbox/Show.S01E02.mkv',
            kind: 'tv',
            tmdbId: 400,
            showName: 'Matched Show',
            season: 1,
          },
        ],
      });
      return jsonResponse({ success: true, data: plan });
    });

    const file = makeFile();
    const candidate: SearchResult = { id: 400, name: 'Matched Show' };

    expect(await resolveInboxTargetPath({
      showDetailModal: false,
      file,
      candidate,
      season: 1,
      episode: 2,
    })).toBe('');

    expect(await resolveInboxTargetPath({
      showDetailModal: true,
      file,
      candidate,
      season: 1,
      episode: 2,
    })).toBe('/media/TV/Matched Show/Season 01/Matched Show - S01E02.mkv');
  });
});
