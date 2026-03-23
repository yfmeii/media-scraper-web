import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { Hono } from 'hono';

let recognizePathImpl: (...args: any[]) => Promise<any>;
let enrichRecognizeCandidatesImpl: (...args: any[]) => Promise<any>;

mock.module('../lib/dify', () => ({
  recognizePath: (...args: any[]) => recognizePathImpl(...args),
}));

mock.module('./scrape-helpers', async () => {
  return {
    enrichRecognizeCandidates: (...args: any[]) => enrichRecognizeCandidatesImpl(...args),
  };
});

const { handleRecognize } = await import('./scrape-recognize');

function createApp() {
  const app = new Hono();
  app.post('/recognize', handleRecognize);
  return app;
}

beforeEach(() => {
  recognizePathImpl = async () => ({
    title: 'Andor',
    year: 2022,
    media_type: 'tv',
    tmdb_id: 101,
    tmdb_name: 'Andor',
    imdb_id: 'tt9253284',
  });
  enrichRecognizeCandidatesImpl = async () => ({
    preferredTmdbId: 101,
    candidates: [{
      id: 101,
      mediaType: 'tv',
      name: 'Andor',
      originalName: 'Andor',
      firstAirDate: '2022-09-21',
      posterPath: 'https://image.tmdb.org/t/p/w185/andor.jpg',
    }],
  });
});

describe('scrape-recognize route', () => {
  test('returns bad request when path is missing', async () => {
    const app = createApp();
    const res = await app.request('/recognize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: 'Missing path' });
  });

  test('returns failed response when path recognition returns null', async () => {
    recognizePathImpl = async (path) => {
      expect(path).toBe('/inbox/unknown.mkv');
      return null;
    };

    const app = createApp();
    const res = await app.request('/recognize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/inbox/unknown.mkv' }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: false, error: 'Path recognition failed' });
  });

  test('returns recognized result with enriched candidates', async () => {
    recognizePathImpl = async (path) => {
      expect(path).toBe('/inbox/andor.mkv');
      return {
        title: 'Andor',
        year: 2022,
        media_type: 'tv',
        tmdb_id: 101,
        tmdb_name: null,
        imdb_id: 'tt9253284',
        recognize_candidates: [{
          title: 'Andor',
          year: 2022,
          media_type: 'tv',
          season: 1,
          episode: 1,
          imdb_id: 'tt9253284',
          tmdb_id: 101,
          tmdb_name: 'Andor',
          confidence: 0.9,
          reason: 'exact match',
        }],
      };
    };
    enrichRecognizeCandidatesImpl = async (result, language) => {
      expect(result.title).toBe('Andor');
      expect(language).toBe('en-US');
      return {
        preferredTmdbId: 101,
        candidates: [{
          id: 101,
          mediaType: 'tv',
          name: 'Andor',
          originalName: 'Andor',
          firstAirDate: '2022-09-21',
          posterPath: 'https://image.tmdb.org/t/p/w185/andor.jpg',
        }],
        recognizeCandidates: result.recognize_candidates,
      };
    };

    const app = createApp();
    const res = await app.request('/recognize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/inbox/andor.mkv', language: 'en-US' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: {
        title: 'Andor',
        tmdb_id: 101,
        preferred_tmdb_id: 101,
        tmdb_name: 'Andor',
        candidates: [{ id: 101, name: 'Andor', mediaType: 'tv' }],
        recognize_candidates: [{ tmdb_id: 101, tmdb_name: 'Andor' }],
      },
    });
  });

  test('continues when candidate enrichment fails', async () => {
    enrichRecognizeCandidatesImpl = async () => {
      throw new Error('tmdb unavailable');
    };

    const app = createApp();
    const res = await app.request('/recognize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/inbox/andor.mkv' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: {
        title: 'Andor',
        tmdb_id: 101,
        preferred_tmdb_id: 101,
        candidates: [{ id: 101 }],
      },
    });
  });
});
