import { describe, expect, test } from 'bun:test';
import { runInboxBatchProcess } from './inboxBatch';

const files = [
  { path: 'a', name: 'A' },
  { path: 'b', name: 'B' },
  { path: 'c', name: 'C' },
] as any[];

describe('runInboxBatchProcess', () => {
  test('tracks success and media type totals', async () => {
    const summary = await runInboxBatchProcess(files, async (file) => {
      if (file.path === 'a') return { success: true, mediaType: 'tv' };
      if (file.path === 'b') return { success: true, mediaType: 'movie' };
      return { success: false };
    });

    expect(summary).toEqual({
      successCount: 2,
      failCount: 1,
      tvCount: 1,
      movieCount: 1,
    });
  });

  test('continues processing after processor throws', async () => {
    const settled: string[] = [];
    const errored: string[] = [];

    const summary = await runInboxBatchProcess(files, async (file) => {
      if (file.path === 'b') throw new Error('boom');
      return { success: true, mediaType: 'tv' };
    }, {
      onSettled: file => settled.push(file.path),
      onError: file => errored.push(file.path),
    });

    expect(summary).toEqual({
      successCount: 2,
      failCount: 1,
      tvCount: 2,
      movieCount: 0,
    });
    expect(errored).toEqual(['b']);
    expect(settled).toEqual(['a', 'b', 'c']);
  });
});
