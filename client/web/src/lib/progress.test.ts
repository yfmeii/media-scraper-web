import { describe, expect, test } from 'bun:test';
import { createProgressHandler } from './progress';
import type { ProgressEvent } from './api';

describe('progress', () => {
  test('🚀 进度事件更新 map 与提示', () => {
    let state = {
      progressMap: new Map<string, number>([['/a', 0]]),
      processingPaths: new Set<string>(['/a']),
      operationMessage: '',
    };

    const handler = createProgressHandler(
      () => state,
      (patch) => {
        state = { ...state, ...patch };
      }
    );

    const event: ProgressEvent = {
      type: 'progress',
      taskId: 't1',
      item: '/a',
      current: 1,
      total: 2,
      percent: 50,
      message: '处理中',
    };

    handler(event);

    expect(state.progressMap.get('/a')).toBe(50);
    expect(state.operationMessage).toBe('处理中');
  });

  // 批量进度与百分比格式化已移除
});
