import type { DirectoryGroup, MediaFile } from './api';

type InboxState = {
  files: MediaFile[];
  allFiles: MediaFile[];
  selectedFile: MediaFile | null;
  detailFile: MediaFile | null;
};

type ProcessedInboxState = InboxState & {
  updated: boolean;
};

export function buildCurrentDirLabel(currentDir: string): string {
  if (currentDir === '') return '全部';
  return currentDir.split('/').pop() || '全部';
}

export function resolveDirectorySelection(dir: DirectoryGroup | null, allFiles: MediaFile[]) {
  if (dir === null) {
    return {
      currentDir: '',
      files: allFiles,
    };
  }

  return {
    currentDir: dir.path,
    files: dir.files,
  };
}

export function markInboxFileProcessed(state: InboxState, path: string): ProcessedInboxState {
  let updated = false;

  const updateList = (list: MediaFile[]) =>
    list.map((item) => {
      if (item.path !== path || item.isProcessed) return item;
      updated = true;
      return { ...item, isProcessed: true };
    });

  const files = updateList(state.files);
  const allFiles = updateList(state.allFiles);

  const selectedFile =
    state.selectedFile?.path === path && !state.selectedFile.isProcessed
      ? { ...state.selectedFile, isProcessed: true }
      : state.selectedFile;

  const detailFile =
    state.detailFile?.path === path && !state.detailFile.isProcessed
      ? { ...state.detailFile, isProcessed: true }
      : state.detailFile;

  if (selectedFile !== state.selectedFile || detailFile !== state.detailFile) {
    updated = true;
  }

  return {
    files,
    allFiles,
    selectedFile,
    detailFile,
    updated,
  };
}

export function normalizeInboxIndex(value: number): number {
  return Math.max(1, value || 1);
}

export function filterInboxFiles(files: MediaFile[], filterStatus: string, searchQuery: string): MediaFile[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return files.filter((file) => {
    if (filterStatus === 'processed' && !file.isProcessed) return false;
    if (filterStatus === 'unprocessed' && file.isProcessed) return false;
    if (normalizedQuery && !file.relativePath.toLowerCase().includes(normalizedQuery)) return false;
    return true;
  });
}

export function getSelectedInboxFiles(allFiles: MediaFile[], selectedPaths: Set<string>): MediaFile[] {
  return allFiles.filter((file) => selectedPaths.has(file.path));
}
