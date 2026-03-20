import { DEFAULT_LANGUAGE } from '@media-scraper/shared/constants';
import { searchMovie, searchMulti, searchTV } from './tmdb-api';
import type { TMDBSearchResult } from './tmdb-types';

export function calculateScore(query: string, year: number | undefined, result: TMDBSearchResult): number {
  let score = 0;

  const resultTitle = (result.name || result.title || '').toLowerCase();
  const queryLower = query.toLowerCase();

  if (resultTitle === queryLower) {
    score += 0.5;
  } else if (resultTitle.includes(queryLower) || queryLower.includes(resultTitle)) {
    score += 0.3;
  }

  const resultDate = result.first_air_date || result.release_date || '';
  if (resultDate && year) {
    const resultYear = parseInt(resultDate.split('-')[0]);
    if (resultYear === year) {
      score += 0.3;
    } else if (Math.abs(resultYear - year) <= 1) {
      score += 0.15;
    }
  }

  score += Math.min(result.vote_average / 50, 0.2);

  return Math.min(score, 1);
}

export async function findBestMatch(
  kind: 'tv' | 'movie',
  title: string,
  year?: number,
  language: string = DEFAULT_LANGUAGE,
): Promise<{ result: TMDBSearchResult; score: number; candidates: TMDBSearchResult[] } | null> {
  const results = kind === 'tv'
    ? await searchTV(title, year, language)
    : await searchMovie(title, year, language);

  if (results.length === 0) return null;

  const scored = results.map(result => ({ result, score: calculateScore(title, year, result) }));
  scored.sort((a, b) => b.score - a.score);

  return {
    result: scored[0].result,
    score: scored[0].score,
    candidates: results.slice(0, 5),
  };
}

export async function findBestMatchMixed(
  title: string,
  year?: number,
  language: string = DEFAULT_LANGUAGE,
): Promise<{ result: TMDBSearchResult; score: number; candidates: TMDBSearchResult[] } | null> {
  const results = await searchMulti(title, year, language);
  if (results.length === 0) return null;

  const scored = results.map(result => ({ result, score: calculateScore(title, year, result) }));
  scored.sort((a, b) => b.score - a.score);

  return {
    result: scored[0].result,
    score: scored[0].score,
    candidates: scored.slice(0, 10).map(item => item.result),
  };
}
