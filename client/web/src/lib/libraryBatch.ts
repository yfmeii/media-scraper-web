import { runBatchRefresh, type BatchRefreshTarget } from './batchRefresh';
import type { ScrapeResult } from './api';

export interface BatchRefreshPlanResult<T> {
  targets: BatchRefreshTarget[];
  missingTmdbCount: number;
  selectedItems: T[];
}

export function buildBatchRefreshPlan<T extends { path: string; name: string; tmdbId?: number }>(
  items: T[],
  selectedPaths: Set<string>,
): BatchRefreshPlanResult<T> {
  const selectedItems = Array.from(selectedPaths)
    .map(path => items.find(item => item.path === path))
    .filter((item): item is T => item !== undefined);
  const missingTmdbCount = selectedItems.filter(item => !item.tmdbId).length;
  const targets = selectedItems
    .filter((item): item is T & { tmdbId: number } => typeof item.tmdbId === 'number')
    .map(item => ({
      path: item.path,
      name: item.name,
      tmdbId: item.tmdbId,
    }));

  return { targets, missingTmdbCount, selectedItems };
}

export function buildMissingTmdbMessage(count: number, unitLabel: string): string {
  return `${count} ${unitLabel}没有 TMDB ID，请先手动匹配`;
}

export function buildRefreshProgressMessage(current: number, total: number, name: string): string {
  return `正在刷新 (${current}/${total}): ${name}`;
}

export function buildRefreshCompletedMessage(successCount: number, failCount: number): string {
  return `完成: ${successCount} 成功, ${failCount} 失败`;
}

export async function executeBatchRefresh(
  kind: 'tv' | 'movie',
  targets: BatchRefreshTarget[],
  refresh: (kind: 'tv' | 'movie', path: string, tmdbId: number) => Promise<ScrapeResult>,
  onProgress?: (progress: { current: number; total: number; message: string }) => void,
) {
  return runBatchRefresh(kind, targets, refresh, ({ current, total, target }) => {
    onProgress?.({
      current,
      total,
      message: buildRefreshProgressMessage(current, total, target.name),
    });
  });
}
