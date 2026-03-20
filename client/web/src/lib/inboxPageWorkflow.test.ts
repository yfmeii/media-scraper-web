import { describe, expect, mock, test } from 'bun:test';
import { applyAiRecognizeState, buildInboxBatchSummaryMessage, createInboxPreviewState } from '@media-scraper/shared/inbox-workflow';
import type { MediaFile, PreviewPlan } from '$lib/api';
import {
  applyProcessedFile,
  createPostBatchState,
  getInboxBatchSelection,
} from './inboxPageWorkflow';

const files = [
  {
    path: '/a',
    name: 'A.mkv',
    relativePath: 'A.mkv',
    size: 1,
    kind: 'movie',
    parsed: { title: 'A' },
    hasNfo: false,
    isProcessed: false,
  },
  {
    path: '/b',
    name: 'B.mkv',
    relativePath: 'B.mkv',
    size: 1,
    kind: 'movie',
    parsed: { title: 'B' },
    hasNfo: false,
    isProcessed: false,
  },
] satisfies MediaFile[];

describe('inboxPageWorkflow', () => {
  test('marks processed file across related page state', () => {
    const state = applyProcessedFile({
      files,
      allFiles: files,
      selectedFile: files[0],
      detailFile: files[0],
    }, '/a');

    expect(state.updated).toBe(true);
    expect(state.files[0].isProcessed).toBe(true);
    expect(state.allFiles[0].isProcessed).toBe(true);
    expect(state.selectedFile?.isProcessed).toBe(true);
    expect(state.detailFile?.isProcessed).toBe(true);
  });

  test('returns selected batch files from source collection', () => {
    expect(getInboxBatchSelection(files, new Set(['/b']))).toEqual([files[1]]);
  });

  test('builds batch summary text and post-batch state', () => {
    const summary = { successCount: 2, tvCount: 1, movieCount: 1, failCount: 3 };
    expect(buildInboxBatchSummaryMessage(summary)).toBe('完成: 2 成功 (1 剧集, 1 电影), 3 失败');

    expect(createPostBatchState({ summary, selectedFiles: new Set(['/a']) })).toEqual({
      hadSuccess: true,
      operationMessage: '完成: 2 成功 (1 剧集, 1 电影), 3 失败',
      selectedFiles: new Set(),
    });

    expect(createPostBatchState({
      summary: { successCount: 0, tvCount: 0, movieCount: 0, failCount: 1 },
      selectedFiles: new Set(['/a']),
    })).toEqual({
      hadSuccess: false,
      operationMessage: '完成: 0 成功 (0 剧集, 0 电影), 1 失败',
      selectedFiles: new Set(['/a']),
    });
  });

  test('maps preview plan into modal state', () => {
    const plan: PreviewPlan = {
      actions: [{ type: 'create-dir', destination: '/tv/A', willOverwrite: false }],
      impactSummary: {
        filesMoving: 1,
        nfoCreating: 1,
        nfoOverwriting: 0,
        postersDownloading: 1,
        directoriesCreating: ['/tv/A'],
      },
    };

    expect(createInboxPreviewState(plan)).toEqual({
      previewActions: plan.actions,
      previewSummary: plan.impactSummary,
    });
    expect(createInboxPreviewState(null)).toEqual({
      previewActions: [],
      previewSummary: null,
    });
  });

  test('applies AI recognize result with fallback season and episode', () => {
    const applied = applyAiRecognizeState({
      resolved: {
        aiRecognizeResult: null,
        matchCandidates: [{ id: 1, name: 'A' }],
        selectedCandidate: { id: 1, name: 'A' },
        operationMessage: 'ok',
      },
      currentSeason: 2,
      currentEpisode: 9,
    });

    expect(applied).toEqual({
      aiRecognizeResult: null,
      matchCandidates: [{ id: 1, name: 'A' }],
      selectedCandidate: { id: 1, name: 'A' },
      editSeason: 2,
      editEpisode: 9,
      operationMessage: 'ok',
    });
  });
});
