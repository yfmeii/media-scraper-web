import { describe, expect, test } from 'bun:test';
import {
  formatDate,
  formatEpisode,
  formatFileSize,
  formatMissingSxEx,
  formatRating,
  formatRuntime,
  formatSeason,
  formatSeasonEpisode,
  getMediaKindLabel,
  getSeasonMissingEpisodes,
  getShowMissingEpisodes,
  normalizeMediaKind,
} from './index';
import { makeEpisode, makeShow } from './test-helpers';

describe('formatFileSize', () => {
  test('undefined 返回 "?"', () => {
    expect(formatFileSize(undefined)).toBe('?');
  });

  test('0 返回 "0 B"', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  test('小于 1KB 显示 B（无小数）', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1)).toBe('1 B');
    expect(formatFileSize(999)).toBe('999 B');
  });

  test('KB 级别显示一位小数', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(10240)).toBe('10.0 KB');
  });

  test('MB/GB/TB 级别显示一位小数', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatFileSize(1024 * 1024 * 1.5)).toBe('1.5 MB');
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
    expect(formatFileSize(1024 * 1024 * 1024 * 4.7)).toBe('4.7 GB');
    expect(formatFileSize(1024 * 1024 * 1024 * 1024)).toBe('1.0 TB');
  });
});

describe('formatDate', () => {
  test('格式化常见日期输入', () => {
    expect(formatDate(undefined)).toBe('--');
    expect(formatDate('')).toBe('--');
    expect(formatDate('2024-06-15T12:00:00Z')).toBe('2024-06-15');
    expect(formatDate('2020-01-01')).toBe('2020-01-01');
    expect(formatDate(new Date(2025, 0, 1))).toBe('2025-01-01');
  });

  test('无效日期返回 --', () => {
    expect(formatDate('not-a-date')).toBe('--');
  });
});

describe('季集与元信息格式化', () => {
  test('格式化季集编号', () => {
    expect(formatSeason(1)).toBe('Season 01');
    expect(formatSeason(10)).toBe('Season 10');
    expect(formatEpisode(1)).toBe('E01');
    expect(formatEpisode(100)).toBe('E100');
    expect(formatSeasonEpisode(2, 15)).toBe('S02E15');
  });

  test('格式化评分与时长', () => {
    expect(formatRating(undefined)).toBe('--');
    expect(formatRating(0)).toBe('--');
    expect(formatRating(8.5)).toBe('8.5');
    expect(formatRuntime(undefined)).toBe('--');
    expect(formatRuntime(45)).toBe('45m');
    expect(formatRuntime(125)).toBe('2h 5m');
  });
});

describe('媒体标签与缺集检测', () => {
  test('媒体类型标签与归一化', () => {
    expect(getMediaKindLabel('tv')).toBe('剧集');
    expect(getMediaKindLabel('movie')).toBe('电影');
    expect(getMediaKindLabel('unknown')).toBe('未知');
    expect(normalizeMediaKind('tv')).toBe('tv');
    expect(normalizeMediaKind('unknown')).toBe('movie');
  });

  test('检测并格式化缺集', () => {
    const seasonEpisodes = [makeEpisode(1), makeEpisode(3), makeEpisode(4)];
    expect(getSeasonMissingEpisodes(seasonEpisodes)).toEqual([2]);

    const show = makeShow([
      { season: 1, episodes: [1, 3, 4] },
      { season: 2, episodes: [1, 2, 4] },
    ]);
    const missing = getShowMissingEpisodes(show);
    expect(missing).toEqual([
      { season: 1, missing: [2] },
      { season: 2, missing: [3] },
    ]);
    expect(formatMissingSxEx(missing)).toBe('S01E02, S02E03');
  });
});
