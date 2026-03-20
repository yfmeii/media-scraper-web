import type { Context } from 'hono';

export function badRequest(c: Context, error: string) {
  return c.json({ success: false, error }, 400);
}
