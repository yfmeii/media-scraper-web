import type { Context } from 'hono';
import { parseProcessMovieBody, parseProcessTVBody } from './scrape-request';
import { badRequest } from './route-utils';
import { runProcessMovie, runProcessTV } from './scrape-process-service';

export async function handleProcessTV(c: Context) {
  const parsed = parseProcessTVBody(await c.req.json());
  if (!parsed.ok) {
    return badRequest(c, parsed.error);
  }

  return c.json(await runProcessTV(parsed.data));
}

export async function handleProcessMovie(c: Context) {
  const parsed = parseProcessMovieBody(await c.req.json());
  if (!parsed.ok) {
    return badRequest(c, parsed.error);
  }

  return c.json(await runProcessMovie(parsed.data));
}
