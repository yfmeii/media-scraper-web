import { beforeEach, describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import { createHandleProcessRoutes } from './scrape-process';
import { createHandleMoveToInbox } from './scrape-process-move';
import { createHandlePreview } from './scrape-process-preview';

class MockMoveToInboxError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let processTVShowImpl: (...args: any[]) => Promise<any>;
let processMovieImpl: (...args: any[]) => Promise<any>;
let refreshMetadataImpl: (...args: any[]) => Promise<any>;
let generatePreviewPlanImpl: (...args: any[]) => Promise<any>;
let moveMediaToInboxImpl: (...args: any[]) => Promise<any>;
let invalidateTVShowCacheImpl: (...args: any[]) => Promise<any>;
let invalidateMovieCacheImpl: (...args: any[]) => Promise<any>;
let invalidateLibraryCacheImpl: (...args: any[]) => Promise<any>;

function createApp() {
  const app = new Hono();
  const { handleProcessTV, handleProcessMovie, handleRefresh } = createHandleProcessRoutes({
    processTVShow: (...args: any[]) => processTVShowImpl(...args),
    processMovie: (...args: any[]) => processMovieImpl(...args),
    refreshMetadata: (...args: any[]) => refreshMetadataImpl(...args),
    invalidateTVShowCache: (...args: any[]) => invalidateTVShowCacheImpl(...args),
    invalidateMovieCache: (...args: any[]) => invalidateMovieCacheImpl(...args),
    invalidateLibraryCache: (...args: any[]) => invalidateLibraryCacheImpl(...args),
  });
  const handleMoveToInbox = createHandleMoveToInbox({
    moveMediaToInbox: (...args: any[]) => moveMediaToInboxImpl(...args),
    invalidateMovedItemCache: async () => undefined,
    MoveToInboxError: MockMoveToInboxError,
  });
  const handlePreview = createHandlePreview({
    generatePreviewPlan: (...args: any[]) => generatePreviewPlanImpl(...args),
  });
  app.post('/process/tv', handleProcessTV);
  app.post('/process/movie', handleProcessMovie);
  app.post('/move-to-inbox', handleMoveToInbox);
  app.post('/refresh', handleRefresh);
  app.post('/preview', handlePreview);
  return app;
}

beforeEach(() => {
  processTVShowImpl = async () => ({ success: true, message: 'tv ok' });
  processMovieImpl = async () => ({ success: true, message: 'movie ok' });
  refreshMetadataImpl = async () => ({ success: true, message: 'refresh ok' });
  generatePreviewPlanImpl = async () => ({ actions: [], impactSummary: { filesMoving: 0, nfoCreating: 0, nfoOverwriting: 0, postersDownloading: 0, directoriesCreating: [] } });
  moveMediaToInboxImpl = async () => ({ success: true, message: 'moved' });
  invalidateTVShowCacheImpl = async () => undefined;
  invalidateMovieCacheImpl = async () => undefined;
  invalidateLibraryCacheImpl = async () => undefined;
});

describe('scrape-process routes', () => {
  test('validates required tv processing parameters', async () => {
    const app = createApp();
    const res = await app.request('/process/tv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath: '/inbox/a.mkv' }),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: 'Missing required parameters' });
  });

  test('passes tv processing request through with default language', async () => {
    processTVShowImpl = async (sourcePath, showName, tmdbId, season, episodes, language) => {
      expect({ sourcePath, showName, tmdbId, season, episodes, language }).toEqual({
        sourcePath: '/inbox/andor.mkv',
        showName: 'Andor',
        tmdbId: 101,
        season: 1,
        episodes: [{ source: '/inbox/andor.mkv', episode: 1 }],
        language: 'zh-CN',
      });
      return { success: true, message: 'tv ok' };
    };

    const app = createApp();
    const res = await app.request('/process/tv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourcePath: '/inbox/andor.mkv',
        showName: 'Andor',
        tmdbId: 101,
        season: 1,
        episodes: [{ source: '/inbox/andor.mkv', episode: 1 }],
      }),
    });

    expect(await res.json()).toEqual({ success: true, message: 'tv ok' });
  });

  test('invalidates tv cache only on successful tv process with destPath', async () => {
    let invalidatedPath: string | null = null;
    processTVShowImpl = async () => ({ success: true, message: 'tv ok', destPath: '/tv/Andor/Season 01' });
    invalidateTVShowCacheImpl = async (path) => {
      invalidatedPath = path;
    };

    const app = createApp();
    const res = await app.request('/process/tv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourcePath: '/inbox/andor.mkv',
        showName: 'Andor',
        tmdbId: 101,
        season: 1,
        episodes: [{ source: '/inbox/andor.mkv', episode: 1 }],
      }),
    });

    expect(res.status).toBe(200);
    expect(invalidatedPath).toBe('/tv/Andor/Season 01');

    invalidatedPath = null;
    processTVShowImpl = async () => ({ success: false, message: 'tv fail', destPath: '/tv/Andor/Season 01' });
    await app.request('/process/tv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourcePath: '/inbox/andor.mkv',
        showName: 'Andor',
        tmdbId: 101,
        season: 1,
        episodes: [{ source: '/inbox/andor.mkv', episode: 1 }],
      }),
    });

    expect(invalidatedPath).toBeNull();
  });

  test('passes movie processing request through', async () => {
    processMovieImpl = async (sourcePath, tmdbId, language) => {
      expect({ sourcePath, tmdbId, language }).toEqual({
        sourcePath: '/inbox/arrival.mkv',
        tmdbId: 202,
        language: 'en-US',
      });
      return { success: true, message: 'movie ok' };
    };

    const app = createApp();
    const res = await app.request('/process/movie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath: '/inbox/arrival.mkv', tmdbId: 202, language: 'en-US' }),
    });

    expect(await res.json()).toEqual({ success: true, message: 'movie ok' });
  });

  test('invalidates movie cache only on successful movie process with destPath', async () => {
    let invalidatedPath: string | null = null;
    processMovieImpl = async () => ({ success: true, message: 'movie ok', destPath: '/movies/Arrival (2016)' });
    invalidateMovieCacheImpl = async (path) => {
      invalidatedPath = path;
    };

    const app = createApp();
    await app.request('/process/movie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath: '/inbox/arrival.mkv', tmdbId: 202, language: 'en-US' }),
    });

    expect(invalidatedPath).toBe('/movies/Arrival (2016)');

    invalidatedPath = null;
    processMovieImpl = async () => ({ success: true, message: 'movie ok' });
    await app.request('/process/movie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath: '/inbox/arrival.mkv', tmdbId: 202, language: 'en-US' }),
    });

    expect(invalidatedPath).toBeNull();
  });

  test('returns custom status for MoveToInboxError', async () => {
    moveMediaToInboxImpl = async () => {
      throw new MockMoveToInboxError('protected path', 409);
    };

    const app = createApp();
    const res = await app.request('/move-to-inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath: '/tv/Andor' }),
    });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ success: false, error: 'protected path' });
  });

  test('refresh validates required params and passes optional season episode', async () => {
    let invalidatedPath: { path: string; kind: string } | null = null;
    const app = createApp();
    const badRes = await app.request('/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'tv', path: '/tv/Andor' }),
    });

    expect(badRes.status).toBe(400);

    refreshMetadataImpl = async (kind, path, tmdbId, season, episode, language) => {
      expect({ kind, path, tmdbId, season, episode, language }).toEqual({
        kind: 'tv',
        path: '/tv/Andor',
        tmdbId: 303,
        season: 2,
        episode: 5,
        language: 'zh-CN',
      });
      return { success: true, message: 'refresh ok' };
    };
    invalidateLibraryCacheImpl = async (path, kind) => {
      invalidatedPath = { path, kind };
    };

    const res = await app.request('/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'tv', path: '/tv/Andor', tmdbId: 303, season: 2, episode: 5 }),
    });

    expect(await res.json()).toEqual({ success: true, message: 'refresh ok' });
    expect(invalidatedPath).toEqual({ path: '/tv/Andor', kind: 'tv' });

    invalidatedPath = null;
    refreshMetadataImpl = async () => ({ success: false, message: 'refresh fail' });
    await app.request('/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'tv', path: '/tv/Andor', tmdbId: 303 }),
    });
    expect(invalidatedPath).toBeNull();
  });

  test('rejects malformed process and preview requests', async () => {
    const app = createApp();

    const badTvRes = await app.request('/process/tv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourcePath: '/inbox/andor.mkv',
        showName: 'Andor',
        tmdbId: 101,
        season: 1,
        episodes: [{ source: '/inbox/andor.mkv', episode: 2, episodeEnd: 1 }],
      }),
    });

    expect(badTvRes.status).toBe(400);
    expect(await badTvRes.json()).toEqual({ success: false, error: 'Missing required parameters' });

    const badPreviewRes = await app.request('/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ sourcePath: '/inbox/a.mkv', kind: 'movie' }] }),
    });

    expect(badPreviewRes.status).toBe(400);
    expect(await badPreviewRes.json()).toEqual({ success: false, error: 'Missing items array' });
  });

  test('preview validates items array and returns wrapped plan', async () => {
    const app = createApp();
    const badRes = await app.request('/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: null }),
    });
    expect(badRes.status).toBe(400);

    generatePreviewPlanImpl = async (items, language) => {
      expect(language).toBe('zh-CN');
      expect(items).toEqual([{ sourcePath: '/inbox/a.mkv', kind: 'movie', tmdbId: 9 }]);
      return { actions: [{ type: 'move', source: '/inbox/a.mkv', destination: '/movies/A.mkv', willOverwrite: false }], impactSummary: { filesMoving: 1, nfoCreating: 1, nfoOverwriting: 0, postersDownloading: 1, directoriesCreating: ['/movies'] } };
    };

    const res = await app.request('/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ sourcePath: '/inbox/a.mkv', kind: 'movie', tmdbId: 9 }] }),
    });

    expect(await res.json()).toMatchObject({ success: true, data: { actions: [{ type: 'move' }] } });
  });
});
