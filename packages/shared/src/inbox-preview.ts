import { inferCandidateMediaType, inferMediaTypeFromParsed } from './inbox-common';
import type { MediaFile, PreviewAction, PreviewItem, PreviewPlan, SearchResult } from './types';

export function buildInboxBatchSummaryMessage(summary: {
  successCount: number;
  tvCount: number;
  movieCount: number;
  failCount: number;
}): string {
  return `完成: ${summary.successCount} 成功 (${summary.tvCount} 剧集, ${summary.movieCount} 电影), ${summary.failCount} 失败`;
}

export function createInboxPreviewState(plan: PreviewPlan | null): {
  previewActions: PreviewAction[];
  previewSummary: PreviewPlan['impactSummary'] | null;
} {
  if (!plan) {
    return {
      previewActions: [],
      previewSummary: null,
    };
  }

  return {
    previewActions: plan.actions,
    previewSummary: plan.impactSummary,
  };
}

export function extractPreviewTargetPath(plan: PreviewPlan, sourcePath: string): string {
  const directMove = plan.actions.find(action => action.type === 'move' && action.source === sourcePath);
  if (directMove?.destination) return directMove.destination;

  const firstMove = plan.actions.find(action => action.type === 'move');
  if (firstMove?.destination) return firstMove.destination;

  const firstDir = plan.actions.find(action => action.type === 'create-dir');
  return firstDir?.destination || '';
}

export function buildPreviewItemFromSelection(params: {
  file: Pick<MediaFile, 'path' | 'name' | 'parsed'>;
  candidate: SearchResult;
  season?: number;
  episode?: number;
  fallbackKind?: 'tv' | 'movie';
}): PreviewItem {
  const { file, candidate, season = 1, episode = 1 } = params;
  const kind = inferCandidateMediaType(candidate, params.fallbackKind || inferMediaTypeFromParsed(file.parsed));
  const item: PreviewItem = {
    sourcePath: file.path,
    kind,
    tmdbId: candidate.id,
    showName: candidate.name || candidate.title || file.name,
  };
  if (kind === 'tv') {
    item.season = season;
    item.episodes = [{
      source: file.path,
      episode,
      episodeEnd: file.parsed.episodeEnd,
    }];
  }
  return item;
}
