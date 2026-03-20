import { describe, expect, test } from 'bun:test';
import { buildShowPrimaryActionLabel, countShowsByStatus, filterShows, toggleSeasonSet } from './tvPage';

const shows = [
  { name: 'Andor', groupStatus: 'scraped' },
  { name: 'Severance', groupStatus: 'unscraped' },
] as any[];

describe('tvPage helpers', () => {
  test('filters shows by status and query', () => {
    expect(filterShows(shows, 'scraped', '')).toEqual([shows[0]]);
    expect(filterShows(shows, 'all', 'sev')).toEqual([shows[1]]);
  });

  test('counts show group statuses', () => {
    expect(countShowsByStatus(shows)).toEqual({ scraped: 1, unscraped: 1 });
  });

  test('toggles season expansion set immutably', () => {
    const initial = new Set([1]);
    expect(Array.from(toggleSeasonSet(initial, 2))).toEqual([1, 2]);
    expect(Array.from(toggleSeasonSet(initial, 1))).toEqual([]);
  });

  test('builds primary action label from state', () => {
    expect(buildShowPrimaryActionLabel(undefined, false)).toBe('自动匹配');
    expect(buildShowPrimaryActionLabel(100, false)).toBe('刷新元数据');
    expect(buildShowPrimaryActionLabel(100, true)).toBe('处理中...');
  });
});
