import { buildAiRecognizeMessage, getInboxRecognizeInput, resolveRecognizeCandidates } from '@media-scraper/shared/inbox-workflow';
import type { MediaFile, PathRecognizeResult, SearchResult } from '$lib/api';
import { recognizePath, searchTMDB, searchTMDBByImdb } from '$lib/api';

export async function resolveInboxAiRecognize(file: MediaFile): Promise<{
  aiRecognizeResult: PathRecognizeResult | null;
  matchCandidates: SearchResult[];
  selectedCandidate: SearchResult | null;
  editSeason?: number;
  editEpisode?: number;
  operationMessage: string;
}> {
  const result = await recognizePath(getInboxRecognizeInput(file));
  if (!result) {
    return {
      aiRecognizeResult: null,
      matchCandidates: [],
      selectedCandidate: null,
      operationMessage: '❌ AI 识别失败，请手动搜索',
    };
  }

  const backendCandidates = result.candidates || [];
  let imdbResults: SearchResult[] = [];
  let nameResults: SearchResult[] = [];
  if (!backendCandidates.length) {
    imdbResults = result.imdb_id ? await searchTMDBByImdb(result.imdb_id) : [];
    nameResults = (result.tmdb_name || result.title)
      ? await searchTMDB(result.tmdb_name || result.title)
      : [];
  }

  const resolved = resolveRecognizeCandidates(result, {
    backendCandidates,
    imdbResults,
    nameResults,
  });

  return {
    aiRecognizeResult: result,
    matchCandidates: resolved.candidates,
    selectedCandidate: resolved.selectedCandidate,
    editSeason: result.season ?? undefined,
    editEpisode: result.episode ?? undefined,
    operationMessage: buildAiRecognizeMessage(result),
  };
}
