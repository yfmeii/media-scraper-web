import type { Context } from 'hono';
import { DEFAULT_LANGUAGE } from '@media-scraper/shared/constants';
import { generatePreviewPlan } from '../lib/scraper/preview';
import { parsePreviewItems, type ParseResult, type PreviewMovieItem, type PreviewTVItem } from './scrape-request';
import { buildPreviewResponse } from './scrape-response';
import { badRequest } from './route-utils';

type GeneratePreviewPlan = typeof generatePreviewPlan;

function parsePreviewBody(body: any): ParseResult<{
  items: Array<PreviewTVItem | PreviewMovieItem>;
  language: string;
}> {
  const { items, language = DEFAULT_LANGUAGE } = body;
  const parsedItems = parsePreviewItems(items);
  if (!parsedItems) {
    return { ok: false, error: 'Missing items array' };
  }

  return {
    ok: true,
    data: { items: parsedItems, language },
  };
}

export function createHandlePreview(deps: { generatePreviewPlan: GeneratePreviewPlan }) {
  return async function handlePreview(c: Context) {
    const parsed = parsePreviewBody(await c.req.json());
    if (!parsed.ok) {
      return badRequest(c, parsed.error);
    }

    const { items, language } = parsed.data;
    const plan = await deps.generatePreviewPlan(items, language);

    return c.json(buildPreviewResponse(plan));
  };
}

export const handlePreview = createHandlePreview({ generatePreviewPlan });
