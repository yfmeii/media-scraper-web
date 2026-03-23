import { describe, expect, test } from 'bun:test';
import {
  buildInboxBatchSummaryMessage,
  buildPreviewItemFromSelection,
  createEmptyPreviewPlan,
  createInboxPreviewState,
  extractPreviewTargetPath,
} from './index';

describe('共享 inbox preview 辅助函数', () => {
  test('空预览计划返回空展示状态', () => {
    expect(createInboxPreviewState(null)).toEqual({
      previewActions: [],
      previewSummary: null,
    });
  });

  test('提取目标路径按当前文件移动记录、首个移动、目录创建回退', () => {
    const impactSummary = createEmptyPreviewPlan().impactSummary;

    expect(extractPreviewTargetPath({
      actions: [
        { type: 'move', source: '/inbox/other.mkv', destination: '/tv/Other/other.mkv', willOverwrite: false },
        { type: 'move', source: '/inbox/target.mkv', destination: '/tv/Target/target.mkv', willOverwrite: false },
      ],
      impactSummary,
    }, '/inbox/target.mkv')).toBe('/tv/Target/target.mkv');

    expect(extractPreviewTargetPath({
      actions: [
        { type: 'move', source: '/inbox/other.mkv', destination: '/tv/Other/other.mkv', willOverwrite: false },
      ],
      impactSummary,
    }, '/inbox/missing.mkv')).toBe('/tv/Other/other.mkv');

    expect(extractPreviewTargetPath({
      actions: [
        { type: 'create-dir', destination: '/movies/Movie (2024)', willOverwrite: false },
      ],
      impactSummary,
    }, '/inbox/movie.mkv')).toBe('/movies/Movie (2024)');
  });

  test('构建剧集预览项携带 episodeEnd，电影候选可用 fallbackKind 覆盖歧义', () => {
    const tvPreview = buildPreviewItemFromSelection({
      file: {
        path: '/inbox/Show.S01E02-E03.mkv',
        name: 'Show.S01E02-E03.mkv',
        parsed: { title: 'Show', season: 1, episode: 2, episodeEnd: 3 },
      } as any,
      candidate: { id: 7, name: 'Show', mediaType: 'tv' } as any,
      season: 1,
      episode: 2,
    });

    expect(tvPreview).toEqual({
      sourcePath: '/inbox/Show.S01E02-E03.mkv',
      kind: 'tv',
      tmdbId: 7,
      showName: 'Show',
      season: 1,
      episodes: [{ source: '/inbox/Show.S01E02-E03.mkv', episode: 2, episodeEnd: 3 }],
    });

    const moviePreview = buildPreviewItemFromSelection({
      file: {
        path: '/inbox/Unknown.mkv',
        name: 'Unknown.mkv',
        parsed: { title: 'Unknown', season: 1 },
      } as any,
      candidate: { id: 8, title: 'Unknown' } as any,
      fallbackKind: 'movie',
    });

    expect(moviePreview.kind).toBe('movie');
    expect(moviePreview.episodes).toBeUndefined();
  });

  test('批量摘要消息按成功与失败数量格式化', () => {
    expect(buildInboxBatchSummaryMessage({
      successCount: 4,
      tvCount: 3,
      movieCount: 1,
      failCount: 2,
    })).toBe('完成: 4 成功 (3 剧集, 1 电影), 2 失败');
  });
});
