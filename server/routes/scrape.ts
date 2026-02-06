import { Hono, type Context } from 'hono';
import { DEFAULT_LANGUAGE, SUB_EXTS } from '@media-scraper/shared';
import { searchTV, searchMovie, searchMulti, findByImdbId, findBestMatch, findBestMatchMixed, getPosterUrl, type TMDBSearchResult } from '../lib/tmdb';
import { recognizePath } from '../lib/dify';
import { processTVShow, processMovie, refreshMetadata, generatePreviewPlan } from '../lib/scraper';
import { parseFilename } from '../lib/scanner';
import { MEDIA_PATHS } from '../lib/config';

export const scrapeRoutes = new Hono();

type SearchKind = 'tv' | 'movie' | 'multi';

function mapSearchResult(kind: SearchKind, result: TMDBSearchResult) {
  const mediaType = result.media_type === 'tv' || result.media_type === 'movie'
    ? result.media_type
    : (kind === 'tv' ? 'tv' : 'movie');

  if (mediaType === 'tv') {
    return {
      id: result.id,
      mediaType: 'tv' as const,
      name: result.name,
      originalName: result.original_name,
      overview: result.overview?.slice(0, 200),
      firstAirDate: result.first_air_date,
      voteAverage: result.vote_average,
      posterPath: getPosterUrl(result.poster_path, 'w185'),
    };
  }

  return {
    id: result.id,
    mediaType: 'movie' as const,
    title: result.title,
    originalTitle: result.original_title,
    overview: result.overview?.slice(0, 200),
    releaseDate: result.release_date,
    voteAverage: result.vote_average,
    posterPath: getPosterUrl(result.poster_path, 'w185'),
  };
}

async function handleSearch(c: Context, kind: SearchKind) {
  const query = c.req.query('q');
  const year = c.req.query('year');
  const language = c.req.query('language') || DEFAULT_LANGUAGE;

  if (!query) {
    return c.json({ success: false, error: 'Missing query parameter' }, 400);
  }

  const parsedYear = year ? parseInt(year, 10) : undefined;
  const results = kind === 'tv'
    ? await searchTV(query, parsedYear, language)
    : kind === 'movie'
      ? await searchMovie(query, parsedYear, language)
      : await searchMulti(query, parsedYear, language);

  return c.json({
    success: true,
    data: results.slice(0, 10).map(result => mapSearchResult(kind, result)),
  });
}

// Search TMDB
scrapeRoutes.get('/search/tv', async c => handleSearch(c, 'tv'));
scrapeRoutes.get('/search/movie', async c => handleSearch(c, 'movie'));
scrapeRoutes.get('/search/multi', async c => handleSearch(c, 'multi'));
scrapeRoutes.get('/search/imdb', async (c) => {
  const imdbId = c.req.query('imdb_id') || c.req.query('id');
  const language = c.req.query('language') || DEFAULT_LANGUAGE;

  if (!imdbId) {
    return c.json({ success: false, error: 'Missing imdb_id parameter' }, 400);
  }

  const matched = await findByImdbId(imdbId, language);
  return c.json({
    success: true,
    data: matched ? [mapSearchResult('multi', matched)] : [],
  });
});

// AI 路径识别 - 使用 Dify 完整工作流（解析路径 + TMDB 搜索 + AI 匹配）
scrapeRoutes.post('/recognize', async (c) => {
  const body = await c.req.json();
  const { path: filePath } = body;
  
  if (!filePath) {
    return c.json({ success: false, error: 'Missing path' }, 400);
  }
  
  console.log('[recognize] Input:', { filePath });
  
  // 直接调用 Dify 完整工作流
  const result = await recognizePath(filePath);
  
  if (!result) {
    return c.json({
      success: false,
      error: 'Path recognition failed',
    });
  }
  
  console.log('[recognize] Result:', result);
  
  return c.json({
    success: true,
    data: result,
  });
});

// Auto-match a file
scrapeRoutes.post('/match', async (c) => {
  const body = await c.req.json();
  const { path, kind: inputKind, title, year, language = DEFAULT_LANGUAGE } = body;
  const kind: 'tv' | 'movie' | undefined = inputKind === 'tv' || inputKind === 'movie' ? inputKind : undefined;
  
  if (!path) {
    return c.json({ success: false, error: 'Missing path' }, 400);
  }
  
  // Parse filename if title not provided
  const parsed = parseFilename(path.split('/').pop() || '');
  const searchTitle = title || parsed.title;
  const searchYear = year || parsed.year;
  
  if (!searchTitle) {
    return c.json({ success: false, error: 'Could not determine title' }, 400);
  }
  
  const match = kind
    ? await findBestMatch(kind, searchTitle, searchYear, language)
    : await findBestMatchMixed(searchTitle, searchYear, language);
  
  if (!match) {
    return c.json({
      success: true,
      data: {
        matched: false,
        title: searchTitle,
        year: searchYear,
        candidates: [],
      },
    });
  }
  
  const isAmbiguous = match.score < 0.5 || (match.candidates.length > 1 && 
    match.candidates[1] && (match.score - (match.candidates[1] as any).score) < 0.1);
  
  return c.json({
    success: true,
    data: {
      matched: !isAmbiguous,
      result: {
        id: match.result.id,
        name: match.result.name || match.result.title,
        mediaType: match.result.media_type || kind || 'movie',
        originalName: match.result.original_name || match.result.original_title,
        date: match.result.first_air_date || match.result.release_date,
        posterPath: getPosterUrl(match.result.poster_path, 'w185'),
        score: match.score,
      },
      candidates: match.candidates.slice(0, 5).map(r => ({
        id: r.id,
        name: r.name || r.title,
        mediaType: r.media_type || kind || 'movie',
        originalName: r.original_name || r.original_title,
        date: r.first_air_date || r.release_date,
        posterPath: getPosterUrl(r.poster_path, 'w185'),
        overview: r.overview?.slice(0, 150),
      })),
      ambiguous: isAmbiguous,
    },
  });
});

// Process TV show (move and scrape)
scrapeRoutes.post('/process/tv', async (c) => {
  const body = await c.req.json();
  const { sourcePath, showName, tmdbId, season, episodes, language = DEFAULT_LANGUAGE } = body;
  
  if (!sourcePath || !showName || !tmdbId || !season || !episodes) {
    return c.json({ success: false, error: 'Missing required parameters' }, 400);
  }
  
  const result = await processTVShow(sourcePath, showName, tmdbId, season, episodes, language);
  return c.json(result);
});

// Process movie (move and scrape)
scrapeRoutes.post('/process/movie', async (c) => {
  const body = await c.req.json();
  const { sourcePath, tmdbId, language = DEFAULT_LANGUAGE } = body;
  
  if (!sourcePath || !tmdbId) {
    return c.json({ success: false, error: 'Missing required parameters' }, 400);
  }
  
  const result = await processMovie(sourcePath, tmdbId, language);
  return c.json(result);
});

// Move file back to inbox
scrapeRoutes.post('/move-to-inbox', async (c) => {
  const { rename, unlink } = await import('fs/promises');
  const { basename, dirname, join: pathJoin } = await import('path');
  
  const body = await c.req.json();
  const { sourcePath } = body;
  
  if (!sourcePath) {
    return c.json({ success: false, error: 'Missing sourcePath parameter' }, 400);
  }
  
  // Verify file is in TV or Movies directory
  const isInLibrary = sourcePath.startsWith(MEDIA_PATHS.tv) || sourcePath.startsWith(MEDIA_PATHS.movies);
  if (!isInLibrary) {
    return c.json({ success: false, error: 'File is not in library (TV/Movies)' }, 400);
  }
  
  try {
    const fileName = basename(sourcePath);
    const destPath = pathJoin(MEDIA_PATHS.inbox, fileName);
    
    await rename(sourcePath, destPath);
    
    const srcDir = dirname(sourcePath);
    const srcName = basename(sourcePath, basename(sourcePath).match(/\.[^.]+$/)?.[0] || '');
    
    // Move subtitle files
    for (const subExt of SUB_EXTS) {
      try {
        const subSrc = pathJoin(srcDir, srcName + subExt);
        const subDest = pathJoin(MEDIA_PATHS.inbox, srcName + subExt);
        await rename(subSrc, subDest);
      } catch {} // Ignore if subtitle doesn't exist
    }
    
    // DELETE (not move) NFO file - it's generated metadata, not user content
    try {
      const nfoPath = pathJoin(srcDir, srcName + '.nfo');
      await unlink(nfoPath);
    } catch {} // Ignore if NFO doesn't exist
    
    return c.json({ 
      success: true, 
      message: `Moved to inbox: ${fileName}`,
      destPath,
    });
  } catch (error: any) {
    console.error('[move-to-inbox] Error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Refresh metadata only
scrapeRoutes.post('/refresh', async (c) => {
  const body = await c.req.json();
  const { kind, path, tmdbId, season, episode, language = DEFAULT_LANGUAGE } = body;
  
  console.log('[refresh] Request:', { kind, path, tmdbId, season, episode, language });
  
  if (!kind || !path || !tmdbId) {
    console.log('[refresh] Missing required parameters');
    return c.json({ success: false, error: 'Missing required parameters' }, 400);
  }
  
  const result = await refreshMetadata(kind, path, tmdbId, season, episode, language);
  console.log('[refresh] Result:', result);
  return c.json(result);
});

// 预览清单 API - 返回移动/覆盖预览
scrapeRoutes.post('/preview', async (c) => {
  const body = await c.req.json();
  const { items, language = DEFAULT_LANGUAGE } = body;
  
  if (!items || !Array.isArray(items)) {
    return c.json({ success: false, error: 'Missing items array' }, 400);
  }
  
  const plan = await generatePreviewPlan(items, language);
  
  return c.json({
    success: true,
    data: plan,
  });
});
