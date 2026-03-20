import type { ShowInfo } from './api';

export function filterShows(shows: ShowInfo[], activeTab: string, searchQuery: string): ShowInfo[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return shows.filter((show) => {
    if (activeTab === 'scraped' && show.groupStatus !== 'scraped') return false;
    if (activeTab === 'unscraped' && show.groupStatus !== 'unscraped') return false;
    if (normalizedQuery && !show.name.toLowerCase().includes(normalizedQuery)) return false;
    return true;
  });
}

export function countShowsByStatus(shows: ShowInfo[]) {
  return shows.reduce(
    (counts, show) => {
      if (show.groupStatus === 'scraped') counts.scraped += 1;
      if (show.groupStatus === 'unscraped') counts.unscraped += 1;
      return counts;
    },
    { scraped: 0, unscraped: 0 },
  );
}

export function toggleSeasonSet(openSeasons: Set<number>, season: number): Set<number> {
  const next = new Set(openSeasons);
  if (next.has(season)) next.delete(season);
  else next.add(season);
  return next;
}

export function buildShowPrimaryActionLabel(tmdbId: number | null | undefined, isOperating: boolean): string {
  if (isOperating) return '处理中...';
  return tmdbId ? '刷新元数据' : '自动匹配';
}
