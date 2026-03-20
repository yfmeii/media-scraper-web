import { beforeEach, describe, expect, mock, test } from 'bun:test';

let scanTVShowsImpl: (...args: any[]) => Promise<any[]>;
let scanTVShowsWithAssetsImpl: (...args: any[]) => Promise<any[]>;
let scanMoviesImpl: (...args: any[]) => Promise<any[]>;
let scanMoviesWithAssetsImpl: (...args: any[]) => Promise<any[]>;
let scanInboxImpl: (...args: any[]) => Promise<any[]>;
let scanInboxByDirectoryImpl: (...args: any[]) => Promise<any[]>;

mock.module('../lib/scanner-library', () => ({
  scanTVShows: (...args: any[]) => scanTVShowsImpl(...args),
  scanTVShowsWithAssets: (...args: any[]) => scanTVShowsWithAssetsImpl(...args),
  scanMovies: (...args: any[]) => scanMoviesImpl(...args),
  scanMoviesWithAssets: (...args: any[]) => scanMoviesWithAssetsImpl(...args),
}));

mock.module('../lib/scanner-files', () => ({
  scanInbox: (...args: any[]) => scanInboxImpl(...args),
  scanInboxByDirectory: (...args: any[]) => scanInboxByDirectoryImpl(...args),
}));

mock.module('../lib/config', () => ({
  MEDIA_PATHS: {
    tv: '/media/tv',
    movies: '/media/movies',
    inbox: '/media/inbox',
  },
}));

const { mediaRoutes } = await import('./media');

beforeEach(() => {
  scanTVShowsImpl = async () => [];
  scanTVShowsWithAssetsImpl = async () => [];
  scanMoviesImpl = async () => [];
  scanMoviesWithAssetsImpl = async () => [];
  scanInboxImpl = async () => [];
  scanInboxByDirectoryImpl = async () => [];
});

describe('media routes', () => {
  test('returns tv list with grouped status counts when assets requested', async () => {
    scanTVShowsWithAssetsImpl = async (path, detail) => {
      expect(path).toBe('/media/tv');
      expect(detail).toBe('summary');
      return [
        { path: '/media/tv/a', name: 'A', groupStatus: 'scraped', seasons: [{ episodes: [{}, {}] }], isProcessed: true },
        { path: '/media/tv/b', name: 'B', groupStatus: 'unscraped', seasons: [{ episodes: [{}] }], isProcessed: false },
        { path: '/media/tv/c', name: 'C', groupStatus: 'supplement', seasons: [], isProcessed: false },
      ];
    };

    const res = await mediaRoutes.request('/tv?include=assets&group=status');
    const body = await res.json();

    expect(body.total).toBe(3);
    expect(body.groups).toEqual({ scraped: 1, unscraped: 1, supplement: 1 });
  });

  test('returns movie list with total count', async () => {
    scanMoviesImpl = async (path) => {
      expect(path).toBe('/media/movies');
      return [{ path: '/media/movies/a', name: 'Arrival' }];
    };

    const res = await mediaRoutes.request('/movies');
    expect(await res.json()).toEqual({
      success: true,
      data: [{ path: '/media/movies/a', name: 'Arrival' }],
      total: 1,
    });
  });

  test('returns inbox directory grouping when dir view requested', async () => {
    scanInboxByDirectoryImpl = async (path) => {
      expect(path).toBe('/media/inbox');
      return [
        { path: '/media/inbox/dir-a', name: 'dir-a', files: [{ path: '/media/inbox/dir-a/a.mkv' }, { path: '/media/inbox/dir-a/b.mkv' }] },
        { path: '/media/inbox/dir-b', name: 'dir-b', files: [{ path: '/media/inbox/dir-b/c.mkv' }] },
      ];
    };

    const res = await mediaRoutes.request('/inbox?view=dir');
    const body = await res.json();

    expect(body.total).toBe(3);
    expect(body.directories).toBe(2);
  });

  test('returns aggregated stats from shows, movies, and inbox', async () => {
    scanTVShowsWithAssetsImpl = async () => [
      { isProcessed: true, episodeCount: 2, seasons: [{ episodes: [{}, {}] }] },
      { isProcessed: false, episodeCount: 2, seasons: [{ episodes: [{}] }, { episodes: [{}] }] },
    ];
    scanMoviesWithAssetsImpl = async () => [
      { isProcessed: true },
      { isProcessed: false },
    ];
    scanInboxImpl = async () => [{ path: '/media/inbox/a.mkv' }, { path: '/media/inbox/b.mkv' }];

    const res = await mediaRoutes.request('/stats');
    expect(await res.json()).toEqual({
      success: true,
      data: {
        tvShows: 2,
        tvEpisodes: 4,
        tvProcessed: 1,
        movies: 2,
        moviesProcessed: 1,
        inbox: 2,
      },
    });
  });

  test('returns detailed tv item by path', async () => {
    scanTVShowsWithAssetsImpl = async (_path, detail) => {
      expect(detail).toBe('full');
      return [{ path: '/media/tv/a', name: 'A', detailLoaded: true, seasons: [] }];
    };

    const res = await mediaRoutes.request('/tv/detail?path=%2Fmedia%2Ftv%2Fa');
    expect(await res.json()).toEqual({ success: true, data: { path: '/media/tv/a', name: 'A', detailLoaded: true, seasons: [] } });
  });

  test('returns detailed movie item by path', async () => {
    scanMoviesWithAssetsImpl = async (_path, detail) => {
      expect(detail).toBe('full');
      return [{ path: '/media/movies/a', name: 'Arrival', detailLoaded: true }];
    };

    const res = await mediaRoutes.request('/movies/detail?path=%2Fmedia%2Fmovies%2Fa');
    expect(await res.json()).toEqual({ success: true, data: { path: '/media/movies/a', name: 'Arrival', detailLoaded: true } });
  });

  test('returns inbox files with shared media file shape', async () => {
    scanInboxImpl = async (path) => {
      expect(path).toBe('/media/inbox');
      return [
        {
          path: '/media/inbox/F1.mkv',
          name: 'F1.mkv',
          relativePath: 'F1.mkv',
          size: 123,
          kind: 'movie',
          parsed: { title: 'F1', year: 2025 },
          hasNfo: false,
          isProcessed: false,
        },
      ];
    };

    const res = await mediaRoutes.request('/inbox');
    expect(await res.json()).toEqual({
      success: true,
      data: [
        {
          path: '/media/inbox/F1.mkv',
          name: 'F1.mkv',
          relativePath: 'F1.mkv',
          size: 123,
          kind: 'movie',
          parsed: { title: 'F1', year: 2025 },
          hasNfo: false,
          isProcessed: false,
        },
      ],
      total: 1,
    });
  });

  test('returns full tv detail with episode media file fields', async () => {
    scanTVShowsWithAssetsImpl = async (_path, detail) => {
      expect(detail).toBe('full');
      return [
        {
          path: '/media/tv/For All Mankind',
          name: 'For All Mankind',
          detailLoaded: true,
          seasons: [
            {
              season: 1,
              episodes: [
                {
                  path: '/media/tv/For All Mankind/Season 01/For All Mankind - S01E01.mkv',
                  name: 'For All Mankind - S01E01.mkv',
                  relativePath: 'Season 01/For All Mankind - S01E01.mkv',
                  size: 1024,
                  kind: 'tv',
                  parsed: { title: 'For All Mankind', season: 1, episode: 1 },
                  hasNfo: true,
                  isProcessed: true,
                },
              ],
            },
          ],
        },
      ];
    };

    const res = await mediaRoutes.request('/tv/detail?path=%2Fmedia%2Ftv%2FFor%20All%20Mankind');
    expect(await res.json()).toEqual({
      success: true,
      data: {
        path: '/media/tv/For All Mankind',
        name: 'For All Mankind',
        detailLoaded: true,
        seasons: [
          {
            season: 1,
            episodes: [
              {
                path: '/media/tv/For All Mankind/Season 01/For All Mankind - S01E01.mkv',
                name: 'For All Mankind - S01E01.mkv',
                relativePath: 'Season 01/For All Mankind - S01E01.mkv',
                size: 1024,
                kind: 'tv',
                parsed: { title: 'For All Mankind', season: 1, episode: 1 },
                hasNfo: true,
                isProcessed: true,
              },
            ],
          },
        ],
      },
    });
  });
});
