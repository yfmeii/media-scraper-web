import type { MediaFile, SeasonInfo, ShowInfo } from '@media-scraper/shared/types';

export function countTotalEpisodes(seasons: SeasonInfo[]): number {
  return seasons.reduce((sum, season) => sum + season.episodes.length, 0);
}

export function resolveShowSeasonCount(show: ShowInfo): number {
  return show.seasonCount ?? show.seasons.length;
}

export function resolveShowEpisodeCount(show: ShowInfo): number {
  return show.episodeCount ?? countTotalEpisodes(show.seasons);
}

export function sortSeasons(seasons: SeasonInfo[]): SeasonInfo[] {
  return [...seasons].sort((a, b) => a.season - b.season);
}

export function sortEpisodes(episodes: MediaFile[]): MediaFile[] {
  return [...episodes].sort((a, b) => (a.parsed.episode || 0) - (b.parsed.episode || 0));
}

export function buildShowMetaItems(show: ShowInfo | null): string[] {
  if (!show) return [];

  const items: string[] = [];
  if (typeof show.voteAverage === 'number') {
    items.push(`评分 ${show.voteAverage.toFixed(1)}`);
  }
  if (show.year) items.push(String(show.year));
  if (show.status) items.push(show.status);
  items.push(`${resolveShowSeasonCount(show)} 季`);

  const episodeCount = resolveShowEpisodeCount(show);
  if (episodeCount) items.push(`${episodeCount} 集`);

  return items;
}
