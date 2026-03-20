import { Hono } from 'hono';
import type { DirectoryGroup, MediaFile, MovieInfo, ShowInfo } from '@media-scraper/shared/types';
import { scanInbox, scanInboxByDirectory } from '../lib/scanner-files';
import { scanMovies, scanMoviesWithAssets, scanTVShows, scanTVShowsWithAssets } from '../lib/scanner-library';
import { MEDIA_PATHS } from '../lib/config';
import { buildCollectionResponse, buildDetailResponse, buildInboxDirectoryResponse, buildStatsResponse, buildStatusGroups } from './media-response';
import { badRequest } from './route-utils';

export const mediaRoutes = new Hono();

// Get all TV shows
// ?include=assets 返回资产完整性标记
// ?group=status 返回分组统计
mediaRoutes.get('/tv', async (c) => {
  const includeAssets = c.req.query('include') === 'assets';
  const group = c.req.query('group');
  const detail = c.req.query('detail') === 'full' ? 'full' : 'summary';
  
  const shows = includeAssets 
    ? await scanTVShowsWithAssets(MEDIA_PATHS.tv, detail)
    : await scanTVShows(MEDIA_PATHS.tv);
  
  const groups = group === 'status' && includeAssets
    ? buildStatusGroups(shows as (ShowInfo & { groupStatus?: string })[])
    : undefined;

  return c.json(buildCollectionResponse(shows, groups));
});

mediaRoutes.get('/tv/detail', async (c) => {
  const path = c.req.query('path');
  if (!path) return badRequest(c, 'Missing path');

  const shows = await scanTVShowsWithAssets(MEDIA_PATHS.tv, 'full');
  const show = shows.find(item => item.path === path);
  if (!show) return c.json({ success: false, error: 'Show not found' }, 404);

  return c.json(buildDetailResponse(show));
});

// Get all movies
// ?include=assets 返回资产完整性标记
mediaRoutes.get('/movies', async (c) => {
  const includeAssets = c.req.query('include') === 'assets';
  const detail = c.req.query('detail') === 'full' ? 'full' : 'summary';
  
  const movies = includeAssets
    ? await scanMoviesWithAssets(MEDIA_PATHS.movies, detail)
    : await scanMovies(MEDIA_PATHS.movies);
  
  return c.json(buildCollectionResponse(movies));
});

mediaRoutes.get('/movies/detail', async (c) => {
  const path = c.req.query('path');
  if (!path) return badRequest(c, 'Missing path');

  const movies = await scanMoviesWithAssets(MEDIA_PATHS.movies, 'full');
  const movie = movies.find(item => item.path === path);
  if (!movie) return c.json({ success: false, error: 'Movie not found' }, 404);

  return c.json(buildDetailResponse(movie));
});

// Get inbox (unorganized) files
// ?view=dir 返回目录分组结构
mediaRoutes.get('/inbox', async (c) => {
  const view = c.req.query('view');
  
  if (view === 'dir') {
    const directories = await scanInboxByDirectory(MEDIA_PATHS.inbox);
    return c.json(buildInboxDirectoryResponse(directories));
  }
  
  const files = await scanInbox(MEDIA_PATHS.inbox);
  return c.json(buildCollectionResponse(files));
});

// Get statistics
mediaRoutes.get('/stats', async (c) => {
  const [shows, movies, inbox] = await Promise.all([
    scanTVShowsWithAssets(MEDIA_PATHS.tv, 'summary'),
    scanMoviesWithAssets(MEDIA_PATHS.movies, 'summary'),
    scanInbox(MEDIA_PATHS.inbox),
  ]);
  
  return c.json(buildStatsResponse(shows, movies, inbox));
});

// Serve poster images
mediaRoutes.get('/poster', async (c) => {
  const path = c.req.query('path');
  if (!path) {
    return c.text('Missing path', 400);
  }
  
  try {
    // Security check - only allow files in media directories
    const resolved = await Bun.file(path).exists();
    if (!resolved) {
      return c.text('File not found', 404);
    }
    
    // Check if path is within allowed directories
    const isAllowed = [MEDIA_PATHS.tv, MEDIA_PATHS.movies, MEDIA_PATHS.inbox].some(
      allowed => path.startsWith(allowed)
    );
    if (!isAllowed) {
      return c.text('Access denied', 403);
    }
    
    const file = Bun.file(path);
    const contentType = path.endsWith('.png') ? 'image/png' : 'image/jpeg';
    
    return new Response(file, {
      headers: { 'Content-Type': contentType },
    });
  } catch {
    return c.text('Error reading file', 500);
  }
});
