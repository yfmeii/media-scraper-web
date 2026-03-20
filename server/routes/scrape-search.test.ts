import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { Hono } from 'hono';

let searchTVImpl: (...args: any[]) => Promise<any[]>;
let searchMovieImpl: (...args: any[]) => Promise<any[]>;
let searchMultiImpl: (...args: any[]) => Promise<any[]>;
let findByImdbIdImpl: (...args: any[]) => Promise<any>;
let findBestMatchImpl: (...args: any[]) => Promise<any>;
let findBestMatchMixedImpl: (...args: any[]) => Promise<any>;
let parseFilenameImpl: (name: string) => { title?: string; year?: number };

mock.module('../lib/tmdb', () => ({
  searchTV: (...args: any[]) => searchTVImpl(...args),
  searchMovie: (...args: any[]) => searchMovieImpl(...args),
  searchMulti: (...args: any[]) => searchMultiImpl(...args),
  findByImdbId: (...args: any[]) => findByImdbIdImpl(...args),
  findByTmdbId: async () => null,
  findBestMatch: (...args: any[]) => findBestMatchImpl(...args),
  findBestMatchMixed: (...args: any[]) => findBestMatchMixedImpl(...args),
  getPosterUrl: (path?: string | null) => path ? `https://image.tmdb.org/t/p/w185${path}` : null,
}));

mock.module('../lib/scanner-parser', () => ({
  parseFilename: (name: string) => parseFilenameImpl(name),
}));

const { handleMatch, handleSearch, handleSearchByImdb } = await import('./scrape-search');

function createApp() {
  const app = new Hono();
  app.get('/search/imdb', handleSearchByImdb);
  app.get('/search/:kind', (c) => handleSearch(c, c.req.param('kind') as 'tv' | 'movie' | 'multi'));
  app.post('/match', handleMatch);
  return app;
}

beforeEach(() => {
  searchTVImpl = async () => [];
  searchMovieImpl = async () => [];
  searchMultiImpl = async () => [];
  findByImdbIdImpl = async () => null;
  findBestMatchImpl = async () => null;
  findBestMatchMixedImpl = async () => null;
  parseFilenameImpl = () => ({ title: 'Parsed Title', year: 2024 });
});

afterEach(() => {
  searchTVImpl = async () => [];
  searchMovieImpl = async () => [];
  searchMultiImpl = async () => [];
  findByImdbIdImpl = async () => null;
  findBestMatchImpl = async () => null;
  findBestMatchMixedImpl = async () => null;
});

describe('scrape-search routes', () => {
  test('returns bad request when search query is missing', async () => {
    const app = createApp();
    const res = await app.request('/search/tv');

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: 'Missing query parameter' });
  });

  test('searches tv titles with parsed year and maps result payload', async () => {
    searchTVImpl = async (query, year, language) => {
      expect(query).toBe('Andor');
      expect(year).toBe(2022);
      expect(language).toBe('en-US');
      return [{
        id: 101,
        media_type: 'tv',
        name: 'Andor',
        original_name: 'Andor Original',
        first_air_date: '2022-09-21',
        poster_path: '/andor.jpg',
        vote_average: 8.7,
      }];
    };

    const app = createApp();
    const res = await app.request('/search/tv?q=Andor&year=2022&language=en-US');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data[0]).toMatchObject({
      id: 101,
      mediaType: 'tv',
      name: 'Andor',
      firstAirDate: '2022-09-21',
    });
  });

  test('searches by imdb id and wraps matched item in array', async () => {
    findByImdbIdImpl = async (imdbId, language) => {
      expect(imdbId).toBe('tt1234567');
      expect(language).toBe('zh-CN');
      return {
        id: 201,
        media_type: 'movie',
        title: 'Arrival',
        original_title: 'Arrival',
        release_date: '2016-11-11',
        poster_path: '/arrival.jpg',
      };
    };

    const app = createApp();
    const res = await app.request('/search/imdb?imdb_id=tt1234567');
    const body = await res.json();

    expect(body).toMatchObject({
      success: true,
      data: [{ id: 201, mediaType: 'movie', title: 'Arrival' }],
    });
  });

  test('returns bad request when match path is missing', async () => {
    const app = createApp();
    const res = await app.request('/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Andor' }),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: 'Missing path' });
  });

  test('uses explicit kind for match lookup and returns mapped payload', async () => {
    findBestMatchImpl = async (kind, title, year, language) => {
      expect(kind).toBe('tv');
      expect(title).toBe('Andor');
      expect(year).toBe(2022);
      expect(language).toBe('zh-CN');
      return {
        score: 0.93,
        result: {
          id: 301,
          name: 'Andor',
          original_name: 'Andor',
          first_air_date: '2022-09-21',
          poster_path: '/andor.jpg',
          media_type: 'tv',
        },
        candidates: [{
          id: 301,
          name: 'Andor',
          original_name: 'Andor',
          first_air_date: '2022-09-21',
          poster_path: '/andor.jpg',
          media_type: 'tv',
          score: 0.93,
        }],
      };
    };

    const app = createApp();
    const res = await app.request('/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/inbox/andor.mkv', kind: 'tv', title: 'Andor', year: 2022 }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toMatchObject({
      matched: true,
      result: { id: 301, name: 'Andor', mediaType: 'tv' },
    });
  });

  test('falls back to parsed filename and returns unmatched payload when no result', async () => {
    parseFilenameImpl = (name) => {
      expect(name).toBe('arrival.2016.mkv');
      return { title: 'Arrival', year: 2016 };
    };
    findBestMatchMixedImpl = async (title, year, language) => {
      expect(title).toBe('Arrival');
      expect(year).toBe(2016);
      expect(language).toBe('zh-CN');
      return null;
    };

    const app = createApp();
    const res = await app.request('/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/inbox/arrival.2016.mkv' }),
    });
    const body = await res.json();

    expect(body).toEqual({
      success: true,
      data: {
        matched: false,
        title: 'Arrival',
        year: 2016,
        candidates: [],
      },
    });
  });
});
