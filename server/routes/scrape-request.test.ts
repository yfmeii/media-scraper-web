import { describe, expect, test } from 'bun:test';
import {
  isNonEmptyString,
  parsePreviewItems,
  parseTVEpisodes,
  toPositiveInteger,
} from './scrape-request';

describe('scrape request parsers', () => {
  test('validates non-empty strings and positive integers', () => {
    expect(isNonEmptyString('Andor')).toBe(true);
    expect(isNonEmptyString('   ')).toBe(false);
    expect(isNonEmptyString(1)).toBe(false);

    expect(toPositiveInteger(2)).toBe(2);
    expect(toPositiveInteger(0)).toBeNull();
    expect(toPositiveInteger(1.5)).toBeNull();
    expect(toPositiveInteger('2')).toBeNull();
  });

  test('parses tv episode inputs', () => {
    expect(parseTVEpisodes([])).toBeNull();
    expect(parseTVEpisodes([{ source: '/a', episode: 2 }])).toEqual([
      { source: '/a', episode: 2 },
    ]);
    expect(parseTVEpisodes([{ source: '/a', episode: 3, episodeEnd: 2 }])).toBeNull();
    expect(parseTVEpisodes([{ source: '', episode: 1 }])).toBeNull();
  });

  test('parses preview items', () => {
    expect(parsePreviewItems(null)).toBeNull();
    expect(parsePreviewItems([{ sourcePath: '/a' }])).toBeNull();
    expect(parsePreviewItems([{ sourcePath: '/a', kind: 'movie', tmdbId: 8 }])).toEqual([
      { sourcePath: '/a', kind: 'movie', tmdbId: 8 },
    ]);

    expect(parsePreviewItems([
      {
        sourcePath: '/a',
        kind: 'tv',
        showName: 'Show',
        tmdbId: 1,
        season: 1,
        episodes: [{ source: '/a', episode: 1 }],
      },
    ])).toEqual([
      {
        sourcePath: '/a',
        kind: 'tv',
        showName: 'Show',
        tmdbId: 1,
        season: 1,
        episodes: [{ source: '/a', episode: 1 }],
      },
    ]);
  });
});
