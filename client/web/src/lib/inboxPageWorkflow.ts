import type {
  DirectoryGroup,
  MediaFile,
  PreviewPlan,
  SearchResult,
} from '$lib/api';
import { fetchInboxByDirectory } from '$lib/api';
import {
  applyAiRecognizeState,
  buildInboxBatchSummaryMessage,
  createInboxPreviewState,
} from '@media-scraper/shared/inbox-workflow';
import { resolveInboxTargetPath } from '$lib/inboxPreview';
import { getSelectedInboxFiles, markInboxFileProcessed } from '$lib/inboxPage';

export interface InboxPageState {
  directories: DirectoryGroup[];
  files: MediaFile[];
  allFiles: MediaFile[];
  currentDir: string;
  selectedFiles: Set<string>;
  selectedFile: MediaFile | null;
  detailFile: MediaFile | null;
  showDetailModal: boolean;
  matchCandidates: SearchResult[];
  selectedCandidate: SearchResult | null;
  fileStatus: Map<string, 'processing' | 'success' | 'failed'>;
}

export function createEmptyInboxPageState(currentDir = ''): InboxPageState {
  return {
    directories: [],
    files: [],
    allFiles: [],
    currentDir,
    selectedFiles: new Set(),
    selectedFile: null,
    detailFile: null,
    showDetailModal: false,
    matchCandidates: [],
    selectedCandidate: null,
    fileStatus: new Map(),
  };
}

export async function loadInboxPageData(currentDir: string): Promise<InboxPageState> {
  const directories = await fetchInboxByDirectory();
  const allFiles = directories.flatMap(dir => dir.files);
  const currentDirData = directories.find(dir => dir.path === currentDir);
  const fallbackDir = currentDirData || directories[0] || null;

  return {
    directories,
    allFiles,
    currentDir: fallbackDir?.path || '',
    files: fallbackDir?.files || [],
    selectedFiles: new Set(),
    selectedFile: null,
    detailFile: null,
    showDetailModal: false,
    matchCandidates: [],
    selectedCandidate: null,
    fileStatus: new Map(),
  };
}

export function applyProcessedFile(state: Pick<InboxPageState, 'files' | 'allFiles' | 'selectedFile' | 'detailFile'>, path: string) {
  return markInboxFileProcessed(state, path);
}

export function getInboxBatchSelection(allFiles: MediaFile[], selectedFiles: Set<string>): MediaFile[] {
  return getSelectedInboxFiles(allFiles, selectedFiles);
}

export function createPostBatchState(params: {
  summary: { successCount: number; tvCount: number; movieCount: number; failCount: number };
  selectedFiles: Set<string>;
}): {
  hadSuccess: boolean;
  operationMessage: string;
  selectedFiles: Set<string>;
} {
  const hadSuccess = params.summary.successCount > 0;
  return {
    hadSuccess,
    operationMessage: buildInboxBatchSummaryMessage(params.summary),
    selectedFiles: hadSuccess ? new Set<string>() : params.selectedFiles,
  };
}

export async function refreshInboxTargetPath(params: {
  showDetailModal: boolean;
  file: MediaFile | null;
  candidate: SearchResult | null;
  season: number;
  episode: number;
}): Promise<string> {
  if (!params.showDetailModal || !params.file || !params.candidate) {
    return '';
  }

  return resolveInboxTargetPath(params);
}

export { applyAiRecognizeState, createInboxPreviewState };
