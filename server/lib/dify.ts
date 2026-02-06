import { DEFAULT_LANGUAGE, type PathRecognizeResult } from '@media-scraper/shared';
import { DIFY_PATH_RECOGNIZER_KEY, DIFY_BASE_URL } from './config';
import { findByImdbId } from './tmdb';

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

    const mediaTypeRaw = parsed.media_type ?? parsed.mediaType ?? parsed.type;
    const mediaType = mediaTypeRaw === 'movie' ? 'movie' : 'tv';
    const imdbRaw = parsed.imdb_id ?? parsed.imdbId ?? parsed.imdbID ?? parsed.imdb ?? null;
    const imdbId = typeof imdbRaw === 'string' ? imdbRaw.trim() : null;
    let tmdbId = parsed.tmdb_id ?? parsed.tmdbId ?? parsed.tmdbID ?? null;
    let tmdbName = parsed.tmdb_name ?? parsed.tmdbName ?? parsed.name ?? null;
    const title = parsed.title ?? tmdbName ?? parsed.name ?? '';

    // Prefer exact TMDB mapping resolved from IMDb ID when available.
    if (imdbId) {
      const matched = await findByImdbId(imdbId, DEFAULT_LANGUAGE, mediaType);
      if (matched) {
        tmdbId = matched.id;
        tmdbName = matched.name || matched.title || tmdbName;
      }
    }

    const normalized: PathRecognizeResult = {
      path: parsed.path || filePath,
      title,
      media_type: mediaType,
      year: parsed.year ?? null,
      season: parsed.season ?? null,
      episode: parsed.episode ?? null,
      imdb_id: imdbId || null,
      tmdb_id: tmdbId,
      tmdb_name: tmdbName,
      confidence: parsed.confidence ?? 0,
      reason: parsed.reason ?? '',
    };

    return normalized;
  } catch (error) {
    console.error('Path recognizer call error:', error);
    return null;
  }
}
