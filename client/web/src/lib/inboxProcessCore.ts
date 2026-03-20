import {
  buildRecognizeProcessSelection,
  getInboxRecognizeInput,
  getInboxSearchKeyword,
  inferCandidateMediaType,
  inferMediaTypeFromParsed,
} from '@media-scraper/shared/inbox-workflow';
import type { MatchResult, MediaFile, PathRecognizeResult, ScrapeResult, SearchResult } from '$lib/api';
import { autoMatch, processMovie, processTV, searchTMDBByImdb } from '$lib/api';

export async function processSelectedCandidate(
  file: MediaFile,
  candidate: SearchResult,
  options?: { season?: number; episode?: number },
): Promise<ScrapeResult> {
  const showName = candidate.name || candidate.title || '';
  const kind = inferCandidateMediaType(candidate, inferMediaTypeFromParsed(file.parsed));

  if (kind === 'movie') {
    return processMovie({
      sourcePath: file.path,
      tmdbId: candidate.id,
    });
  }

  return processTV({
    sourcePath: file.path,
    showName,
    tmdbId: candidate.id,
    season: options?.season ?? file.parsed.season ?? 1,
    episodes: [{ source: file.path, episode: options?.episode ?? file.parsed.episode ?? 1 }],
  });
}

export async function autoProcessInboxFile(file: MediaFile): Promise<{
  result: ScrapeResult;
  matchResult: MatchResult;
  mediaType?: 'tv' | 'movie';
}> {
  const matchResult = await autoMatch(file.path, getInboxSearchKeyword(file), file.parsed.year);

  if (!matchResult.result) {
    return {
      result: { success: false, message: 'No match result' },
      matchResult,
    };
  }

  const mediaType = inferCandidateMediaType(matchResult.result, inferMediaTypeFromParsed(file.parsed));
  const result = await processSelectedCandidate(file, {
    id: matchResult.result.id,
    name: matchResult.result.name,
    title: matchResult.result.name,
    mediaType: matchResult.result.mediaType,
  }, {
    season: file.parsed.season ?? 1,
    episode: file.parsed.episode ?? 1,
  });

  return { result, matchResult, mediaType };
}

export async function aiRecognizeProcessInboxFile(
  file: MediaFile,
  recognize: (path: string) => Promise<PathRecognizeResult | null>,
): Promise<{
  result: ScrapeResult;
  recognizeResult: PathRecognizeResult | null;
  mediaType?: 'tv' | 'movie';
}> {
  const recognizeResult = await recognize(getInboxRecognizeInput(file));
  if (!recognizeResult) {
    return {
      result: { success: false, message: 'Path recognition failed' },
      recognizeResult: null,
    };
  }

  const imdbMatched = recognizeResult.imdb_id
    ? (await searchTMDBByImdb(recognizeResult.imdb_id))[0] || null
    : null;
  const resolved = buildRecognizeProcessSelection({ file, result: recognizeResult, imdbMatched });
  if (!resolved.tmdbId) {
    return {
      result: { success: false, message: 'Missing TMDB ID' },
      recognizeResult,
      mediaType: resolved.mediaType,
    };
  }

  const result = resolved.mediaType === 'movie'
    ? await processMovie({
        sourcePath: file.path,
        tmdbId: resolved.tmdbId,
      })
    : await processTV({
        sourcePath: file.path,
        showName: resolved.displayName,
        tmdbId: resolved.tmdbId,
        season: resolved.season,
        episodes: [{ source: file.path, episode: resolved.episode }],
      });

  return {
    result,
    recognizeResult,
    mediaType: resolved.mediaType,
  };
}
