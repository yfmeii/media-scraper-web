import { DEFAULT_LANGUAGE } from '@media-scraper/shared';
import { TMDB_API_KEY } from './config';

const TMDB_BASE = 'https://api.themoviedb.org/3';

export interface TMDBSearchResult {
  id: number;
  media_type?: 'tv' | 'movie';
  name?: string;
  title?: string;
  original_name?: string;
  original_title?: string;
  overview: string;
  poster_path?: string;
  backdrop_path?: string;
  first_air_date?: string;
  release_date?: string;
  vote_average: number;
}

export interface TMDBShowDetails {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path?: string;
  backdrop_path?: string;
  first_air_date: string;
  vote_average: number;
  status?: string;
  genres: { id: number; name: string }[];
  number_of_seasons: number;
}

export interface TMDBMovieDetails {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date: string;
  vote_average: number;
  runtime: number;
  tagline?: string;
  genres: { id: number; name: string }[];
}

export interface TMDBEpisodeDetails {
  id: number;
  name: string;
  episode_number: number;
  season_number: number;
  overview: string;
  air_date: string;
  vote_average: number;
  still_path?: string;
}

export interface TMDBSeasonDetails {
  id: number;
  name: string;
  season_number: number;
  overview: string;
  poster_path?: string;
  air_date?: string;
  episodes?: TMDBEpisodeDetails[];
}

// Search TV shows
export async function searchTV(query: string, year?: number, language: string = DEFAULT_LANGUAGE): Promise<TMDBSearchResult[]> {
  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    query,
    language,
  });
  if (year) params.set('first_air_date_year', year.toString());
  
  const res = await fetch(`${TMDB_BASE}/search/tv?${params}`);
  const data = await res.json();
  return (data.results || []).map((item: TMDBSearchResult) => ({ ...item, media_type: 'tv' as const }));
}

// Search movies
export async function searchMovie(query: string, year?: number, language: string = DEFAULT_LANGUAGE): Promise<TMDBSearchResult[]> {
  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    query,
    language,
  });
  if (year) params.set('year', year.toString());
  
  const res = await fetch(`${TMDB_BASE}/search/movie?${params}`);
  const data = await res.json();
  return (data.results || []).map((item: TMDBSearchResult) => ({ ...item, media_type: 'movie' as const }));
}

// Search mixed media (movie + tv)
export async function searchMulti(query: string, year?: number, language: string = DEFAULT_LANGUAGE): Promise<TMDBSearchResult[]> {
  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    query,
    language,
    include_adult: 'false',
  });

  const res = await fetch(`${TMDB_BASE}/search/multi?${params}`);
  const data = await res.json();
  const results = (data.results || []) as Array<TMDBSearchResult & { media_type?: string }>;

  return results
    .filter(item => item.media_type === 'tv' || item.media_type === 'movie')
    .filter((item) => {
      if (!year) return true;
      const date = item.first_air_date || item.release_date || '';
      if (!date) return true;
      const resultYear = Number.parseInt(date.split('-')[0] || '', 10);
      if (!Number.isInteger(resultYear)) return true;
      return Math.abs(resultYear - year) <= 1;
    })
    .map(item => ({
      ...item,
      media_type: item.media_type as 'tv' | 'movie',
    }));
}

// Get TV show details
export async function getTVDetails(id: number, language: string = DEFAULT_LANGUAGE): Promise<TMDBShowDetails | null> {
  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    language,
  });
  
  const res = await fetch(`${TMDB_BASE}/tv/${id}?${params}`);
  if (!res.ok) return null;
  return res.json();
}

// Get movie details
export async function getMovieDetails(id: number, language: string = DEFAULT_LANGUAGE): Promise<TMDBMovieDetails | null> {
  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    language,
  });
  
  const res = await fetch(`${TMDB_BASE}/movie/${id}?${params}`);
  if (!res.ok) return null;
  return res.json();
}

// Get episode details
export async function getEpisodeDetails(tvId: number, season: number, episode: number, language: string = DEFAULT_LANGUAGE): Promise<TMDBEpisodeDetails | null> {
  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    language,
  });
  
  const res = await fetch(`${TMDB_BASE}/tv/${tvId}/season/${season}/episode/${episode}?${params}`);
  if (!res.ok) return null;
  return res.json();
}

// Get season details (includes all episodes)
export async function getSeasonDetails(tvId: number, season: number, language: string = DEFAULT_LANGUAGE): Promise<TMDBSeasonDetails | null> {
  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    language,
  });
  
  const res = await fetch(`${TMDB_BASE}/tv/${tvId}/season/${season}?${params}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data) return null;
  data.episodes = data.episodes || [];
  return data as TMDBSeasonDetails;
}

// Calculate match score
export function calculateScore(query: string, year: number | undefined, result: TMDBSearchResult): number {
  let score = 0;
  
  // Title similarity
  const resultTitle = (result.name || result.title || '').toLowerCase();
  const queryLower = query.toLowerCase();
  
  if (resultTitle === queryLower) {
    score += 0.5;
  } else if (resultTitle.includes(queryLower) || queryLower.includes(resultTitle)) {
    score += 0.3;
  }
  
  // Year match
  const resultDate = result.first_air_date || result.release_date || '';
  if (resultDate && year) {
    const resultYear = parseInt(resultDate.split('-')[0]);
    if (resultYear === year) {
      score += 0.3;
    } else if (Math.abs(resultYear - year) <= 1) {
      score += 0.15;
    }
  }
  
  // Popularity bonus
  score += Math.min(result.vote_average / 50, 0.2);
  
  return Math.min(score, 1);
}

// Get best match from search results
export async function findBestMatch(
  kind: 'tv' | 'movie',
  title: string,
  year?: number,
  language: string = DEFAULT_LANGUAGE
): Promise<{ result: TMDBSearchResult; score: number; candidates: TMDBSearchResult[] } | null> {
  const results = kind === 'tv'
    ? await searchTV(title, year, language)
    : await searchMovie(title, year, language);
  
  if (results.length === 0) return null;
  
  const scored = results.map(r => ({ result: r, score: calculateScore(title, year, r) }));
  scored.sort((a, b) => b.score - a.score);
  
  return {
    result: scored[0].result,
    score: scored[0].score,
    candidates: results.slice(0, 5),
  };
}

// Get best match from mixed search results (movie + tv)
export async function findBestMatchMixed(
  title: string,
  year?: number,
  language: string = DEFAULT_LANGUAGE
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

// Get poster URL
export function getPosterUrl(path: string | undefined, size = 'w500'): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

// Get backdrop URL
export function getBackdropUrl(path: string | undefined, size = 'w1280'): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
