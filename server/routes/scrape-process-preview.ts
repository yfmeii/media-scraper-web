import type { Context } from 'hono';
import { generatePreviewPlan } from '../lib/scraper/preview';
import { parsePreviewBody } from './scrape-request';
import { buildPreviewResponse } from './scrape-response';
import { badRequest } from './route-utils';

export async function handlePreview(c: Context) {
  const parsed = parsePreviewBody(await c.req.json());
  if (!parsed.ok) {
    return badRequest(c, parsed.error);
  }

  const { items, language } = parsed.data;
  const plan = await generatePreviewPlan(items, language);

  return c.json(buildPreviewResponse(plan));
}
