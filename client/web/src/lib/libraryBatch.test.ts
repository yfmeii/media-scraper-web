import { describe, expect, test } from 'bun:test';
import {
  buildBatchRefreshPlan,
  buildMissingTmdbMessage,
  buildRefreshCompletedMessage,
  buildRefreshProgressMessage,
  executeBatchRefresh,
} from './libraryBatch';

describe('libraryBatch helpers', () => {
  const items = [
    { path: '/tv/a', name: 'A', tmdbId: 1 },
    { path: '/tv/b', name: 'B' },
    { path: '/tv/c', name: 'C', tmdbId: 3 },
  ];

  test('builds refresh plan from selected items', () => {
    const plan = buildBatchRefreshPlan(items, new Set(['/tv/b', '/tv/c']));

    expect(plan.missingTmdbCount).toBe(1);
    expect(plan.selectedItems).toEqual([items[1], items[2]]);
    expect(plan.targets).toEqual([{ path: '/tv/c', name: 'C', tmdbId: 3 }]);
  });

  test('builds library batch messages', () => {
    expect(buildMissingTmdbMessage(2, '部电影')).toBe('2 部电影没有 TMDB ID，请先手动匹配');
    expect(buildRefreshProgressMessage(1, 3, 'Andor')).toBe('正在刷新 (1/3): Andor');
    expect(buildRefreshCompletedMessage(2, 1)).toBe('完成: 2 成功, 1 失败');
  });

  test('executes batch refresh and reports progress', async () => {
    const messages: string[] = [];
    const result = await executeBatchRefresh(
      'movie',
      [{ path: '/movie/a', name: 'A', tmdbId: 1 }, { path: '/movie/b', name: 'B', tmdbId: 2 }],
      async (_kind, path) => ({ success: path === '/movie/a' }),
      progress => messages.push(progress.message),
    );

    expect(messages).toEqual(['正在刷新 (1/2): A', '正在刷新 (2/2): B']);
    expect(result).toEqual({ successCount: 1, failCount: 1 });
  });
});
