import { Hono } from 'hono';
import { 
  scanTVShows, 
  scanMovies, 
  scanInbox, 
  scanInboxByDirectory, 
  scanTVShowsWithAssets,
  scanMoviesWithAssets,
  type ShowInfo, 
  type MovieInfo, 
  type MediaFile,
  type DirectoryGroup 
} from '../lib/scanner';
import { MEDIA_PATHS } from '../lib/config';

export const mediaRoutes = new Hono();

// Get all TV shows
// ?include=assets 返回资产完整性标记
// ?group=status 返回分组统计
mediaRoutes.get('/tv', async (c) => {
  const includeAssets = c.req.query('include') === 'assets';
  const group = c.req.query('group');
  
  const shows = includeAssets 
    ? await scanTVShowsWithAssets(MEDIA_PATHS.tv)
    : await scanTVShows(MEDIA_PATHS.tv);
  
  // 分组统计
  let groups: { scraped: number; unscraped: number; supplement: number } | undefined;
  if (group === 'status' && includeAssets) {
    const showsWithAssets = shows as (ShowInfo & { groupStatus?: string; supplementCount?: number })[];
    groups = {
      scraped: showsWithAssets.filter(s => s.groupStatus === 'scraped').length,
      unscraped: showsWithAssets.filter(s => s.groupStatus === 'unscraped').length,
      supplement: showsWithAssets.filter(s => s.groupStatus === 'supplement').length,
    };
  }
  
  return c.json({
    success: true,
    data: shows,
    total: shows.length,
    groups,
  });
});

// Get all movies
// ?include=assets 返回资产完整性标记
mediaRoutes.get('/movies', async (c) => {
  const includeAssets = c.req.query('include') === 'assets';
  
  const movies = includeAssets
    ? await scanMoviesWithAssets(MEDIA_PATHS.movies)
    : await scanMovies(MEDIA_PATHS.movies);
  
  return c.json({
    success: true,
    data: movies,
    total: movies.length,
  });
});

// Get inbox (unorganized) files
// ?view=dir 返回目录分组结构
mediaRoutes.get('/inbox', async (c) => {
  const view = c.req.query('view');
  
  if (view === 'dir') {
    const directories = await scanInboxByDirectory(MEDIA_PATHS.inbox);
    return c.json({
      success: true,
      data: directories,
      total: directories.reduce((sum, d) => sum + d.files.length, 0),
      directories: directories.length,
    });
  }
  
  const files = await scanInbox(MEDIA_PATHS.inbox);
  return c.json({
    success: true,
    data: files,
    total: files.length,
  });
});

// Get statistics
mediaRoutes.get('/stats', async (c) => {
  const [shows, movies, inbox] = await Promise.all([
    scanTVShows(MEDIA_PATHS.tv),
    scanMovies(MEDIA_PATHS.movies),
    scanInbox(MEDIA_PATHS.inbox),
  ]);
  
  const tvEpisodes = shows.reduce((sum, show) => 
    sum + show.seasons.reduce((sSum, season) => sSum + season.episodes.length, 0), 0);
  
  const processedTV = shows.filter(s => s.isProcessed).length;
  const processedMovies = movies.filter(m => m.isProcessed).length;
  
  return c.json({
    success: true,
    data: {
      tvShows: shows.length,
      tvEpisodes,
      tvProcessed: processedTV,
      movies: movies.length,
      moviesProcessed: processedMovies,
      inbox: inbox.length,
    },
  });
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
