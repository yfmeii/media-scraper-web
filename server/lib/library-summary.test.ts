import { describe, expect, test } from 'bun:test';
import { mergeMovieDetail } from './library-movie-summary';
import { enrichShowStatus, mergeShowDetail } from './library-show-summary';
import { summarizeShowEpisodes } from './library-summary-shared';

describe('library summary helpers', () => {
  test('summarizeShowEpisodes groups and sorts by season and episode', () => {
    const summary = summarizeShowEpisodes([
      { parsed: { season: 2, episode: 3 } },
      { parsed: { season: 1, episode: 2 } },
      { parsed: { season: 1, episode: 1 } },
    ] as any);

    expect(summary.seasonCount).toBe(2);
    expect(summary.episodeCount).toBe(3);
    expect(summary.seasons[0]?.episodes.map((item: any) => item.parsed.episode)).toEqual([1, 2]);
  });

  test('mergeShowDetail keeps summary seasons when detail omits them', () => {
    const merged = mergeShowDetail({
      path: '/tv/Show',
      name: 'Show',
      seasons: [{ season: 1, episodes: [] }],
      seasonCount: 1,
      episodeCount: 0,
      hasNfo: true,
      isProcessed: true,
      detailLoaded: false,
    }, {
      overview: 'Detail',
    });

    expect(merged.detailLoaded).toBe(true);
    expect(merged.seasons).toHaveLength(1);
    expect(merged.overview).toBe('Detail');
  });

  test('mergeMovieDetail preserves summary file when detail omits it', () => {
    const merged = mergeMovieDetail({
      path: '/movies/Movie',
      name: 'Movie',
      file: { path: '/movies/Movie/Movie.mkv' },
      hasNfo: true,
      isProcessed: true,
      detailLoaded: false,
    } as any, {
      overview: 'Updated',
    });

    expect(merged.file?.path).toBe('/movies/Movie/Movie.mkv');
    expect(merged.overview).toBe('Updated');
    expect(merged.detailLoaded).toBe(true);
  });

  test('enrichShowStatus marks supplement when processed show has new files', () => {
    const enriched = enrichShowStatus({
      path: '/tv/Show',
      name: 'Show',
      seasons: [],
      hasNfo: true,
      isProcessed: true,
      detailLoaded: false,
    } as any, 2);

    expect(enriched.groupStatus).toBe('supplement');
    expect(enriched.supplementCount).toBe(2);
  });
});
