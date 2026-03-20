import { describe, expect, test } from 'bun:test';
import { buildMovieMetaItems, countMoviesByProcessed, filterMovies } from './moviePage';

const movies = [
  { name: 'Arrival', isProcessed: true },
  { name: 'Dune', isProcessed: false },
] as any[];

describe('moviePage helpers', () => {
  test('filters movies by tab and query', () => {
    expect(filterMovies(movies, 'scraped', '')).toEqual([movies[0]]);
    expect(filterMovies(movies, 'all', 'dune')).toEqual([movies[1]]);
  });

  test('counts processed movie states', () => {
    expect(countMoviesByProcessed(movies)).toEqual({ scraped: 1, unscraped: 1 });
  });

  test('builds movie meta items from available fields', () => {
    expect(
      buildMovieMetaItems({
        voteAverage: 8.2,
        year: 2021,
        runtime: 155,
        file: {
          parsed: {
            resolution: '4K',
            codec: 'HEVC',
            source: 'BluRay',
          },
        },
      } as any),
    ).toEqual(['评分 8.2', '2021', '155 分钟', '4K', 'HEVC', 'BluRay']);
  });
});
