import { describe, expect, test } from 'bun:test';
import { runBatchRefresh } from './batchRefresh';

describe('batchRefresh helpers', () => {
  test('tracks progress and counts successes and failures', async () => {
    const targets = [
      { path: '/tv/a', name: 'A', tmdbId: 1 },
      { path: '/tv/b', name: 'B', tmdbId: 2 },
      { path: '/tv/c', name: 'C', tmdbId: 3 },
    ];
    const progress: string[] = [];

    const result = await runBatchRefresh(
      'tv',
      targets,
      async (_kind, path) => ({ success: path !== '/tv/b' }),
      ({ current, total, target }) => {
        progress.push(`${current}/${total}:${target.name}`);
      },
    );

    expect(progress).toEqual(['1/3:A', '2/3:B', '3/3:C']);
    expect(result).toEqual({ successCount: 2, failCount: 1 });
  });

  test('skips refresh work when target list is empty', async () => {
    let called = false;

    const result = await runBatchRefresh('movie', [], async () => {
      called = true;
      return { success: true };
    });

    expect(called).toBe(false);
    expect(result).toEqual({ successCount: 0, failCount: 0 });
  });
});
