import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun';
import { streamSSE } from 'hono/streaming';
import { mediaRoutes } from './routes/media';
import { scrapeRoutes } from './routes/scrape';
import { taskRoutes } from './routes/tasks';
import { progressEmitter, type ProgressEvent } from './lib/progress';

const app = new Hono();

// CORS for development
app.use('*', cors());

// API routes
app.route('/api/media', mediaRoutes);
app.route('/api/scrape', scrapeRoutes);
app.route('/api/tasks', taskRoutes);

// SSE endpoint for progress updates
app.get('/api/progress', async (c) => {
  return streamSSE(c, async (stream) => {
    const unsubscribe = progressEmitter.subscribe((event: ProgressEvent) => {
      stream.writeSSE({
        data: JSON.stringify(event),
        event: 'progress',
      });
    });
    
    // Keep connection alive
    const keepAlive = setInterval(() => {
      stream.writeSSE({ data: 'ping', event: 'ping' });
    }, 30000);
    
    // Handle disconnection
    stream.onAbort(() => {
      unsubscribe();
      clearInterval(keepAlive);
    });
    
    // Wait for client disconnect
    await new Promise(() => {});
  });
});

// Serve frontend static files
app.use('/*', serveStatic({ root: './public' }));

// SPA fallback - serve index.html for non-API routes
app.get('*', async (c) => {
  const path = c.req.path;
  // Skip API routes
  if (path.startsWith('/api')) {
    return c.notFound();
  }
  // Serve index.html for SPA routing
  return c.html(await Bun.file('./public/index.html').text());
});

const port = process.env.PORT || 3000;
console.log(`🎬 媒体刮削服务运行在 http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
