import { describe, expect, test } from 'bun:test';
import { calculateScore, getPosterUrl, getBackdropUrl, type TMDBSearchResult } from './tmdb';

describe('TMDB Utils', () => {
  describe('calculateScore', () => {
    test('should give high score for exact title match', () => {
      const result: TMDBSearchResult = {
        id: 1,
        name: 'Breaking Bad',
        overview: '',
        vote_average: 8.5,
        first_air_date: '2008-01-20',
      };
      
      const score = calculateScore('Breaking Bad', 2008, result);
      expect(score).toBeGreaterThan(0.7);
    });

    test('should give bonus for year match', () => {
      const result: TMDBSearchResult = {
        id: 1,
        name: 'Some Show',
        overview: '',
        vote_average: 7.0,
        first_air_date: '2020-05-15',
      };
      
      const scoreWithYear = calculateScore('Some Show', 2020, result);
      const scoreWithoutYear = calculateScore('Some Show', undefined, result);
      
      expect(scoreWithYear).toBeGreaterThan(scoreWithoutYear);
    });

    test('should give partial score for year close match', () => {
      const result: TMDBSearchResult = {
        id: 1,
        name: 'Show',
        overview: '',
        vote_average: 7.0,
        first_air_date: '2020-05-15',
      };
      
      const exactYear = calculateScore('Show', 2020, result);
      const closeYear = calculateScore('Show', 2019, result);
      const farYear = calculateScore('Show', 2015, result);
      
      expect(exactYear).toBeGreaterThan(closeYear);
      expect(closeYear).toBeGreaterThan(farYear);
    });

    test('should give partial score for partial title match', () => {
      const result: TMDBSearchResult = {
        id: 1,
        name: 'The Walking Dead',
        overview: '',
        vote_average: 7.5,
      };
      
      const partialScore = calculateScore('Walking Dead', undefined, result);
      expect(partialScore).toBeGreaterThan(0.2);
    });

    test('should include vote average in score', () => {
      const highRated: TMDBSearchResult = {
        id: 1,
        name: 'Show',
        overview: '',
        vote_average: 9.0,
      };
      
      const lowRated: TMDBSearchResult = {
        id: 2,
        name: 'Show',
        overview: '',
        vote_average: 2.0,
      };
      
      const highScore = calculateScore('Show', undefined, highRated);
      const lowScore = calculateScore('Show', undefined, lowRated);
      
      expect(highScore).toBeGreaterThan(lowScore);
    });

    test('should cap score at 1', () => {
      const result: TMDBSearchResult = {
        id: 1,
        name: 'Exact Match',
        overview: '',
        vote_average: 10.0,
        first_air_date: '2020-01-01',
      };
      
      const score = calculateScore('Exact Match', 2020, result);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('getPosterUrl', () => {
    test('should return full URL for valid path', () => {
      const url = getPosterUrl('/abc123.jpg', 'w500');
      expect(url).toBe('https://image.tmdb.org/t/p/w500/abc123.jpg');
    });

    test('should return null for undefined path', () => {
      const url = getPosterUrl(undefined);
      expect(url).toBeNull();
    });

    test('should use default size', () => {
      const url = getPosterUrl('/test.jpg');
      expect(url).toBe('https://image.tmdb.org/t/p/w500/test.jpg');
    });
  });

  describe('getBackdropUrl', () => {
    test('should return full URL for valid path', () => {
      const url = getBackdropUrl('/backdrop.jpg', 'w1280');
      expect(url).toBe('https://image.tmdb.org/t/p/w1280/backdrop.jpg');
    });

    test('should return null for undefined path', () => {
      const url = getBackdropUrl(undefined);
      expect(url).toBeNull();
    });
  });
});
