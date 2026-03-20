import type { ScrapeResult, SearchResult } from './api';

export function buildMatchStartMessage(result: Pick<SearchResult, 'name' | 'title'>): string {
  return `正在匹配 ${result.name || result.title}...`;
}

export function buildMatchFailureMessage(message?: string): string {
  return `匹配失败: ${message || '未知错误'}`;
}

export function buildErrorMessage(error: unknown): string {
  return `错误: ${error}`;
}

export function buildRefreshFailureMessage(message?: string): string {
  return `失败: ${message || '未知错误'}`;
}

export function buildRefreshResultMessage(result: Pick<ScrapeResult, 'success' | 'message'>, successMessage: string): string {
  return result.success ? successMessage : buildRefreshFailureMessage(result.message);
}

export function withClearedMessage(clear: () => void, delay = 3000): Timer {
  return setTimeout(() => {
    clear();
  }, delay);
}

export async function reloadLibraryItems<T>(loader: () => Promise<T[]>): Promise<T[]> {
  const nextItems = await loader();
  return [...nextItems];
}

export function syncSelectedDetailItem<T extends { path: string }>(
  items: T[],
  selectedItem: T | null,
): T | null {
  if (!selectedItem) return null;
  return items.find(item => item.path === selectedItem.path) || null;
}
