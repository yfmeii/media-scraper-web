import { describe, expect, test } from 'bun:test';
import { buildMatchPayload, mapSearchResult } from './scrape-helpers';

describe('scrape route helpers', () => {
  test('mapSearchResult maps tv results to shared shape', () => {
    const mapped = mapSearchResult('tv', {
      id: 101,
      media_type: 'tv',
      name: 'Test Show',
      original_name: 'Original Show',
      overview: 'A long overview for testing',
      first_air_date: '2024-01-02',
      vote_average: 8.7,
      poster_path: '/poster.jpg',
    });

    expect(mapped).toMatchObject({
      id: 101,
      mediaType: 'tv',
      name: 'Test Show',
      originalName: 'Original Show',
      firstAirDate: '2024-01-02',
      voteAverage: 8.7,
    });
    expect(mapped.posterPath).toContain('/poster.jpg');
  });

  test('buildMatchPayload marks close scores as ambiguous', () => {
    const payload = buildMatchPayload({
      score: 0.62,
      result: {
        id: 1,
        name: 'Match A',
        original_name: 'Original A',
        first_air_date: '2024-01-01',
        poster_path: '/a.jpg',
      },
      candidates: [
        {
          id: 1,
          name: 'Match A',
          original_name: 'Original A',
          first_air_date: '2024-01-01',
          poster_path: '/a.jpg',
          score: 0.62,
        },
        {
          id: 2,
          name: 'Match B',
          original_name: 'Original B',
          first_air_date: '2023-01-01',
          poster_path: '/b.jpg',
          score: 0.56,
        },
      ],
    }, 'tv');

    expect(payload.matched).toBe(false);
    expect(payload.ambiguous).toBe(true);
    expect(payload.result.mediaType).toBe('tv');
    expect(payload.candidates).toHaveLength(2);
  });

  test('buildMatchPayload keeps confident movie match as resolved', () => {
    const payload = buildMatchPayload({
      score: 0.91,
      result: {
        id: 9,
        title: 'Movie Hit',
        original_title: 'Movie Hit Original',
        release_date: '2022-05-01',
        poster_path: '/movie.jpg',
        media_type: 'movie',
      },
      candidates: [{
        id: 9,
        title: 'Movie Hit',
        original_title: 'Movie Hit Original',
        release_date: '2022-05-01',
        poster_path: '/movie.jpg',
        media_type: 'movie',
        score: 0.91,
      }],
    }, 'movie');

    expect(payload.matched).toBe(true);
    expect(payload.ambiguous).toBe(false);
    expect(payload.result.name).toBe('Movie Hit');
    expect(payload.candidates[0]?.mediaType).toBe('movie');
  });
});
