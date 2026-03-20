import type { Context } from 'hono';
import { MoveToInboxError, moveMediaToInbox } from '../lib/move-to-inbox';
import { invalidateMovedItemCache } from '../lib/library-cache-invalidation';

function parseMoveToInboxBody(body: any): { sourcePath: string | undefined } {
  return { sourcePath: body?.sourcePath };
}

export async function handleMoveToInbox(c: Context) {
  const { sourcePath } = parseMoveToInboxBody(await c.req.json());

  try {
    const result = await moveMediaToInbox(sourcePath);
    await invalidateMovedItemCache(sourcePath);
    return c.json(result);
  } catch (error: any) {
    console.error('[move-to-inbox] Error:', error);
    if (error instanceof MoveToInboxError) {
      return c.json({ success: false, error: error.message }, error.status);
    }
    return c.json({ success: false, error: error.message }, 500);
  }
}
