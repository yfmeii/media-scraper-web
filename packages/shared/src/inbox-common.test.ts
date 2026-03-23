import { describe, expect, test } from 'bun:test';
import {
  getInboxRecognizeInput,
  getInboxSearchKeyword,
  inferCandidateMediaType,
  inferMediaTypeFromParsed,
  mergeSearchResults,
  moveSearchResultToFront,
} from './index';

describe('共享 inbox common 辅助函数', () => {
  test('搜索关键字优先使用解析标题，否则去掉扩展名', () => {
    expect(getInboxSearchKeyword({
      name: 'Movie.Name.2024.mkv',
      parsed: { title: 'Resolved Title' } as any,
    })).toBe('Resolved Title');

    expect(getInboxSearchKeyword({
      name: 'Movie.Name.2024.mkv',
      parsed: { title: '' } as any,
    })).toBe('Movie.Name.2024');
  });

  test('识别输入优先使用相对路径', () => {
    expect(getInboxRecognizeInput({
      path: '/media/inbox/Show/episode.mkv',
      relativePath: 'Show/episode.mkv',
    })).toBe('Show/episode.mkv');

    expect(getInboxRecognizeInput({
      path: '/media/inbox/Show/episode.mkv',
      relativePath: '',
    })).toBe('/media/inbox/Show/episode.mkv');
  });

  test('媒体类型推断处理空值与冲突日期回退', () => {
    expect(inferMediaTypeFromParsed(undefined)).toBe('movie');
    expect(inferMediaTypeFromParsed({ title: 'Show', episode: 2 } as any)).toBe('tv');

    expect(inferCandidateMediaType({ mediaType: 'tv' })).toBe('tv');
    expect(inferCandidateMediaType({ firstAirDate: '2024-01-01', releaseDate: '2024-02-01' }, 'movie')).toBe('movie');
    expect(inferCandidateMediaType(null, 'tv')).toBe('tv');
  });

  test('合并搜索结果时按出现顺序去重并忽略空项', () => {
    const merged = mergeSearchResults(
      [
        { id: 1, name: 'First' } as any,
        null as any,
        { id: 2, name: 'Second' } as any,
      ],
      [
        { id: 2, name: 'Second duplicate' } as any,
        { id: 3, name: 'Third' } as any,
      ],
    );

    expect(merged.map(item => item.id)).toEqual([1, 2, 3]);
    expect(merged[1]?.name).toBe('Second');
  });

  test('偏好候选前置在必要时返回新数组，否则保留原数组', () => {
    const candidates = [
      { id: 1, name: 'First' },
      { id: 2, name: 'Second' },
      { id: 3, name: 'Third' },
    ] as any[];

    const reordered = moveSearchResultToFront(candidates, 3);
    expect(reordered.map(item => item.id)).toEqual([3, 1, 2]);
    expect(reordered).not.toBe(candidates);

    expect(moveSearchResultToFront(candidates, 1)).toBe(candidates);
    expect(moveSearchResultToFront(candidates, 999)).toBe(candidates);
    expect(moveSearchResultToFront(candidates, null)).toBe(candidates);
  });
});
