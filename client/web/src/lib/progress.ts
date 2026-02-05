/**
 * 进度处理工具函数
 * 用于处理 SSE 进度事件
 */

import type { ProgressEvent } from './api';

export interface ProgressState {
  progressMap: Map<string, number>;
  processingPaths: Set<string>;
  operationMessage: string;
}

/**
 * 创建进度处理器
 */
export function createProgressHandler(
  getState: () => ProgressState,
  setState: (state: Partial<ProgressState>) => void
) {
  return function handleProgress(event: ProgressEvent) {
    const state = getState();
    
    // 检查是否在处理列表中
    if (event.item && state.processingPaths.has(event.item)) {
      const newMap = new Map(state.progressMap);
      newMap.set(event.item, event.percent);
      setState({
        progressMap: newMap,
        operationMessage: event.message || '',
      });
    }
    
    // 完成时清理
    if (event.type === 'complete' && state.processingPaths.size > 0) {
      setTimeout(() => {
        setState({
          progressMap: new Map(),
          processingPaths: new Set(),
        });
      }, 2000);
    }
  };
}

/**
 * 格式化进度百分比
 */
export function formatProgress(percent: number): string {
  return `${Math.round(percent)}%`;
}

/**
 * 创建批量进度跟踪器
 */
export function createBatchProgressTracker(total: number) {
  let current = 0;
  let successCount = 0;
  let failCount = 0;
  
  return {
    get progress() {
      return { current, total };
    },
    get summary() {
      return { successCount, failCount };
    },
    next() {
      current++;
      return current;
    },
    success() {
      successCount++;
    },
    fail() {
      failCount++;
    },
    reset() {
      current = 0;
      successCount = 0;
      failCount = 0;
    },
  };
}
