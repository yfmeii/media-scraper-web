import { getInboxSearchKeyword, mapMatchResultToSelection } from '@media-scraper/shared/inbox-workflow';
import type { MediaFile, SearchResult } from '$lib/api';
import { autoMatch, searchTMDB } from '$lib/api';

export async function loadInboxDetailMatch(file: MediaFile): Promise<{
  candidates: SearchResult[];
  selectedCandidate: SearchResult | null;
  isAutoMatched: boolean;
  matchScore: number;
}> {
  const matchResult = await autoMatch(file.path, getInboxSearchKeyword(file), file.parsed.year);
  const mapped = mapMatchResultToSelection(matchResult);
  return {
    candidates: mapped.candidates,
    selectedCandidate: mapped.selectedCandidate,
    isAutoMatched: Boolean(mapped.selectedCandidate),
    matchScore: mapped.matchScore,
  };
}

export async function searchInboxCandidates(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  return searchTMDB(query);
}
