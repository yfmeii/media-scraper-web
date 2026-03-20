import type { MediaFile, MediaKind, SeasonMissingInfo, ShowInfo } from './types';

export function formatFileSize(bytes: number | undefined): string {
  if (bytes == null || bytes === 0) return bytes === 0 ? '0 B' : '?';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

export function formatDate(value: number | string | Date | undefined): string {
  if (!value) return '--';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '--';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatSeason(season: number): string {
  return `Season ${String(season).padStart(2, '0')}`;
}

export function formatEpisode(episode: number): string {
  return `E${String(episode).padStart(2, '0')}`;
}

export function formatSeasonEpisode(season: number, episode: number): string {
  return `S${String(season).padStart(2, '0')}${formatEpisode(episode)}`;
}

export function formatRating(rating: number | undefined): string {
  if (!rating) return '--';
  return rating.toFixed(1);
}

export function formatRuntime(minutes: number | undefined): string {
  if (!minutes) return '--';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function getMediaKindLabel(kind: MediaKind | string): string {
  switch (kind) {
    case 'tv': return '剧集';
    case 'movie': return '电影';
    default: return '未知';
  }
}

export function normalizeMediaKind(kind: string): 'tv' | 'movie' {
  return kind === 'tv' ? 'tv' : 'movie';
}

export function getSeasonMissingEpisodes(episodes: MediaFile[]): number[] {
  const epNums = episodes
    .map(e => e.parsed.episode)
    .filter((n): n is number => n != null && n > 0);
  if (epNums.length < 2) return [];
  const min = Math.min(...epNums);
  const max = Math.max(...epNums);
  const have = new Set(epNums);
  const missing: number[] = [];
  for (let i = min; i <= max; i++) {
    if (!have.has(i)) missing.push(i);
  }
  return missing;
}

export function getShowMissingEpisodes(show: ShowInfo): SeasonMissingInfo[] {
  if (show.detailLoaded === false) return [];
  return show.seasons
    .map(s => ({ season: s.season, missing: getSeasonMissingEpisodes(s.episodes) }))
    .filter(s => s.missing.length > 0);
}

export function formatMissingSxEx(missingList: SeasonMissingInfo[]): string {
  return missingList
    .flatMap(s =>
      s.missing.map(
        ep => `S${String(s.season).padStart(2, '0')}E${String(ep).padStart(2, '0')}`,
      ),
    )
    .join(', ');
}
