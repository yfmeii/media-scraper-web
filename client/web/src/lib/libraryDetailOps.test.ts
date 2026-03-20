import { describe, expect, test } from 'bun:test';
import {
  buildErrorMessage,
  buildMatchFailureMessage,
  buildMatchStartMessage,
  buildRefreshFailureMessage,
  buildRefreshResultMessage,
  reloadLibraryItems,
  syncSelectedDetailItem,
} from './libraryDetailOps';

describe('libraryDetailOps helpers', () => {
  test('builds common operation messages', () => {
    expect(buildMatchStartMessage({ name: 'Andor' })).toBe('正在匹配 Andor...');
    expect(buildMatchFailureMessage('boom')).toBe('匹配失败: boom');
    expect(buildRefreshFailureMessage('nope')).toBe('失败: nope');
    expect(buildErrorMessage('bad')).toBe('错误: bad');
    expect(buildRefreshResultMessage({ success: true }, '刷新成功')).toBe('刷新成功');
    expect(buildRefreshResultMessage({ success: false, message: 'missing' }, '刷新成功')).toBe('失败: missing');
  });

  test('reloads list immutably and syncs selected detail item', async () => {
    const items = await reloadLibraryItems(async () => [{ path: '/a', name: 'A' }, { path: '/b', name: 'B2' }]);
    expect(items).toEqual([{ path: '/a', name: 'A' }, { path: '/b', name: 'B2' }]);
    expect(syncSelectedDetailItem(items, { path: '/b', name: 'Old' })).toEqual({ path: '/b', name: 'B2' });
    expect(syncSelectedDetailItem(items, { path: '/c', name: 'Missing' })).toBeNull();
  });
});
