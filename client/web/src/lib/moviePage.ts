import type { MovieInfo } from './api';

export function filterMovies(movies: MovieInfo[], activeTab: string, searchQuery: string): MovieInfo[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return movies.filter((movie) => {
    if (activeTab === 'scraped' && !movie.isProcessed) return false;
    if (activeTab === 'unscraped' && movie.isProcessed) return false;
    if (normalizedQuery && !movie.name.toLowerCase().includes(normalizedQuery)) return false;
    return true;
  });
}

export function countMoviesByProcessed(movies: MovieInfo[]) {
  return movies.reduce(
    (counts, movie) => {
      if (movie.isProcessed) counts.scraped += 1;
      else counts.unscraped += 1;
      return counts;
    },
    { scraped: 0, unscraped: 0 },
  );
}

export function buildMovieMetaItems(movie: MovieInfo | null): string[] {
  if (!movie) return [];

  const items: string[] = [];
  if (typeof movie.voteAverage === 'number') {
    items.push(`评分 ${movie.voteAverage.toFixed(1)}`);
  }
  if (movie.year) items.push(String(movie.year));
  if (typeof movie.runtime === 'number' && movie.runtime > 0) {
    items.push(`${movie.runtime} 分钟`);
  }
  if (movie.file?.parsed?.resolution) items.push(movie.file.parsed.resolution);
  if (movie.file?.parsed?.codec) items.push(movie.file.parsed.codec);
  if (movie.file?.parsed?.source) items.push(movie.file.parsed.source);
  return items;
}
