export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type TVEpisodeInput = { source: string; episode: number; episodeEnd?: number };
export type PreviewTVItem = {
  kind: 'tv';
  sourcePath: string;
  showName: string;
  tmdbId: number;
  season: number;
  episodes: TVEpisodeInput[];
};
export type PreviewMovieItem = {
  kind: 'movie';
  sourcePath: string;
  tmdbId: number;
};

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function toPositiveInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return null;
  }

  return value;
}

export function parseTVEpisodes(episodes: unknown): TVEpisodeInput[] | null {
  if (!Array.isArray(episodes) || episodes.length === 0) {
    return null;
  }

  const parsed = episodes.map((episode) => {
    if (!episode || typeof episode !== 'object') return null;

    const source = isNonEmptyString((episode as Record<string, unknown>).source)
      ? (episode as Record<string, unknown>).source as string
      : null;
    const episodeNumber = toPositiveInteger((episode as Record<string, unknown>).episode);
    const episodeEndValue = (episode as Record<string, unknown>).episodeEnd;
    const episodeEnd = episodeEndValue === undefined ? undefined : toPositiveInteger(episodeEndValue);

    if (!source || !episodeNumber) return null;
    if (episodeEndValue !== undefined && !episodeEnd) return null;
    if (episodeEnd !== undefined && episodeEnd < episodeNumber) return null;

    return { source, episode: episodeNumber, episodeEnd };
  });

  return parsed.every(Boolean) ? (parsed as TVEpisodeInput[]) : null;
}

export function parsePreviewItems(items: unknown): Array<PreviewTVItem | PreviewMovieItem> | null {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  const parsed = items.map((item) => {
    if (!item || typeof item !== 'object') return null;

    const input = item as Record<string, unknown>;
    if (!isNonEmptyString(input.sourcePath) || !toPositiveInteger(input.tmdbId)) {
      return null;
    }

    if (input.kind === 'movie') {
      return {
        kind: 'movie' as const,
        sourcePath: input.sourcePath,
        tmdbId: input.tmdbId as number,
      };
    }

    if (input.kind === 'tv') {
      const season = toPositiveInteger(input.season);
      const episodes = parseTVEpisodes(input.episodes);
      if (!isNonEmptyString(input.showName) || !season || !episodes) {
        return null;
      }

      return {
        kind: 'tv' as const,
        sourcePath: input.sourcePath,
        showName: input.showName,
        tmdbId: input.tmdbId as number,
        season,
        episodes,
      };
    }

    return null;
  });

  return parsed.every(Boolean) ? (parsed as Array<PreviewTVItem | PreviewMovieItem>) : null;
}
