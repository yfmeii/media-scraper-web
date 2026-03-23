import { describe, expect, test } from 'bun:test';
import type { MediaFile, SearchResult } from '$lib/api';
import { createInboxDetailFlow } from './inboxDetailFlow';
import { createInboxDetailUiState } from './inboxPageState';

const file = {
  path: '/inbox/show.mkv',
  name: 'show.mkv',
  relativePath: 'show.mkv',
  size: 1,
  kind: 'tv',
  parsed: { title: 'Show', season: 1, episode: 2 },
  hasNfo: false,
  isProcessed: false,
} satisfies MediaFile;

const candidate = { id: 9, name: 'Picked Match' } satisfies SearchResult;

function createSubject() {
  return createInboxDetailFlow({
    loadInboxDetailMatch: async () => ({
      candidates: [{ id: 1, name: 'Match A' }],
      selectedCandidate: { id: 1, name: 'Match A' },
      isAutoMatched: true,
      matchScore: 92,
    }),
    searchInboxCandidates: async () => [{ id: 2, name: 'Manual Match' }],
    resolveInboxAiRecognize: async () => ({
      aiRecognizeResult: { title: 'AI Show', confidence: 0.9, season: 3, episode: 4 },
      matchCandidates: [{ id: 3, name: 'AI Match' }],
      selectedCandidate: { id: 3, name: 'AI Match' },
      editSeason: 3,
      editEpisode: 4,
      operationMessage: 'ai ok',
    }),
    refreshInboxTargetPath: async () => '/library/Show/Season 03/Show.S03E04.mkv',
  });
}

describe('inboxDetailFlow', () => {
  test('opens detail flow and resolves target path', async () => {
    const subject = createSubject();
    const state = await subject.openInboxDetailFlow(file, createInboxDetailUiState());

    expect(state.showDetailModal).toBe(true);
    expect(state.selectedFile).toEqual(file);
    expect(state.matchCandidates).toEqual([{ id: 1, name: 'Match A' }]);
    expect(state.selectedCandidate).toEqual({ id: 1, name: 'Match A' });
    expect(state.targetPath).toBe('/library/Show/Season 03/Show.S03E04.mkv');
    expect(state.isSearchingTMDB).toBe(false);
  });

  test('searches manual candidates and refreshes preview path', async () => {
    const subject = createSubject();
    const next = await subject.searchInboxDetailCandidates({
      ...createInboxDetailUiState(),
      showDetailModal: true,
      selectedFile: file,
      detailFile: file,
      selectedCandidate: candidate,
      manualSearchQuery: 'manual',
    });

    expect(next.matchCandidates).toEqual([{ id: 2, name: 'Manual Match' }]);
    expect(next.selectedCandidate).toBeNull();
    expect(next.targetPath).toBe('');
    expect(next.isSearchingTMDB).toBe(false);
  });

  test('runs ai recognize flow and updates detail state', async () => {
    const subject = createSubject();
    const result = await subject.runInboxAiRecognizeFlow({
      ...createInboxDetailUiState(),
      showDetailModal: true,
      selectedFile: file,
      detailFile: file,
      selectedCandidate: candidate,
      editSeason: 1,
      editEpisode: 2,
    });

    expect(result.operationMessage).toBe('ai ok');
    expect(result.detailState.aiRecognizeResult).toMatchObject({ title: 'AI Show' });
    expect(result.detailState.selectedCandidate).toEqual({ id: 3, name: 'AI Match' });
    expect(result.detailState.editSeason).toBe(3);
    expect(result.detailState.editEpisode).toBe(4);
    expect(result.detailState.targetPath).toBe('/library/Show/Season 03/Show.S03E04.mkv');
  });

  test('updates candidate selection and clears closed selections', async () => {
    const subject = createSubject();
    const selected = await subject.selectInboxDetailCandidate({
      ...createInboxDetailUiState(),
      showDetailModal: true,
      selectedFile: file,
      detailFile: file,
    }, candidate);

    expect(selected.selectedCandidate).toEqual(candidate);
    expect(selected.targetPath).toBe('/library/Show/Season 03/Show.S03E04.mkv');
  });

  test('clears target path when selection is incomplete', async () => {
    const subject = createSubject();
    const state = await subject.refreshInboxDetailTargetPath({
      ...createInboxDetailUiState(),
      showDetailModal: true,
      selectedFile: file,
      detailFile: file,
    });

    expect(state.targetPath).toBe('');
    expect(state.isLoadingTargetPath).toBe(false);
  });
});
