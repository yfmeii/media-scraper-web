import { DEFAULT_LANGUAGE } from '@media-scraper/shared/constants';
import { TMDB_API_KEY } from './config';
import type {
  TMDBFindResponse,
  TMDBMovieDetails,
  TMDBSearchResult,
  TMDBSeasonDetails,
  TMDBShowDetails,
} from './tmdb-types';

const TMDB_BASE = 'https://api.themoviedb.org/3';

function createTMDBParams(language: string) {
  return new URLSearchParams({
    api_key: TMDB_API_KEY,
    language,
  });
}

async function fetchTMDBJson<T>(path: string, params: URLSearchParams): Promise<T | null> {
  const res = await fetch(`${TMDB_BASE}${path}?${params}`);
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

function withMediaType(results: TMDBSearchResult[], mediaType: 'tv' | 'movie') {
  return results.map(item => ({ ...item, media_type: mediaType as const }));
}

function filterByApproxYear(results: Array<TMDBSearchResult & { media_type?: string }>, year?: number) {
  return results.filter((item) => {
    if (!year) return true;
    const date = item.first_air_date || item.release_date || '';
    if (!date) return true;
    const resultYear = Number.parseInt(date.split('-')[0] || '', 10);
    if (!Number.isInteger(resultYear)) return true;
    return Math.abs(resultYear - year) <= 1;
  });
}

export async function searchTV(query: string, year?: number, language: string = DEFAULT_LANGUAGE): Promise<TMDBSearchResult[]> {
  const params = createTMDBParams(language);
  params.set('query', query);
  if (year) params.set('first_air_date_year', year.toString());

  const data = await fetchTMDBJson<{ results?: TMDBSearchResult[] }>('/search/tv', params);
  return withMediaType(data?.results || [], 'tv');
}

export async function searchMovie(query: string, year?: number, language: string = DEFAULT_LANGUAGE): Promise<TMDBSearchResult[]> {
  const params = createTMDBParams(language);
  params.set('query', query);
  if (year) params.set('year', year.toString());

  const data = await fetchTMDBJson<{ results?: TMDBSearchResult[] }>('/search/movie', params);
  return withMediaType(data?.results || [], 'movie');
}

export async function searchMulti(query: string, year?: number, language: string = DEFAULT_LANGUAGE): Promise<TMDBSearchResult[]> {
  const params = createTMDBParams(language);
  params.set('query', query);
  params.set('include_adult', 'false');

  const data = await fetchTMDBJson<{ results?: Array<TMDBSearchResult & { media_type?: string }> }>('/search/multi', params);
  const results = data?.results || [];

  return filterByApproxYear(results, year)
    .filter(item => item.media_type === 'tv' || item.media_type === 'movie')
    .map(item => ({
      ...item,
      media_type: item.media_type as 'tv' | 'movie',
    }));
}

export async function findByImdbId(
  imdbId: string,
  language: string = DEFAULT_LANGUAGE,
  preferredType?: 'tv' | 'movie',
): Promise<TMDBSearchResult | null> {
  const normalized = imdbId.trim();
  if (!normalized) return null;

  const params = createTMDBParams(language);
  params.set('external_source', 'imdb_id');

  const data = await fetchTMDBJson<TMDBFindResponse>(`/find/${encodeURIComponent(normalized)}`, params);
  if (!data) return null;

  const tvResults = withMediaType(data.tv_results || [], 'tv');
  const movieResults = withMediaType(data.movie_results || [], 'movie');
  const merged = preferredType === 'tv'
    ? [...tvResults, ...movieResults]
    : preferredType === 'movie'
      ? [...movieResults, ...tvResults]
      : [...tvResults, ...movieResults];

  if (merged.length === 0) return null;
  merged.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
  return merged[0];
}

export async function getTVDetails(id: number, language: string = DEFAULT_LANGUAGE): Promise<TMDBShowDetails | null> {
  return fetchTMDBJson<TMDBShowDetails>(`/tv/${id}`, createTMDBParams(language));
}

export async function getMovieDetails(id: number, language: string = DEFAULT_LANGUAGE): Promise<TMDBMovieDetails | null> {
  return fetchTMDBJson<TMDBMovieDetails>(`/movie/${id}`, createTMDBParams(language));
}

export async function getEpisodeDetails(tvId: number, season: number, episode: number, language: string = DEFAULT_LANGUAGE) {
  return fetchTMDBJson(`/tv/${tvId}/season/${season}/episode/${episode}`, createTMDBParams(language));
}

export async function getSeasonDetails(tvId: number, season: number, language: string = DEFAULT_LANGUAGE): Promise<TMDBSeasonDetails | null> {
  const data = await fetchTMDBJson<TMDBSeasonDetails>(`/tv/${tvId}/season/${season}`, createTMDBParams(language));
  if (!data) return null;
  data.episodes = data.episodes || [];
  return data;
}

export async function findByTmdbId(
  tmdbId: number,
  preferredType: 'tv' | 'movie' = 'tv',
  language: string = DEFAULT_LANGUAGE,
): Promise<TMDBSearchResult | null> {
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) return null;

  const tryTypes: Array<'tv' | 'movie'> = preferredType === 'movie' ? ['movie', 'tv'] : ['tv', 'movie'];

  for (const kind of tryTypes) {
    if (kind === 'tv') {
      const details = await getTVDetails(tmdbId, language);
      if (!details) continue;
      return {
        id: details.id,
        media_type: 'tv',
        name: details.name,
        title: details.name,
        original_name: details.original_name,
        original_title: details.original_name,
        overview: details.overview || '',
        poster_path: details.poster_path,
        backdrop_path: details.backdrop_path,
        first_air_date: details.first_air_date,
        vote_average: details.vote_average || 0,
      };
    }

    const details = await getMovieDetails(tmdbId, language);
    if (!details) continue;
    return {
      id: details.id,
      media_type: 'movie',
      name: details.title,
      title: details.title,
      original_name: details.original_title,
      original_title: details.original_title,
      overview: details.overview || '',
      poster_path: details.poster_path,
      backdrop_path: details.backdrop_path,
      release_date: details.release_date,
      vote_average: details.vote_average || 0,
    };
  }

  return null;
}

export function getPosterUrl(path: string | undefined, size = 'w500'): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function getBackdropUrl(path: string | undefined, size = 'w1280'): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
