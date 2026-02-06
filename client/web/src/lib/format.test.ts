import { describe, expect, test } from 'bun:test';
import {
  formatFileSize,
  formatTime,
  formatDate,
  formatSeason,
  formatEpisode,
  formatSeasonEpisode,
  getStatusDisplay,
  getTypeDisplay,
  getScrapedStatus,
  getGroupStatusBadge,
} from './format';

describe('格式化工具', () => {
  test('📦 文件大小格式化', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(undefined)).toBe('?');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
  });

  test('⏰ 时间格式化为 HH:mm', () => {
    const date = new Date(2020, 0, 1, 8, 5, 0);
    const result = formatTime(date);
    expect(result).toBe('08:05');
  });

  test('📅 日期格式化为 YYYY-MM-DD', () => {
    expect(formatDate('2020-06-15T12:00:00')).toBe('2020-06-15');
  });

  test('🎬 季集号格式化', () => {
    expect(formatSeason(1)).toBe('Season 01');
    expect(formatEpisode(3)).toBe('E03');
    expect(formatSeasonEpisode(2, 5)).toBe('S02E05');
  });

  test('🚦 任务状态显示正确', () => {
    expect(getStatusDisplay('success').text).toBe('完成');
    expect(getStatusDisplay('running').text).toBe('进行中');
    expect(getStatusDisplay('unknown').text).toBe('unknown');
  });

  test('🏷️ 任务类型显示正确', () => {
    expect(getTypeDisplay('scrape')).toBe('刮削');
    expect(getTypeDisplay('refresh')).toBe('刷新');
    expect(getTypeDisplay('unknown')).toBe('unknown');
  });

  test('🧪 刮削状态显示正确', () => {
    expect(getScrapedStatus(true).text).toBe('已刮削');
    expect(getScrapedStatus(false).text).toBe('未刮削');
  });

  test('🏷️ 分组状态徽章样式', () => {
    expect(getGroupStatusBadge('scraped').label).toBe('已刮削');
    expect(getGroupStatusBadge('failed').label).toBe('失败');
    expect(getGroupStatusBadge('supplement').label).toBe('待处理');
    expect(getGroupStatusBadge('unknown').label).toBe('未知');
  });
});
