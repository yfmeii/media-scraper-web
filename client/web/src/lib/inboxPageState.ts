import type {
  MediaFile,
  PathRecognizeResult,
  PreviewAction,
  PreviewPlan,
  SearchResult,
} from '$lib/api';

export type InboxFileProcessStatus = 'processing' | 'success' | 'failed';

export interface InboxDetailUiState {
  selectedFile: MediaFile | null;
  detailFile: MediaFile | null;
  matchCandidates: SearchResult[];
  selectedCandidate: SearchResult | null;
  isAutoMatched: boolean;
  matchScore: number;
  isSearchingTMDB: boolean;
  manualSearchQuery: string;
  showDetailModal: boolean;
  targetPath: string;
  isLoadingTargetPath: boolean;
  targetPathSeq: number;
  editSeason: number;
  editEpisode: number;
  isAIRecognizing: boolean;
  aiRecognizeResult: PathRecognizeResult | null;
}

export interface InboxOperationUiState {
  isOperating: boolean;
  operationMessage: string;
  batchProgress: { current: number; total: number };
  fileStatus: Map<string, InboxFileProcessStatus>;
}

export interface InboxPreviewUiState {
  showPreviewModal: boolean;
  previewActions: PreviewAction[];
  previewSummary: PreviewPlan['impactSummary'] | null;
  isLoadingPreview: boolean;
}

export function createInboxDetailUiState(targetPathSeq = 0): InboxDetailUiState {
  return {
    selectedFile: null,
    detailFile: null,
    matchCandidates: [],
    selectedCandidate: null,
    isAutoMatched: false,
    matchScore: 0,
    isSearchingTMDB: false,
    manualSearchQuery: '',
    showDetailModal: false,
    targetPath: '',
    isLoadingTargetPath: false,
    targetPathSeq,
    editSeason: 1,
    editEpisode: 1,
    isAIRecognizing: false,
    aiRecognizeResult: null,
  };
}

export function createOpenedInboxDetailUiState(file: MediaFile, currentTargetPathSeq: number): InboxDetailUiState {
  return {
    ...createInboxDetailUiState(currentTargetPathSeq + 1),
    selectedFile: file,
    detailFile: file,
    showDetailModal: true,
    editSeason: file.parsed.season || 1,
    editEpisode: file.parsed.episode || 1,
  };
}

export function createClosingInboxDetailUiState(params: {
  selectedFile: MediaFile | null;
  detailFile: MediaFile | null;
  currentTargetPathSeq: number;
}): InboxDetailUiState {
  return {
    ...createInboxDetailUiState(params.currentTargetPathSeq + 1),
    selectedFile: params.selectedFile,
    detailFile: params.detailFile,
  };
}

export function createInboxOperationUiState(
  fileStatus: Map<string, InboxFileProcessStatus> = new Map(),
): InboxOperationUiState {
  return {
    isOperating: false,
    operationMessage: '',
    batchProgress: { current: 0, total: 0 },
    fileStatus,
  };
}

export function createInboxPreviewUiState(): InboxPreviewUiState {
  return {
    showPreviewModal: false,
    previewActions: [],
    previewSummary: null,
    isLoadingPreview: false,
  };
}

export function setInboxFileProcessStatus(
  fileStatus: Map<string, InboxFileProcessStatus>,
  path: string,
  status: InboxFileProcessStatus,
): Map<string, InboxFileProcessStatus> {
  return new Map(fileStatus).set(path, status);
}
