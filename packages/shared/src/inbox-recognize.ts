import { getInboxSearchKeyword, inferCandidateMediaType, inferMediaTypeFromParsed, mergeSearchResults, moveSearchResultToFront } from './inbox-common';
import type { MediaFile, PathRecognizeResult, SearchResult } from './types';

export function buildRecognizeFallbackCandidate(
  result: PathRecognizeResult,
  tmdbId = result.tmdb_id,
): SearchResult | null {
  if (!tmdbId) return null;
  const mediaType: 'tv' | 'movie' = result.media_type === 'tv' ? 'tv' : 'movie';
  const displayName = result.tmdb_name || result.title || `TMDB ${tmdbId}`;
  const date = result.year ? `${result.year}-01-01` : undefined;
  if (mediaType === 'movie') {
    return {
      id: tmdbId,
      mediaType,
      title: displayName,
      name: displayName,
      releaseDate: date,
    };
  }
  return {
    id: tmdbId,
    mediaType,
    name: displayName,
    title: displayName,
    firstAirDate: date,
  };
}

export function resolveRecognizeCandidates(
  result: PathRecognizeResult,
  options?: {
    backendCandidates?: SearchResult[];
    imdbResults?: SearchResult[];
    nameResults?: SearchResult[];
    preferredId?: number | null;
  },
): {
  preferredId: number | null;
  candidates: SearchResult[];
  selectedCandidate: SearchResult | null;
} {
  const backendCandidates = options?.backendCandidates || result.candidates || [];
  const imdbResults = options?.imdbResults || [];
  const nameResults = options?.nameResults || [];
  const preferredId = options?.preferredId || result.preferred_tmdb_id || result.tmdb_id || imdbResults[0]?.id || null;
  const merged = mergeSearchResults(backendCandidates, imdbResults, nameResults);
  const fallbackCandidate = buildRecognizeFallbackCandidate(result, preferredId);
  const withFallback = preferredId && fallbackCandidate && !merged.some(item => item.id === preferredId)
    ? [fallbackCandidate, ...merged]
    : merged;
  const ordered = moveSearchResultToFront(withFallback, preferredId);
  return {
    preferredId,
    candidates: ordered,
    selectedCandidate: preferredId
      ? (ordered.find(item => item.id === preferredId) || ordered[0] || null)
      : (ordered[0] || null),
  };
}

export function buildAiRecognizeMessage(result: Pick<PathRecognizeResult, 'media_type' | 'confidence'>): string {
  const aiMediaType = result.media_type || 'tv';
  return result.confidence < 0.7
    ? `⚠️ AI 置信度较低 (${Math.round(result.confidence * 100)}%)，建议手动确认`
    : `🤖 AI 识别为${aiMediaType === 'movie' ? '电影' : '剧集'}，请选择候选确认`;
}

export function applyAiRecognizeState(params: {
  resolved: {
    aiRecognizeResult: PathRecognizeResult | null;
    matchCandidates: SearchResult[];
    selectedCandidate: SearchResult | null;
    editSeason?: number;
    editEpisode?: number;
    operationMessage?: string;
  };
  currentSeason: number;
  currentEpisode: number;
}) {
  return {
    aiRecognizeResult: params.resolved.aiRecognizeResult,
    matchCandidates: params.resolved.matchCandidates,
    selectedCandidate: params.resolved.selectedCandidate,
    editSeason: params.resolved.editSeason ?? params.currentSeason,
    editEpisode: params.resolved.editEpisode ?? params.currentEpisode,
    operationMessage: params.resolved.operationMessage || '',
  };
}

export function buildRecognizeProcessSelection(params: {
  file: Pick<MediaFile, 'name' | 'parsed'>;
  result: PathRecognizeResult;
  imdbMatched?: SearchResult | null;
}) {
  const { file, result, imdbMatched } = params;
  const tmdbId = result.tmdb_id ?? imdbMatched?.id ?? null;
  const mediaType = inferCandidateMediaType(
    imdbMatched || {
      mediaType: result.media_type,
      firstAirDate: result.media_type === 'tv' && result.year ? `${result.year}-01-01` : undefined,
      releaseDate: result.media_type === 'movie' && result.year ? `${result.year}-01-01` : undefined,
    },
    inferMediaTypeFromParsed(file.parsed),
  );
  const fallbackName = getInboxSearchKeyword(file);
  return {
    tmdbId,
    mediaType,
    displayName: imdbMatched?.name || imdbMatched?.title || result.tmdb_name || result.title || fallbackName,
    season: result.season || file.parsed.season || 1,
    episode: result.episode || file.parsed.episode || 1,
  };
}
