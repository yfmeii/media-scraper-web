import { beforeEach, describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import { createHandlePreview } from './scrape-process-preview';

let generatePreviewPlanImpl: (...args: any[]) => Promise<any>;

function createApp() {
  const app = new Hono();
  const handlePreview = createHandlePreview({
    generatePreviewPlan: (...args: any[]) => generatePreviewPlanImpl(...args),
  });
  app.post('/preview', handlePreview);
  return app;
}

beforeEach(() => {
  generatePreviewPlanImpl = async () => ({
    actions: [],
    impactSummary: {
      filesMoving: 1,
      nfoCreating: 1,
      nfoOverwriting: 0,
      postersDownloading: 1,
      directoriesCreating: ['/tv/Andor/Season 01'],
    },
  });
});

describe('scrape-process-preview route', () => {
  test('returns bad request when items are missing', async () => {
    const app = createApp();
    const res = await app.request('/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: 'Missing items array' });
  });

  test('builds preview plan for tv items with default language', async () => {
    generatePreviewPlanImpl = async (items, language) => {
      expect(language).toBe('zh-CN');
      expect(items).toEqual([{
        kind: 'tv',
        sourcePath: '/inbox/andor.mkv',
        showName: 'Andor',
        tmdbId: 101,
        season: 1,
        episodes: [{ source: '/inbox/andor.mkv', episode: 1 }],
      }]);
      return {
        actions: [{ type: 'move', source: '/inbox/andor.mkv', destination: '/tv/Andor/Season 01/Andor - S01E01.mkv', willOverwrite: false }],
        impactSummary: {
          filesMoving: 1,
          nfoCreating: 3,
          nfoOverwriting: 0,
          postersDownloading: 2,
          directoriesCreating: ['/tv/Andor', '/tv/Andor/Season 01'],
        },
      };
    };

    const app = createApp();
    const res = await app.request('/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{
          kind: 'tv',
          sourcePath: '/inbox/andor.mkv',
          showName: 'Andor',
          tmdbId: 101,
          season: 1,
          episodes: [{ source: '/inbox/andor.mkv', episode: 1 }],
        }],
      }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: {
        impactSummary: {
          filesMoving: 1,
          nfoCreating: 3,
          postersDownloading: 2,
        },
      },
    });
  });

  test('passes explicit language for movie preview items', async () => {
    generatePreviewPlanImpl = async (items, language) => {
      expect(language).toBe('en-US');
      expect(items).toEqual([{ kind: 'movie', sourcePath: '/inbox/arrival.mkv', tmdbId: 202 }]);
      return {
        actions: [{ type: 'move', source: '/inbox/arrival.mkv', destination: '/movies/Arrival (2016)/Arrival (2016).mkv', willOverwrite: true }],
        impactSummary: {
          filesMoving: 1,
          nfoCreating: 0,
          nfoOverwriting: 1,
          postersDownloading: 0,
          directoriesCreating: [],
        },
      };
    };

    const app = createApp();
    const res = await app.request('/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'en-US',
        items: [{ kind: 'movie', sourcePath: '/inbox/arrival.mkv', tmdbId: 202 }],
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      success: true,
      data: {
        impactSummary: { nfoOverwriting: 1 },
      },
    });
  });
});
