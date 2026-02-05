import { describe, expect, test } from 'bun:test';
import { emitProgress, progressEmitter } from './progress';

describe('进度事件', () => {
  test('📣 订阅者可以收到进度事件', () => {
    let received: any = null;
    const unsubscribe = progressEmitter.subscribe((event) => {
      received = event;
    });

    emitProgress('t1', 'progress', 1, 2, '/a', '处理中');
    unsubscribe();

    expect(received).toEqual({
      type: 'progress',
      taskId: 't1',
      item: '/a',
      current: 1,
      total: 2,
      percent: 50,
      message: '处理中',
    });
  });

  test('🧮 百分比按当前/总数计算', () => {
    let percent = 0;
    const unsubscribe = progressEmitter.subscribe((event) => {
      percent = event.percent;
    });

    emitProgress('t2', 'progress', 3, 4);
    unsubscribe();

    expect(percent).toBe(75);
  });
});
