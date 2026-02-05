import { DIFY_PATH_RECOGNIZER_KEY, DIFY_BASE_URL } from './config';
import type { PathRecognizeResult } from '@media-scraper/shared';

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

    const parsed = parseJsonFromAnswer<PathRecognizeResult>(fullAnswer);
    if (!parsed) {
      console.error('[recognizePath] Failed to parse JSON:', fullAnswer);
      return null;
    }
    
    // Ensure path is set
    if (!parsed.path) {
      parsed.path = filePath;
    }
    
    return parsed;
  } catch (error) {
    console.error('Path recognizer call error:', error);
    return null;
  }
}
