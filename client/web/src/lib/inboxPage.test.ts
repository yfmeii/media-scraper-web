import { describe, expect, test } from 'bun:test';
import {
  buildCurrentDirLabel,
  filterInboxFiles,
  getSelectedInboxFiles,
  markInboxFileProcessed,
  normalizeInboxIndex,
  resolveDirectorySelection,
} from './inboxPage';

const files = [
  { path: '/a', relativePath: 'A/one.mkv', isProcessed: false },
  { path: '/b', relativePath: 'B/two.mkv', isProcessed: true },
] as any[];

describe('inboxPage helpers', () => {
  test('builds current directory label', () => {
    expect(buildCurrentDirLabel('')).toBe('全部');
    expect(buildCurrentDirLabel('/media/Inbox/Season 1')).toBe('Season 1');
  });

  test('resolves all-files directory selection', () => {
    expect(resolveDirectorySelection(null, files)).toEqual({
      currentDir: '',
      files,
    });
  });

  test('marks matching file as processed across visible state', () => {
    const result = markInboxFileProcessed(
      {
        files,
        allFiles: files,
        selectedFile: files[0],
        detailFile: files[0],
      },
      '/a',
    );

    expect(result.updated).toBe(true);
    expect(result.files[0].isProcessed).toBe(true);
    expect(result.allFiles[0].isProcessed).toBe(true);
    expect(result.selectedFile?.isProcessed).toBe(true);
    expect(result.detailFile?.isProcessed).toBe(true);
  });

  test('normalizes season and episode numbers', () => {
    expect(normalizeInboxIndex(0)).toBe(1);
    expect(normalizeInboxIndex(7)).toBe(7);
  });

  test('filters inbox files by status and query', () => {
    expect(filterInboxFiles(files, 'processed', '')).toEqual([files[1]]);
    expect(filterInboxFiles(files, 'all', 'one')).toEqual([files[0]]);
  });

  test('collects selected inbox files from source list', () => {
    expect(getSelectedInboxFiles(files, new Set(['/b']))).toEqual([files[1]]);
  });
});
