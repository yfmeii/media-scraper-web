import {
  buildPreviewItemFromSelection,
  extractPreviewTargetPath,
  inferMediaTypeFromParsed,
} from '@media-scraper/shared/inbox-workflow';
import type { MediaFile, PreviewItem, SearchResult } from '$lib/api';
import { previewPlan } from '$lib/api';

export function buildInboxPreviewItem(params: {
  file: MediaFile | null;
  candidate: SearchResult | null;
  season: number;
  episode: number;
}): PreviewItem | null {
  if (!params.file || !params.candidate) return null;
  return buildPreviewItemFromSelection({
    file: params.file,
    candidate: params.candidate,
    season: params.season,
    episode: params.episode,
    fallbackKind: inferMediaTypeFromParsed(params.file.parsed),
  });
}

export async function resolveInboxTargetPath(params: {
  showDetailModal: boolean;
  file: MediaFile | null;
  candidate: SearchResult | null;
  season: number;
  episode: number;
}): Promise<string> {
  const item = buildInboxPreviewItem({
    file: params.file,
    candidate: params.candidate,
    season: params.season,
    episode: params.episode,
  });
  if (!params.showDetailModal || !item) return '';
  const plan = await previewPlan([item]);
  return extractPreviewTargetPath(plan, item.sourcePath);
}
