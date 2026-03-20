import { describe, expect, mock, test } from 'bun:test';

mock.module('../lib/tmdb', () => ({
  findByImdbId: async () => null,
  findByTmdbId: async () => null,
  searchMulti: async () => [],
  getPosterUrl: (path?: string | null) => path ? `https://image.tmdb.org/t/p/w185${path}` : null,
}));

const {
  buildImdbSearchResponse,
  buildMatchNotFoundResponse,
  buildPreviewResponse,
  buildRecognizeResponse,
  buildSearchResponse,
} = await import('./scrape-response');

describe('scrape response builders', () => {
  test('builds search and imdb responses', () => {
    expect(buildSearchResponse('movie', [{ id: 1, title: 'Arrival', release_date: '2016-01-01', poster_path: '/a.jpg' }])).toMatchObject({
      success: true,
      data: [{ id: 1, mediaType: 'movie', title: 'Arrival' }],
    });

    expect(buildImdbSearchResponse(null)).toEqual({ success: true, data: [] });
  });

  test('builds unmatched match and preview responses', () => {
    expect(buildMatchNotFoundResponse('Andor', 2022)).toEqual({
      success: true,
      data: { matched: false, title: 'Andor', year: 2022, candidates: [] },
    });

    expect(buildPreviewResponse({ actions: [] })).toEqual({ success: true, data: { actions: [] } });
  });

  test('builds recognize response with fallback candidate when needed', () => {
    const response = buildRecognizeResponse({
      result: {
        path: 'Andor.S01E01.mkv',
        title: 'Andor',
        media_type: 'tv',
        year: 2022,
        season: 1,
        episode: 1,
        imdb_id: null,
        tmdb_id: 55,
        tmdb_name: null,
        confidence: 0.8,
        reason: 'match',
      },
      candidates: [],
      preferredTmdbId: 55,
    });

    expect(response.data.preferred_tmdb_id).toBe(55);
    expect(response.data.candidates[0]?.id).toBe(55);
  });
});
