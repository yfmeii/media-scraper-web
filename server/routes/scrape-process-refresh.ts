import type { Context } from 'hono';
import { parseRefreshBody } from './scrape-request';
import { badRequest } from './route-utils';
import { runRefresh } from './scrape-process-service';

export async function handleRefresh(c: Context) {
  const parsed = parseRefreshBody(await c.req.json());
  if (!parsed.ok) {
    return badRequest(c, parsed.error);
  }

  return c.json(await runRefresh(parsed.data));
}
