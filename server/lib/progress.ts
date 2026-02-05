// SSE Progress System for batch operations

import type { ProgressEvent } from '@media-scraper/shared';

export type { ProgressEvent } from '@media-scraper/shared';

type ProgressListener = (data: ProgressEvent) => void;

class ProgressEmitter {
  private listeners: Set<ProgressListener> = new Set();
  
  subscribe(listener: ProgressListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  emit(event: ProgressEvent) {
    this.listeners.forEach(listener => listener(event));
  }
}

export const progressEmitter = new ProgressEmitter();

// Helper to create progress events
export function emitProgress(
  taskId: string,
  type: ProgressEvent['type'],
  current: number,
  total: number,
  item?: string,
  message?: string
) {
  progressEmitter.emit({
    type,
    taskId,
    item,
    current,
    total,
    percent: total > 0 ? Math.round((current / total) * 100) : 0,
    message,
  });
}
