import type { Context } from 'hono';
import { DEFAULT_LANGUAGE } from '@media-scraper/shared/constants';
import { recognizePath } from '../lib/dify';
import { enrichRecognizeCandidates } from './scrape-helpers';
import { parseRecognizeBody } from './scrape-request';
import { buildRecognizeResponse } from './scrape-response';
import { badRequest } from './route-utils';

export async function handleRecognize(c: Context) {
  const parsed = parseRecognizeBody(await c.req.json());
  if (!parsed.ok) {
    return badRequest(c, parsed.error);
  }

  const { filePath, language = DEFAULT_LANGUAGE } = parsed.data;

  console.log('[recognize] Input:', { filePath });

  const result = await recognizePath(filePath);

  if (!result) {
    return c.json({
      success: false,
      error: 'Path recognition failed',
    });
  }

  let candidates = [];
  let preferredTmdbId: number | null = result.tmdb_id;
  try {
    const enriched = await enrichRecognizeCandidates(result, language);
    candidates = enriched.candidates;
    preferredTmdbId = enriched.preferredTmdbId;
  } catch (error) {
    console.error('[recognize] Enrich candidates failed:', error);
  }

  console.log('[recognize] Result:', result);

  return c.json(buildRecognizeResponse({ result, candidates, preferredTmdbId }));
}
