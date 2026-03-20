import { describe, expect, mock, test } from 'bun:test';
import type { MediaFile } from '$lib/api';

mock.module('$lib/inboxBatch', () => ({
  runInboxBatchProcess: mock(async (files, processor, hooks) => {
    let successCount = 0;
    let failCount = 0;
    let tvCount = 0;
    let movieCount = 0;

    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const context = { current: index + 1, total: files.length };
      hooks.onStart?.(file, context);
      const outcome = await processor(file, context);
      if (outcome.success) {
        successCount++;
        if (outcome.mediaType === 'tv') tvCount++;
        if (outcome.mediaType === 'movie') movieCount++;
      } else {
        failCount++;
      }
      hooks.onSettled?.(file, outcome, context);
    }

    return { successCount, failCount, tvCount, movieCount };
  }),
}));

import { executeInboxBatchFlow } from './inboxBatchFlow';

const files = [
  {
    path: '/a',
    name: 'A.mkv',
    relativePath: 'A.mkv',
    size: 1,
    kind: 'movie',
    parsed: { title: 'A' },
    hasNfo: false,
    isProcessed: false,
  },
  {
    path: '/b',
    name: 'B.mkv',
    relativePath: 'B.mkv',
    size: 1,
    kind: 'tv',
    parsed: { title: 'B', season: 1, episode: 1 },
    hasNfo: false,
    isProcessed: false,
  },
] satisfies MediaFile[];

describe('inboxBatchFlow', () => {
  test('runs batch lifecycle and post-processing hooks', async () => {
    const statuses: Array<[string, string]> = [];
    const messages: string[] = [];
    const progresses: Array<{ current: number; total: number }> = [];
    const processed: string[] = [];
    const operating: boolean[] = [];
    const selectedSnapshots: Set<string>[] = [];
    let reloadCount = 0;

    await executeInboxBatchFlow({
      allFiles: files,
      selectedFiles: new Set(['/a', '/b']),
      processor: async (file, context, setOperationMessage) => {
        setOperationMessage(`processing:${context.current}:${file.path}`);
        return { success: file.path === '/a', mediaType: file.kind === 'tv' ? 'tv' : 'movie' };
      },
      setOperating: (value) => operating.push(value),
      setOperationMessage: (message) => messages.push(message),
      setBatchProgress: (progress) => progresses.push(progress),
      setFileStatus: (path, status) => statuses.push([path, status]),
      markFileProcessed: (path) => processed.push(path),
      reloadData: async () => { reloadCount++; },
      updateSelectedFiles: (selected) => selectedSnapshots.push(selected),
      scheduleReset: (callback) => callback(),
    });

    expect(operating).toEqual([true, false]);
    expect(messages).toEqual([
      'processing:1:/a',
      'processing:2:/b',
      '完成: 1 成功 (0 剧集, 1 电影), 1 失败',
      '',
    ]);
    expect(progresses).toEqual([
      { current: 0, total: 2 },
      { current: 1, total: 2 },
      { current: 2, total: 2 },
    ]);
    expect(statuses).toEqual([
      ['/a', 'processing'],
      ['/a', 'success'],
      ['/b', 'processing'],
      ['/b', 'failed'],
    ]);
    expect(processed).toEqual(['/a']);
    expect(reloadCount).toBe(1);
    expect(selectedSnapshots).toEqual([new Set()]);
  });
});
