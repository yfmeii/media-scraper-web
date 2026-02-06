import type { ScrapeResult } from '$lib/api';

export interface BatchRefreshTarget {
  path: string;
  name: string;
  tmdbId: number;
}

export interface BatchRefreshProgress {
  current: number;
  total: number;
  target: BatchRefreshTarget;
}

export interface BatchRefreshResult {
  successCount: number;
  failCount: number;
}

export async function runBatchRefresh(
  kind: 'tv' | 'movie',
  targets: BatchRefreshTarget[],
  refresh: (kind: 'tv' | 'movie', path: string, tmdbId: number) => Promise<ScrapeResult>,
  onProgress?: (progress: BatchRefreshProgress) => void,
): Promise<BatchRefreshResult> {
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    onProgress?.({
      current: i + 1,
      total: targets.length,
      target,
    });

    const result = await refresh(kind, target.path, target.tmdbId);
    if (result.success) successCount++;
    else failCount++;
  }

  return { successCount, failCount };
}
