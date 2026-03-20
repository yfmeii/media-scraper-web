import type {
  PreviewAction,
  MatchResult,
  MediaFile,
  ParsedInfo,
  PathRecognizeResult,
  PreviewItem,
  PreviewPlan,
  SearchResult,
} from './types';

export type SearchTMDBType = 'tv' | 'movie' | 'multi';

export function getInboxSearchKeyword(file: Pick<MediaFile, 'name' | 'parsed'>): string {
  return file.parsed.title || file.name.replace(/\.[^/.]+$/, '');
}

export function getInboxRecognizeInput(file: Pick<MediaFile, 'path' | 'relativePath'>): string {
  return file.relativePath || file.path;
}

export function inferMediaTypeFromParsed(parsed: ParsedInfo | null | undefined): 'tv' | 'movie' {
  if (!parsed) return 'movie';
  return parsed.season !== undefined || parsed.episode !== undefined ? 'tv' : 'movie';
}

export function inferCandidateMediaType(
  candidate: Pick<SearchResult, 'mediaType' | 'firstAirDate' | 'releaseDate'> | null | undefined,
  fallback: 'tv' | 'movie' = 'movie',
): 'tv' | 'movie' {
  if (candidate?.mediaType === 'tv' || candidate?.mediaType === 'movie') return candidate.mediaType;
  if (candidate?.firstAirDate && !candidate?.releaseDate) return 'tv';
  if (candidate?.releaseDate && !candidate?.firstAirDate) return 'movie';
  return fallback;
}

export function mergeSearchResults(...groups: SearchResult[][]): SearchResult[] {
  const merged: SearchResult[] = [];
  const seen = new Set<number>();
  for (const group of groups) {
    for (const item of group) {
      if (!item || seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}

export function moveSearchResultToFront(
  list: SearchResult[],
  preferredId: number | null | undefined,
): SearchResult[] {
  if (!preferredId) return list;
  const idx = list.findIndex(item => item.id === preferredId);
  if (idx <= 0) return list;
  const copy = list.slice();
  const [hit] = copy.splice(idx, 1);
  copy.unshift(hit);
  return copy;
}

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
}): {
  aiRecognizeResult: PathRecognizeResult | null;
  matchCandidates: SearchResult[];
  selectedCandidate: SearchResult | null;
  editSeason: number;
  editEpisode: number;
  operationMessage: string;
} {
  return {
    aiRecognizeResult: params.resolved.aiRecognizeResult,
    matchCandidates: params.resolved.matchCandidates,
    selectedCandidate: params.resolved.selectedCandidate,
    editSeason: params.resolved.editSeason ?? params.currentSeason,
    editEpisode: params.resolved.editEpisode ?? params.currentEpisode,
    operationMessage: params.resolved.operationMessage || '',
  };
}

export function buildInboxBatchSummaryMessage(summary: {
  successCount: number;
  tvCount: number;
  movieCount: number;
  failCount: number;
}): string {
  return `完成: ${summary.successCount} 成功 (${summary.tvCount} 剧集, ${summary.movieCount} 电影), ${summary.failCount} 失败`;
}

export function createInboxPreviewState(plan: PreviewPlan | null): {
  previewActions: PreviewAction[];
  previewSummary: PreviewPlan['impactSummary'] | null;
} {
  if (!plan) {
    return {
      previewActions: [],
      previewSummary: null,
    };
  }

  return {
    previewActions: plan.actions,
    previewSummary: plan.impactSummary,
  };
}

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

export function extractPreviewTargetPath(plan: PreviewPlan, sourcePath: string): string {
  const directMove = plan.actions.find(action => action.type === 'move' && action.source === sourcePath);
  if (directMove?.destination) return directMove.destination;

  const firstMove = plan.actions.find(action => action.type === 'move');
  if (firstMove?.destination) return firstMove.destination;

  const firstDir = plan.actions.find(action => action.type === 'create-dir');
  return firstDir?.destination || '';
}

export function buildPreviewItemFromSelection(params: {
  file: Pick<MediaFile, 'path' | 'name' | 'parsed'>;
  candidate: SearchResult;
  season?: number;
  episode?: number;
  fallbackKind?: 'tv' | 'movie';
}): PreviewItem {
  const { file, candidate, season = 1, episode = 1 } = params;
  const kind = inferCandidateMediaType(candidate, params.fallbackKind || inferMediaTypeFromParsed(file.parsed));
  const item: PreviewItem = {
    sourcePath: file.path,
    kind,
    tmdbId: candidate.id,
    showName: candidate.name || candidate.title || file.name,
  };
  if (kind === 'tv') {
    item.season = season;
    item.episodes = [{
      source: file.path,
      episode,
      episodeEnd: file.parsed.episodeEnd,
    }];
  }
  return item;
}

export function buildRecognizeProcessSelection(params: {
  file: Pick<MediaFile, 'name' | 'parsed'>;
  result: PathRecognizeResult;
  imdbMatched?: SearchResult | null;
}): {
  tmdbId: number | null;
  mediaType: 'tv' | 'movie';
  displayName: string;
  season: number;
  episode: number;
} {
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
  const fallbackName = file.parsed.title || file.name.replace(/\.[^/.]+$/, '');
  return {
    tmdbId,
    mediaType,
    displayName: imdbMatched?.name || imdbMatched?.title || result.tmdb_name || result.title || fallbackName,
    season: result.season || file.parsed.season || 1,
    episode: result.episode || file.parsed.episode || 1,
  };
}
