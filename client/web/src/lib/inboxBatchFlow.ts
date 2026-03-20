import type { MediaFile } from '$lib/api';
import { runInboxBatchProcess, type InboxBatchProcessorResult } from '$lib/inboxBatch';
import { createPostBatchState, getInboxBatchSelection } from '$lib/inboxPageWorkflow';

interface InboxBatchContext {
  current: number;
  total: number;
}

export interface ExecuteInboxBatchFlowParams {
  allFiles: MediaFile[];
  selectedFiles: Set<string>;
  processor: (
    file: MediaFile,
    context: InboxBatchContext,
    setOperationMessage: (message: string) => void,
  ) => Promise<InboxBatchProcessorResult>;
  setOperating: (value: boolean) => void;
  setOperationMessage: (message: string) => void;
  setBatchProgress: (progress: InboxBatchContext) => void;
  setFileStatus: (path: string, status: 'processing' | 'success' | 'failed') => void;
  markFileProcessed: (path: string) => void;
  reloadData: () => Promise<void>;
  updateSelectedFiles: (selectedFiles: Set<string>) => void;
  onError?: (file: MediaFile, error: unknown) => void;
  resetDelayMs?: number;
  scheduleReset?: (callback: () => void, delayMs: number) => void;
}

export async function executeInboxBatchFlow({
  allFiles,
  selectedFiles,
  processor,
  setOperating,
  setOperationMessage,
  setBatchProgress,
  setFileStatus,
  markFileProcessed,
  reloadData,
  updateSelectedFiles,
  onError,
  resetDelayMs = 3000,
  scheduleReset = (callback, delayMs) => {
    setTimeout(callback, delayMs);
  },
}: ExecuteInboxBatchFlowParams): Promise<void> {
  setOperating(true);

  const selectedFilesList = getInboxBatchSelection(allFiles, selectedFiles);
  setBatchProgress({ current: 0, total: selectedFilesList.length });

  const summary = await runInboxBatchProcess(selectedFilesList, (file, context) => {
    return processor(file, context, setOperationMessage);
  }, {
    onStart: (file) => {
      setFileStatus(file.path, 'processing');
    },
    onSettled: (file, outcome, context) => {
      if (outcome.success) {
        markFileProcessed(file.path);
        setFileStatus(file.path, 'success');
      } else {
        setFileStatus(file.path, 'failed');
      }
      setBatchProgress({ current: context.current, total: context.total });
    },
    onError: (file, error) => {
      onError?.(file, error);
    },
  });

  const postBatchState = createPostBatchState({ summary, selectedFiles });
  setOperationMessage(postBatchState.operationMessage);

  if (postBatchState.hadSuccess) {
    await reloadData();
  }

  scheduleReset(() => {
    setOperating(false);
    setOperationMessage('');
    if (postBatchState.hadSuccess) {
      updateSelectedFiles(postBatchState.selectedFiles);
    }
  }, resetDelayMs);
}
