import { describe, expect, test } from 'bun:test';
import { createBatchProgressTracker, createProgressHandler, formatProgress } from './progress';
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

  test('📊 批量进度统计递增与重置', () => {
    const tracker = createBatchProgressTracker(3);

    tracker.success();
    tracker.next();
    tracker.fail();
    tracker.next();

    expect(tracker.progress).toEqual({ current: 2, total: 3 });
    expect(tracker.summary).toEqual({ successCount: 1, failCount: 1 });

    tracker.reset();
    expect(tracker.progress).toEqual({ current: 0, total: 3 });
    expect(tracker.summary).toEqual({ successCount: 0, failCount: 0 });
  });

  test('🧮 百分比格式化输出', () => {
    expect(formatProgress(12.7)).toBe('13%');
  });
});
