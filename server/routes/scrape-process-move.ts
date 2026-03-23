import type { Context } from 'hono';
import { MoveToInboxError, moveMediaToInbox } from '../lib/move-to-inbox';
import { invalidateMovedItemCache } from '../lib/library-cache-invalidation';

type MoveMediaToInbox = typeof moveMediaToInbox;
type InvalidateMovedItemCache = typeof invalidateMovedItemCache;
type MoveToInboxErrorClass = typeof MoveToInboxError;

function parseMoveToInboxBody(body: any): { sourcePath: string | undefined } {
  return { sourcePath: body?.sourcePath };
}

export function createHandleMoveToInbox(deps: {
  moveMediaToInbox: MoveMediaToInbox;
  invalidateMovedItemCache: InvalidateMovedItemCache;
  MoveToInboxError: MoveToInboxErrorClass;
}) {
  return async function handleMoveToInbox(c: Context) {
    const { sourcePath } = parseMoveToInboxBody(await c.req.json());

    try {
      const result = await deps.moveMediaToInbox(sourcePath);
      await deps.invalidateMovedItemCache(sourcePath);
      return c.json(result);
    } catch (error: any) {
      console.error('[move-to-inbox] Error:', error);
      if (error instanceof deps.MoveToInboxError) {
        return c.json({ success: false, error: error.message }, error.status);
      }
      return c.json({ success: false, error: error.message }, 500);
    }
  };
}

export const handleMoveToInbox = createHandleMoveToInbox({
  moveMediaToInbox,
  invalidateMovedItemCache,
  MoveToInboxError,
});
