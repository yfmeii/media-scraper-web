import { DIFY_API_KEY, DIFY_URL } from './config';

export interface AIDecision {
  path: string;
  chosen_id: number | null;
  confidence: number;
  reason: string;
}

export interface AIRequest {
  path: string;
  evidence: {
    title_candidate: string;
    year?: number;
    season?: number;
    episodes?: number[];
  };
  candidates: {
    id: number;
    name?: string;
    title?: string;
    first_air_date?: string;
    release_date?: string;
    overview: string;
  }[];
}

export async function callDify(items: AIRequest[]): Promise<AIDecision[]> {
  const query = JSON.stringify({ items });
  
  const payload = {
    inputs: {},
    query,
    response_mode: 'streaming',
    conversation_id: '',
    user: 'media-scraper-web',
  };

  try {
    const response = await fetch(DIFY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('Dify API error:', response.status, await response.text());
      return [];
    }

    const text = await response.text();
    
    // Parse SSE response
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
    
    if (answerParts.length === 0) return [];
    
    const fullAnswer = answerParts.join('').trim();
    
    // Parse JSON from answer
    let parsed: { results?: AIDecision[] };
    try {
      parsed = JSON.parse(fullAnswer);
    } catch {
      const left = fullAnswer.indexOf('{');
      const right = fullAnswer.lastIndexOf('}');
      if (left !== -1 && right !== -1 && right > left) {
        parsed = JSON.parse(fullAnswer.slice(left, right + 1));
      } else {
        return [];
      }
    }
    
    return parsed.results || [];
  } catch (error) {
    console.error('Dify call error:', error);
    return [];
  }
}

// Request AI decision for ambiguous matches
export async function resolveAmbiguous(
  path: string,
  title: string,
  year: number | undefined,
  season: number | undefined,
  episodes: number[] | undefined,
  candidates: { id: number; name?: string; title?: string; first_air_date?: string; release_date?: string; overview: string }[]
): Promise<AIDecision | null> {
  const results = await callDify([{
    path,
    evidence: {
      title_candidate: title,
      year,
      season,
      episodes,
    },
    candidates,
  }]);
  
  if (results.length === 0) return null;
  
  const result = results[0];
  // Fix path if it's a placeholder
  if (!result.path || result.path.includes('relative') || result.path.includes('absolute')) {
    result.path = path;
  }
  
  return result;
}
