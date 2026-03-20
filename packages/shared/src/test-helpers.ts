import type { MediaFile, ShowInfo } from './index';

export function makeEpisode(episode: number, season = 1): MediaFile {
  return {
    path: `/tv/show/Season ${season}/S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}.mkv`,
    name: `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}.mkv`,
    relativePath: `Season ${season}/S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}.mkv`,
    size: 1024 * 1024 * 500,
    kind: 'tv',
    parsed: { title: 'Show', season, episode },
    hasNfo: false,
    isProcessed: false,
  };
}

export function makeShow(seasons: { season: number; episodes: number[] }[]): ShowInfo {
  return {
    path: '/tv/show',
    name: 'Test Show',
    seasons: seasons.map(s => ({
      season: s.season,
      episodes: s.episodes.map(ep => makeEpisode(ep, s.season)),
    })),
    hasNfo: true,
    isProcessed: true,
  };
}
