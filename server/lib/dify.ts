import { DEFAULT_LANGUAGE } from '@media-scraper/shared/constants';
import type { PathRecognizeResult, RecognizeCandidate } from '@media-scraper/shared/types';
import { DIFY_PATH_RECOGNIZER_KEY, DIFY_BASE_URL } from './config';
import { findByImdbId } from './tmdb';

function toNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function normalizeRecognizeCandidate(raw: any, fallbackTitle: string): Promise<RecognizeCandidate> {
  const mediaTypeRaw = raw?.media_type ?? raw?.mediaType ?? raw?.type;
  const mediaType = mediaTypeRaw === 'movie' ? 'movie' : 'tv';
  const imdbId = toStringOrNull(raw?.imdb_id ?? raw?.imdbId ?? raw?.imdbID ?? raw?.imdb);
  let tmdbId = toNumberOrNull(raw?.tmdb_id ?? raw?.tmdbId ?? raw?.tmdbID);
  let tmdbName = toStringOrNull(raw?.tmdb_name ?? raw?.tmdbName ?? raw?.name);
  const title = toStringOrNull(raw?.title) || tmdbName || fallbackTitle;

  if (imdbId) {
    const matched = await findByImdbId(imdbId, DEFAULT_LANGUAGE, mediaType);
    if (matched) {
      tmdbId = matched.id;
      tmdbName = matched.name || matched.title || tmdbName;
    }
  }

  return {
    title,
    media_type: mediaType,
    year: toNumberOrNull(raw?.year),
    season: toNumberOrNull(raw?.season),
    episode: toNumberOrNull(raw?.episode),
    imdb_id: imdbId,
    tmdb_id: tmdbId,
    tmdb_name: tmdbName,
    preferred_tmdb_id: toNumberOrNull(raw?.preferred_tmdb_id ?? raw?.preferredTmdbId) ?? tmdbId,
    candidates: Array.isArray(raw?.candidates) ? raw.candidates : undefined,
    confidence: typeof raw?.confidence === 'number' ? raw.confidence : 0,
    reason: typeof raw?.reason === 'string' ? raw.reason : '',
  };
}

function extractStreamingAnswer(text: string): string | null {
  const answerParts: string[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('data:')) continue;

    try {
      const data = JSON.parse(trimmed.slice(5).trim());
      if (data.event === 'message' && data.answer) {
        answerParts.push(data.answer);
      }
    } catch {}
  }

  if (answerParts.length === 0) return null;
  return answerParts.join('').trim();
}

function parseJsonFromAnswer<T>(answer: string): T | null {
  try {
    return JSON.parse(answer) as T;
  } catch {
    const left = answer.indexOf('{');
    const right = answer.lastIndexOf('}');
    if (left !== -1 && right !== -1 && right > left) {
      try {
        return JSON.parse(answer.slice(left, right + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

// 调用 Dify 路径识别工作流（完整流程：解析路径 + TMDB 搜索 + AI 匹配）
export async function recognizePath(filePath: string): Promise<PathRecognizeResult | null> {
  const payload = {
    inputs: {},
    query: filePath,
    response_mode: 'streaming',
    conversation_id: '',
    user: 'media-scraper-web',
  };

  try {
    const response = await fetch(DIFY_BASE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_PATH_RECOGNIZER_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('Path recognizer API error:', response.status, await response.text());
      return null;
    }

    const text = await response.text();

    const fullAnswer = extractStreamingAnswer(text);
    if (!fullAnswer) return null;

    console.log('[recognizePath] Full answer:', fullAnswer);

    const parsed = parseJsonFromAnswer<any>(fullAnswer);
    if (!parsed) {
      console.error('[recognizePath] Failed to parse JSON:', fullAnswer);
      return null;
    }

    const title = toStringOrNull(parsed.title ?? parsed.tmdb_name ?? parsed.tmdbName ?? parsed.name) || '';
    const recognizeCandidatesRaw = Array.isArray(parsed.recognize_candidates)
      ? parsed.recognize_candidates
      : Array.isArray(parsed.candidates)
        ? parsed.candidates.filter((item: any) => item && (item.media_type || item.mediaType || item.type || item.tmdb_id || item.imdb_id))
        : [];

    const normalizedCandidates = recognizeCandidatesRaw.length
      ? await Promise.all(recognizeCandidatesRaw.map((item: any) => normalizeRecognizeCandidate(item, title)))
      : [];

    const primaryCandidate = normalizedCandidates[0] || await normalizeRecognizeCandidate(parsed, title);
    const preferredTmdbId = toNumberOrNull(parsed.preferred_tmdb_id ?? parsed.preferredTmdbId)
      ?? primaryCandidate.preferred_tmdb_id
      ?? primaryCandidate.tmdb_id;

    const normalized: PathRecognizeResult = {
      path: parsed.path || filePath,
      title: primaryCandidate.title || title,
      media_type: primaryCandidate.media_type,
      year: primaryCandidate.year,
      season: primaryCandidate.season,
      episode: primaryCandidate.episode,
      imdb_id: primaryCandidate.imdb_id,
      tmdb_id: primaryCandidate.tmdb_id,
      tmdb_name: primaryCandidate.tmdb_name,
      preferred_tmdb_id: preferredTmdbId,
      recognize_candidates: normalizedCandidates.length ? normalizedCandidates : undefined,
      confidence: primaryCandidate.confidence,
      reason: primaryCandidate.reason,
    };

    return normalized;
  } catch (error) {
    console.error('Path recognizer call error:', error);
    return null;
  }
}
