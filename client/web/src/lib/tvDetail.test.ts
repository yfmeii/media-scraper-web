import { describe, expect, test } from 'bun:test';
import { buildShowMetaItems, countTotalEpisodes, sortEpisodes, sortSeasons } from './tvDetail';

describe('tvDetail helpers', () => {
  test('counts and sorts season episode collections', () => {
    const seasons = [
      { season: 2, episodes: [{ parsed: { episode: 3 } }, { parsed: { episode: 1 } }] },
      { season: 1, episodes: [{ parsed: { episode: 2 } }] },
    ] as any[];

    expect(countTotalEpisodes(seasons)).toBe(3);
    expect(sortSeasons(seasons).map(item => item.season)).toEqual([1, 2]);
    expect(sortEpisodes(seasons[0].episodes).map(item => item.parsed.episode)).toEqual([1, 3]);
  });

  test('builds compact show meta items', () => {
    const items = buildShowMetaItems({
      voteAverage: 8.6,
      year: 2024,
      status: 'Returning Series',
      seasons: [{ season: 1, episodes: [{}, {}] }, { season: 2, episodes: [{}] }],
    } as any);

    expect(items).toEqual(['评分 8.6', '2024', 'Returning Series', '2 季', '3 集']);
  });
});
