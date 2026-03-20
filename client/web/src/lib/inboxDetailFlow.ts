import type { MediaFile, SearchResult } from '$lib/api';
import { applyAiRecognizeState } from '@media-scraper/shared/inbox-workflow';
import { loadInboxDetailMatch, searchInboxCandidates } from '$lib/inboxMatch';
import { resolveInboxAiRecognize } from '$lib/inboxRecognize';
import {
  createClosingInboxDetailUiState,
  createOpenedInboxDetailUiState,
  type InboxDetailUiState,
} from '$lib/inboxPageState';
import { refreshInboxTargetPath } from '$lib/inboxPageWorkflow';

export function closeInboxDetailFlow(detailState: InboxDetailUiState): InboxDetailUiState {
  return createClosingInboxDetailUiState({
    selectedFile: detailState.selectedFile,
    detailFile: detailState.detailFile,
    currentTargetPathSeq: detailState.targetPathSeq,
  });
}

export function clearClosedInboxDetailSelection(detailState: InboxDetailUiState): InboxDetailUiState {
  if (detailState.showDetailModal) {
    return detailState;
  }

  return {
    ...detailState,
    selectedFile: null,
    detailFile: null,
  };
}

export async function refreshInboxDetailTargetPath(
  detailState: InboxDetailUiState,
): Promise<InboxDetailUiState> {
  if (!detailState.showDetailModal || !detailState.selectedFile || !detailState.selectedCandidate) {
    return {
      ...detailState,
      targetPath: '',
      isLoadingTargetPath: false,
    };
  }

  const currentSeq = detailState.targetPathSeq + 1;
  const loadingState = {
    ...detailState,
    targetPathSeq: currentSeq,
    isLoadingTargetPath: true,
  };

  try {
    const nextTargetPath = await refreshInboxTargetPath({
      showDetailModal: loadingState.showDetailModal,
      file: loadingState.selectedFile,
      candidate: loadingState.selectedCandidate,
      season: loadingState.editSeason,
      episode: loadingState.editEpisode,
    });

    return {
      ...loadingState,
      targetPath: nextTargetPath,
      isLoadingTargetPath: false,
    };
  } catch (error) {
    console.error('Refresh target path error:', error);
    return {
      ...loadingState,
      targetPath: '',
      isLoadingTargetPath: false,
    };
  }
}

export async function openInboxDetailFlow(
  file: MediaFile,
  currentState: InboxDetailUiState,
): Promise<InboxDetailUiState> {
  const openedState = {
    ...createOpenedInboxDetailUiState(file, currentState.targetPathSeq),
    isSearchingTMDB: true,
  };

  try {
    const matchState = await loadInboxDetailMatch(file);
    return await refreshInboxDetailTargetPath({
      ...openedState,
      matchCandidates: matchState.candidates,
      selectedCandidate: matchState.selectedCandidate,
      isAutoMatched: matchState.isAutoMatched,
      matchScore: matchState.matchScore,
      isSearchingTMDB: false,
    });
  } catch (error) {
    console.error(error);
    return {
      ...openedState,
      isSearchingTMDB: false,
    };
  }
}

export async function searchInboxDetailCandidates(
  detailState: InboxDetailUiState,
): Promise<InboxDetailUiState> {
  if (!detailState.manualSearchQuery.trim() || !detailState.selectedFile) {
    return detailState;
  }

  try {
    const searchedState = {
      ...detailState,
      isSearchingTMDB: true,
      matchCandidates: await searchInboxCandidates(detailState.manualSearchQuery),
      selectedCandidate: null,
    };
    return await refreshInboxDetailTargetPath({
      ...searchedState,
      isSearchingTMDB: false,
    });
  } catch (error) {
    console.error(error);
    return {
      ...detailState,
      isSearchingTMDB: false,
    };
  }
}

export async function runInboxAiRecognizeFlow(
  detailState: InboxDetailUiState,
): Promise<{ detailState: InboxDetailUiState; operationMessage: string }> {
  const selectedFile = detailState.selectedFile;

  if (!selectedFile) {
    return { detailState, operationMessage: '' };
  }

  const recognizingState = {
    ...detailState,
    isAIRecognizing: true,
    aiRecognizeResult: null,
  };

  try {
    const resolved = await resolveInboxAiRecognize(selectedFile);
    const appliedState = applyAiRecognizeState({
      resolved,
      currentSeason: recognizingState.editSeason,
      currentEpisode: recognizingState.editEpisode,
    });

    const nextState = {
      ...recognizingState,
      isAIRecognizing: false,
      aiRecognizeResult: appliedState.aiRecognizeResult,
      matchCandidates: appliedState.matchCandidates,
      selectedCandidate: appliedState.selectedCandidate,
      editSeason: appliedState.editSeason,
      editEpisode: appliedState.editEpisode,
    };

    if (!resolved.aiRecognizeResult) {
      return { detailState: nextState, operationMessage: appliedState.operationMessage };
    }

    return {
      detailState: await refreshInboxDetailTargetPath(nextState),
      operationMessage: appliedState.operationMessage,
    };
  } catch (error) {
    console.error('AI recognize error:', error);
    return {
      detailState: {
        ...recognizingState,
        isAIRecognizing: false,
      },
      operationMessage: `❌ AI 识别错误: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}

export async function selectInboxDetailCandidate(
  detailState: InboxDetailUiState,
  candidate: SearchResult,
): Promise<InboxDetailUiState> {
  return refreshInboxDetailTargetPath({
    ...detailState,
    selectedCandidate: candidate,
  });
}
