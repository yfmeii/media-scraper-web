import type { MediaFile } from './api';

export interface InboxBatchProcessorResult {
  success: boolean;
  mediaType?: 'tv' | 'movie';
}

export interface InboxBatchSummary {
  successCount: number;
  failCount: number;
  tvCount: number;
  movieCount: number;
}

export interface InboxBatchHooks {
  onStart?: (file: MediaFile, context: { current: number; total: number }) => void;
  onSettled?: (
    file: MediaFile,
    outcome: InboxBatchProcessorResult,
    context: { current: number; total: number },
  ) => void;
  onError?: (file: MediaFile, error: unknown, context: { current: number; total: number }) => void;
}

export async function runInboxBatchProcess(
  files: MediaFile[],
  processor: (file: MediaFile, context: { current: number; total: number }) => Promise<InboxBatchProcessorResult>,
  hooks: InboxBatchHooks = {},
): Promise<InboxBatchSummary> {
  const summary: InboxBatchSummary = {
    successCount: 0,
    failCount: 0,
    tvCount: 0,
    movieCount: 0,
  };

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const context = { current: index + 1, total: files.length };
    hooks.onStart?.(file, context);

    try {
      const outcome = await processor(file, context);
      if (outcome.success) {
        summary.successCount++;
        if (outcome.mediaType === 'movie') summary.movieCount++;
        if (outcome.mediaType === 'tv') summary.tvCount++;
      } else {
        summary.failCount++;
      }
      hooks.onSettled?.(file, outcome, context);
    } catch (error) {
      summary.failCount++;
      hooks.onError?.(file, error, context);
      hooks.onSettled?.(file, { success: false }, context);
    }
  }

  return summary;
}
