import type { MatchResult, PreviewPlan, TaskStats } from './types';

export function createEmptyTaskStats(): TaskStats {
  return { total: 0, pending: 0, running: 0, success: 0, failed: 0 };
}

export function createEmptyMatchResult(): MatchResult {
  return { matched: false, candidates: [] };
}

export function createEmptyPreviewPlan(): PreviewPlan {
  return {
    actions: [],
    impactSummary: {
      filesMoving: 0,
      nfoCreating: 0,
      nfoOverwriting: 0,
      postersDownloading: 0,
      directoriesCreating: [],
    },
  };
}
