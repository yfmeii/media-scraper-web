import type { MatchResult, SearchResult } from './types';

export function mapMatchCandidateToSearchResult(item: MatchResult['candidates'][number]): SearchResult {
  return {
    id: item.id,
    mediaType: item.mediaType,
    name: item.name,
    title: item.name,
    posterPath: item.posterPath,
    overview: item.overview,
    firstAirDate: item.date,
    releaseDate: item.date,
  };
}

export function mapMatchResultToSelection(result: MatchResult): {
  candidates: SearchResult[];
  selectedCandidate: SearchResult | null;
  matchScore: number;
} {
  const candidates = result.candidates.map(mapMatchCandidateToSearchResult);
  const selectedCandidate = result.matched && result.result
    ? (candidates.find(item => item.id === result.result?.id) || null)
    : null;
  return {
    candidates,
    selectedCandidate,
    matchScore: result.result?.score || 0,
  };
}
