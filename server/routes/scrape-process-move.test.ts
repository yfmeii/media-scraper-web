import { beforeEach, describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import { createHandleMoveToInbox } from './scrape-process-move';

class MockMoveToInboxError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let moveMediaToInboxImpl: (...args: any[]) => Promise<any>;
let invalidateMovedItemCacheImpl: (...args: any[]) => Promise<any>;

function createApp() {
  const app = new Hono();
  const handleMoveToInbox = createHandleMoveToInbox({
    moveMediaToInbox: (...args: any[]) => moveMediaToInboxImpl(...args),
    invalidateMovedItemCache: (...args: any[]) => invalidateMovedItemCacheImpl(...args),
    MoveToInboxError: MockMoveToInboxError,
  });
  app.post('/move-to-inbox', handleMoveToInbox);
  return app;
}

beforeEach(() => {
  moveMediaToInboxImpl = async () => ({ success: true, message: 'ok' });
  invalidateMovedItemCacheImpl = async () => undefined;
});

describe('scrape-process-move route', () => {
  test('moves item and invalidates resolved cache path', async () => {
    let invalidatedPath: string | undefined;

    moveMediaToInboxImpl = async (sourcePath) => {
      expect(sourcePath).toBe('/tv/Andor/Season 01/Andor - S01E01.mkv');
      return { success: true, message: 'moved' };
    };
    invalidateMovedItemCacheImpl = async (sourcePath) => {
      invalidatedPath = sourcePath;
    };

    const app = createApp();
    const res = await app.request('/move-to-inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath: '/tv/Andor/Season 01/Andor - S01E01.mkv' }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, message: 'moved' });
    expect(invalidatedPath).toBe('/tv/Andor/Season 01/Andor - S01E01.mkv');
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

  test('returns 500 for unexpected errors', async () => {
    moveMediaToInboxImpl = async () => {
      throw new Error('disk error');
    };

    const app = createApp();
    const res = await app.request('/move-to-inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath: '/movies/Arrival (2016)' }),
    });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ success: false, error: 'disk error' });
  });
});
