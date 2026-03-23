import { afterEach, describe, expect, test } from 'bun:test';
import type { MediaFile, PathRecognizeResult } from '$lib/api';
import { resolveInboxAiRecognize } from './inboxRecognize';

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function installFetchMock(handler: (url: string) => Response | Promise<Response>) {
  const calls: string[] = [];

  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    calls.push(url);
    return handler(url);
  }) as typeof fetch;

  return calls;
}

function makeFile(overrides?: Partial<MediaFile>): MediaFile {
  return {
    path: '/media/Inbox/Movie.Name.2024.mkv',
    name: 'Movie.Name.2024.mkv',
    relativePath: 'nested/Movie.Name.2024.mkv',
    size: 100,
    kind: 'movie',
    parsed: { title: 'Movie Name', year: 2024 },
    hasNfo: false,
    isProcessed: false,
    ...overrides,
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('inboxRecognize helpers', () => {
  test('uses backend candidates directly and skips fallback searches', async () => {
    const recognizeResult: PathRecognizeResult = {
      path: 'nested/Movie.Name.2024.mkv',
      title: 'Movie Name',
      media_type: 'movie',
      year: 2024,
      season: null,
      episode: null,
      imdb_id: 'tt9999999',
      tmdb_id: 900,
      tmdb_name: 'Movie Name Prime',
      confidence: 0.95,
      reason: 'backend candidates available',
      recognize_candidates: [
        {
          title: 'Movie Name Prime',
          media_type: 'movie',
          year: 2024,
          season: null,
          episode: null,
          imdb_id: 'tt9999999',
          tmdb_id: 900,
          tmdb_name: 'Movie Name Prime',
          preferred_tmdb_id: 900,
          confidence: 0.95,
          reason: 'primary',
        },
      ],
      candidates: [
        { id: 900, title: 'Movie Name Prime', mediaType: 'movie', releaseDate: '2024-01-01' },
        { id: 901, title: 'Movie Name Backup', mediaType: 'movie', releaseDate: '2023-01-01' },
      ],
    };

    const calls = installFetchMock(url => {
      expect(url).toBe('/api/scrape/recognize');
      return jsonResponse({ success: true, data: recognizeResult });
    });

    const resolved = await resolveInboxAiRecognize(makeFile());

    expect(calls).toEqual(['/api/scrape/recognize']);
    expect(resolved.matchCandidates.map(item => item.id)).toEqual([900, 901]);
    expect(resolved.selectedCandidate?.id).toBe(900);
    expect(resolved.editSeason).toBeUndefined();
    expect(resolved.editEpisode).toBeUndefined();
    expect(resolved.operationMessage).toBe('🤖 AI 识别为电影，请选择候选确认');
  });

  test('surfaces low-confidence message after fallback search resolution', async () => {
    const recognizeResult: PathRecognizeResult = {
      path: 'nested/Movie.Name.2024.mkv',
      title: 'Movie Name',
      media_type: 'movie',
      year: 2024,
      season: null,
      episode: null,
      imdb_id: null,
      tmdb_id: 910,
      tmdb_name: 'Movie Name Prime',
      recognize_candidates: [
        {
          title: 'Movie Name Prime',
          media_type: 'movie',
          year: 2024,
          season: null,
          episode: null,
          imdb_id: null,
          tmdb_id: 910,
          tmdb_name: 'Movie Name Prime',
          preferred_tmdb_id: 910,
          confidence: 0.42,
          reason: 'weak title match',
        },
      ],
      confidence: 0.42,
      reason: 'weak title match',
      candidates: [],
    };

    const calls = installFetchMock(url => {
      if (url === '/api/scrape/recognize') {
        return jsonResponse({ success: true, data: recognizeResult });
      }
      if (url === '/api/scrape/search/multi?q=Movie+Name+Prime') {
        return jsonResponse({
          success: true,
          data: [{ id: 910, title: 'Movie Name Prime', mediaType: 'movie', releaseDate: '2024-01-01' }],
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const resolved = await resolveInboxAiRecognize(makeFile());

    expect(calls).toEqual([
      '/api/scrape/recognize',
      '/api/scrape/search/multi?q=Movie+Name+Prime',
    ]);
    expect(resolved.selectedCandidate?.id).toBe(910);
    expect(resolved.operationMessage).toBe('⚠️ AI 置信度较低 (42%)，建议手动确认');
  });
});
