import { getInboxSearchKeyword, inferCandidateMediaType, inferMediaTypeFromParsed, mergeSearchResults, moveSearchResultToFront } from './inbox-common';
import type { MediaFile, PathRecognizeResult, RecognizeCandidate, SearchResult } from './types';

export function getPreferredRecognizeCandidate(result: PathRecognizeResult): RecognizeCandidate | null {
  if (!result.recognize_candidates?.length) return null;
  const preferredId = result.preferred_tmdb_id ?? result.tmdb_id ?? null;
  if (preferredId) {
    const matched = result.recognize_candidates.find(item => (item.preferred_tmdb_id ?? item.tmdb_id ?? null) === preferredId || item.tmdb_id === preferredId);
    if (matched) return matched;
  }
  return result.recognize_candidates[0] || null;
}

export function buildRecognizeFallbackCandidate(
  result: PathRecognizeResult | RecognizeCandidate,
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
  const preferredRecognizeCandidate = getPreferredRecognizeCandidate(result);
  const preferredId = options?.preferredId
    || preferredRecognizeCandidate?.preferred_tmdb_id
    || preferredRecognizeCandidate?.tmdb_id
    || result.preferred_tmdb_id
    || result.tmdb_id
    || imdbResults[0]?.id
    || null;
  const merged = mergeSearchResults(backendCandidates, imdbResults, nameResults);
  const fallbackSource = preferredRecognizeCandidate || result;
  const fallbackCandidate = buildRecognizeFallbackCandidate(fallbackSource, preferredId);
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
  const preferredRecognizeCandidate = getPreferredRecognizeCandidate(result);
  const tmdbId = preferredRecognizeCandidate?.tmdb_id ?? result.tmdb_id ?? imdbMatched?.id ?? null;
  const mediaType = inferCandidateMediaType(
    imdbMatched || {
      mediaType: preferredRecognizeCandidate?.media_type || result.media_type,
      firstAirDate: (preferredRecognizeCandidate?.media_type || result.media_type) === 'tv' && (preferredRecognizeCandidate?.year ?? result.year)
        ? `${preferredRecognizeCandidate?.year ?? result.year}-01-01`
        : undefined,
      releaseDate: (preferredRecognizeCandidate?.media_type || result.media_type) === 'movie' && (preferredRecognizeCandidate?.year ?? result.year)
        ? `${preferredRecognizeCandidate?.year ?? result.year}-01-01`
        : undefined,
    },
    inferMediaTypeFromParsed(file.parsed),
  );
  const fallbackName = getInboxSearchKeyword(file);
  return {
    tmdbId,
    mediaType,
    displayName: imdbMatched?.name || imdbMatched?.title || preferredRecognizeCandidate?.tmdb_name || result.tmdb_name || preferredRecognizeCandidate?.title || result.title || fallbackName,
    season: preferredRecognizeCandidate?.season || result.season || file.parsed.season || 1,
    episode: preferredRecognizeCandidate?.episode || result.episode || file.parsed.episode || 1,
  };
}
