import type { MediaFile } from '@media-scraper/shared/types';

function sortEpisodes(files: MediaFile[]): MediaFile[] {
  return [...files].sort((a, b) => (a.parsed.episode || 0) - (b.parsed.episode || 0));
}

export function summarizeShowEpisodes(files: MediaFile[]) {
  const seasonsMap = new Map<number, MediaFile[]>();
  for (const file of files) {
    const season = file.parsed.season || 1;
    const bucket = seasonsMap.get(season) || [];
    bucket.push(file);
    seasonsMap.set(season, bucket);
  }

  const seasons = Array.from(seasonsMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([season, episodes]) => ({ season, episodes: sortEpisodes(episodes) }));

  return {
    seasons,
    seasonCount: seasons.length,
    episodeCount: seasons.reduce((sum, season) => sum + season.episodes.length, 0),
  };
}
