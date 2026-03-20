export function buildStatusGroups<T extends { groupStatus?: string }>(items: T[]) {
  return {
    scraped: items.filter(item => item.groupStatus === 'scraped').length,
    unscraped: items.filter(item => item.groupStatus === 'unscraped').length,
    supplement: items.filter(item => item.groupStatus === 'supplement').length,
  };
}

export function buildCollectionResponse<T>(data: T[], groups?: { scraped: number; unscraped: number; supplement: number }) {
  return {
    success: true,
    data,
    total: data.length,
    groups,
  };
}

export function buildDetailResponse<T>(data: T) {
  return {
    success: true,
    data,
  };
}

export function buildInboxDirectoryResponse<T extends { files: unknown[] }>(directories: T[]) {
  return {
    success: true,
    data: directories,
    total: directories.reduce((sum, dir) => sum + dir.files.length, 0),
    directories: directories.length,
  };
}

export function buildStatsResponse(
  shows: Array<{ isProcessed?: boolean; seasons?: Array<{ episodes: unknown[] }>; episodeCount?: number }>,
  movies: Array<{ isProcessed?: boolean }>,
  inbox: unknown[],
) {
  const tvEpisodes = shows.reduce(
    (sum, show) => sum + (show.episodeCount ?? show.seasons?.reduce((seasonSum, season) => seasonSum + season.episodes.length, 0) ?? 0),
    0,
  );

  return {
    success: true,
    data: {
      tvShows: shows.length,
      tvEpisodes,
      tvProcessed: shows.filter(show => show.isProcessed).length,
      movies: movies.length,
      moviesProcessed: movies.filter(movie => movie.isProcessed).length,
      inbox: inbox.length,
    },
  };
}
