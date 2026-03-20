import { describe, expect, test } from 'bun:test';
import type { MediaFile } from '$lib/api';
import {
  createClosingInboxDetailUiState,
  createInboxDetailUiState,
  createInboxOperationUiState,
  createInboxPreviewUiState,
  createOpenedInboxDetailUiState,
  setInboxFileProcessStatus,
} from './inboxPageState';

const file = {
  path: '/tv/a.mkv',
  name: 'a.mkv',
  relativePath: 'Show/a.mkv',
  size: 1,
  kind: 'tv',
  parsed: { title: 'Show', season: 2, episode: 3 },
  hasNfo: false,
  isProcessed: false,
} satisfies MediaFile;

describe('inboxPageState', () => {
  test('creates default grouped ui state', () => {
    expect(createInboxDetailUiState()).toMatchObject({
      selectedFile: null,
      detailFile: null,
      showDetailModal: false,
      editSeason: 1,
      editEpisode: 1,
      targetPathSeq: 0,
    });

    expect(createInboxOperationUiState()).toEqual({
      isOperating: false,
      operationMessage: '',
      batchProgress: { current: 0, total: 0 },
      fileStatus: new Map(),
    });

    expect(createInboxPreviewUiState()).toEqual({
      showPreviewModal: false,
      previewActions: [],
      previewSummary: null,
      isLoadingPreview: false,
    });
  });

  test('creates opened and closing detail modal states', () => {
    expect(createOpenedInboxDetailUiState(file, 4)).toMatchObject({
      selectedFile: file,
      detailFile: file,
      showDetailModal: true,
      editSeason: 2,
      editEpisode: 3,
      targetPathSeq: 5,
    });

    expect(createClosingInboxDetailUiState({
      selectedFile: file,
      detailFile: file,
      currentTargetPathSeq: 5,
    })).toMatchObject({
      selectedFile: file,
      detailFile: file,
      showDetailModal: false,
      matchCandidates: [],
      targetPathSeq: 6,
    });
  });

  test('updates file process status immutably', () => {
    const current = new Map<string, 'processing' | 'success' | 'failed'>([['/tv/a.mkv', 'processing']]);
    const next = setInboxFileProcessStatus(current, '/tv/b.mkv', 'success');

    expect(current).toEqual(new Map([['/tv/a.mkv', 'processing']]));
    expect(next).toEqual(new Map([
      ['/tv/a.mkv', 'processing'],
      ['/tv/b.mkv', 'success'],
    ]));
  });
});
