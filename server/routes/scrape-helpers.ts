import {
  buildRecognizeFallbackCandidate,
  mergeSearchResults,
  moveSearchResultToFront,
} from '@media-scraper/shared/inbox-workflow';
import type { PathRecognizeResult, RecognizeCandidate, SearchResult } from '@media-scraper/shared/types';
import {
  findByImdbId,
  findByTmdbId,
  getPosterUrl,
  searchMulti,
  type TMDBSearchResult,
} from '../lib/tmdb';

export type SearchKind = 'tv' | 'movie' | 'multi';

export function mapSearchResult(kind: SearchKind, result: TMDBSearchResult): SearchResult {
  const mediaType = result.media_type === 'tv' || result.media_type === 'movie'
    ? result.media_type
    : (kind === 'tv' ? 'tv' : 'movie');

  if (mediaType === 'tv') {
    return {
      id: result.id,
      mediaType: 'tv',
      name: result.name,
      originalName: result.original_name,
      overview: result.overview?.slice(0, 200),
      firstAirDate: result.first_air_date,
      voteAverage: result.vote_average,
      posterPath: getPosterUrl(result.poster_path, 'w185'),
    };
  }

  return {
    id: result.id,
    mediaType: 'movie',
    title: result.title,
    originalTitle: result.original_title,
    overview: result.overview?.slice(0, 200),
    releaseDate: result.release_date,
    voteAverage: result.vote_average,
    posterPath: getPosterUrl(result.poster_path, 'w185'),
  };
}

export async function enrichRecognizeCandidates(result: PathRecognizeResult, language: string): Promise<{
  candidates: SearchResult[];
  preferredTmdbId: number | null;
  recognizeCandidates?: RecognizeCandidate[];
}> {
  let byImdb: TMDBSearchResult | null = null;
  if (result.imdb_id) {
    try {
      byImdb = await findByImdbId(result.imdb_id, language, result.media_type);
    } catch (error) {
      console.error('[recognize] findByImdbId failed:', error);
    }
  }

  let byTmdb: TMDBSearchResult | null = null;
  if (result.tmdb_id) {
    try {
      byTmdb = await findByTmdbId(result.tmdb_id, result.media_type, language);
    } catch (error) {
      console.error('[recognize] findByTmdbId failed:', error);
    }
  }

  const query = (result.tmdb_name || result.title || '').trim();
  let byName: TMDBSearchResult[] = [];
  if (query) {
    try {
      byName = await searchMulti(query, result.year ?? undefined, language);
    } catch (error) {
      console.error('[recognize] searchMulti failed:', error);
    }
  }

  const preferredTmdbId = byImdb?.id || byTmdb?.id || result.tmdb_id || null;
  const merged = moveSearchResultToFront(
    mergeSearchResults(
      byImdb ? [mapSearchResult('multi', byImdb)] : [],
      byTmdb ? [mapSearchResult('multi', byTmdb)] : [],
      byName.map(item => mapSearchResult('multi', item)),
    ),
    preferredTmdbId,
  );

  let candidates = merged.slice(0, 10);
  if (preferredTmdbId && !candidates.some(item => item.id === preferredTmdbId)) {
    candidates = [buildRecognizeFallbackCandidate(result, preferredTmdbId)!, ...candidates];
  }

  const recognizeCandidates = result.recognize_candidates?.length
    ? result.recognize_candidates.map(candidate => ({
        ...candidate,
        preferred_tmdb_id: candidate.preferred_tmdb_id ?? candidate.tmdb_id ?? null,
        candidates: moveSearchResultToFront(
          mergeSearchResults(candidate.candidates || [], candidates),
          candidate.preferred_tmdb_id ?? candidate.tmdb_id ?? null,
        ).slice(0, 10),
      }))
    : undefined;

  return { candidates, preferredTmdbId, recognizeCandidates };
}

export function buildMatchPayload(
  match: {
    score: number;
    result: TMDBSearchResult;
    candidates: Array<TMDBSearchResult & { score?: number }>;
  },
  kind: 'tv' | 'movie' | undefined,
) {
  const isAmbiguous = match.score < 0.5 || (
    match.candidates.length > 1
    && match.candidates[1]
    && (match.score - (match.candidates[1].score || 0)) < 0.1
  );

  return {
    matched: !isAmbiguous,
    result: {
      id: match.result.id,
      name: match.result.name || match.result.title,
      mediaType: match.result.media_type || kind || 'movie',
      originalName: match.result.original_name || match.result.original_title,
      date: match.result.first_air_date || match.result.release_date,
      posterPath: getPosterUrl(match.result.poster_path, 'w185'),
      score: match.score,
    },
    candidates: match.candidates.slice(0, 5).map(r => ({
      id: r.id,
      name: r.name || r.title,
      mediaType: r.media_type || kind || 'movie',
      originalName: r.original_name || r.original_title,
      date: r.first_air_date || r.release_date,
      posterPath: getPosterUrl(r.poster_path, 'w185'),
      overview: r.overview?.slice(0, 150),
    })),
    ambiguous: isAmbiguous,
  };
}
