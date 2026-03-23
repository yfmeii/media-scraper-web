import { buildRecognizeFallbackCandidate } from '@media-scraper/shared/inbox-workflow';
import type { PathRecognizeResult, RecognizeCandidate, SearchResult } from '@media-scraper/shared/types';
import { mapSearchResult, type SearchKind } from './scrape-helpers';

export function buildSearchResponse(kind: SearchKind, results: any[]) {
  return {
    success: true,
    data: results.slice(0, 10).map((result) => mapSearchResult(kind, result)),
  };
}

export function buildImdbSearchResponse(matched: any | null) {
  return {
    success: true,
    data: matched ? [mapSearchResult('multi', matched)] : [],
  };
}

export function buildMatchNotFoundResponse(searchTitle: string, searchYear?: number) {
  return {
    success: true,
    data: {
      matched: false,
      title: searchTitle,
      year: searchYear,
      candidates: [],
    },
  };
}

export function buildPreviewResponse(plan: any) {
  return {
    success: true,
    data: plan,
  };
}

export function buildRecognizeResponse(params: {
  result: PathRecognizeResult;
  candidates: Array<SearchResult | null>;
  preferredTmdbId: number | null;
  recognizeCandidates?: RecognizeCandidate[];
}) {
  let candidates = params.candidates.filter((item): item is SearchResult => Boolean(item));
  if (!candidates.length && params.preferredTmdbId) {
    candidates = [buildRecognizeFallbackCandidate(params.result, params.preferredTmdbId)].filter(
      (item): item is SearchResult => Boolean(item),
    );
  }

  const preferredCandidate = candidates.find((item) => item.id === params.preferredTmdbId) || candidates[0];
  const resolvedTmdbName = params.result.tmdb_name
    || preferredCandidate?.name
    || preferredCandidate?.title
    || null;

  return {
    success: true,
    data: {
      ...params.result,
      tmdb_id: params.preferredTmdbId || params.result.tmdb_id,
      tmdb_name: resolvedTmdbName,
      preferred_tmdb_id: params.preferredTmdbId || params.result.tmdb_id,
      candidates,
      recognize_candidates: params.recognizeCandidates || params.result.recognize_candidates,
    },
  };
}
