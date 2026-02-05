import { Hono } from 'hono';
import { DEFAULT_LANGUAGE } from '@media-scraper/shared';
import { searchTV, searchMovie, findBestMatch, getTVDetails, getMovieDetails, getPosterUrl } from '../lib/tmdb';
import { recognizePath } from '../lib/dify';
import { processTVShow, processMovie, refreshMetadata, supplementTVShow, fixMissingAssets, generatePreviewPlan } from '../lib/scraper';
import { parseFilename, detectSupplementFiles, extractTmdbIdFromNfo } from '../lib/scanner';
import { createTask, updateTask, addTaskLog, startTask, completeTask, calculateBatchProgress, type ScrapePlan } from '../lib/tasks';
import { MEDIA_PATHS } from '../lib/config';
import { join } from 'path';
import { emitProgress } from '../lib/progress';

export const scrapeRoutes = new Hono();

// Search TMDB for TV shows
scrapeRoutes.get('/search/tv', async (c) => {
  const query = c.req.query('q');
  const year = c.req.query('year');
  const language = c.req.query('language') || DEFAULT_LANGUAGE;
  
  if (!query) {
    return c.json({ success: false, error: 'Missing query parameter' }, 400);
  }
  
  const results = await searchTV(query, year ? parseInt(year) : undefined, language);
  return c.json({
    success: true,
    data: results.slice(0, 10).map(r => ({
      id: r.id,
      name: r.name,
      originalName: r.original_name,
      overview: r.overview?.slice(0, 200),
      firstAirDate: r.first_air_date,
      voteAverage: r.vote_average,
      posterPath: getPosterUrl(r.poster_path, 'w185'),
    })),
  });
});

// Search TMDB for movies
scrapeRoutes.get('/search/movie', async (c) => {
  const query = c.req.query('q');
  const year = c.req.query('year');
  const language = c.req.query('language') || DEFAULT_LANGUAGE;
  
  if (!query) {
    return c.json({ success: false, error: 'Missing query parameter' }, 400);
  }
  
  const results = await searchMovie(query, year ? parseInt(year) : undefined, language);
  return c.json({
    success: true,
    data: results.slice(0, 10).map(r => ({
      id: r.id,
      title: r.title,
      originalTitle: r.original_title,
      overview: r.overview?.slice(0, 200),
      releaseDate: r.release_date,
      voteAverage: r.vote_average,
      posterPath: getPosterUrl(r.poster_path, 'w185'),
    })),
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
  const { path, kind, title, year, language = DEFAULT_LANGUAGE } = body;
  
  if (!path || !kind) {
    return c.json({ success: false, error: 'Missing path or kind' }, 400);
  }
  
  // Parse filename if title not provided
  const parsed = parseFilename(path.split('/').pop() || '');
  const searchTitle = title || parsed.title;
  const searchYear = year || parsed.year;
  
  if (!searchTitle) {
    return c.json({ success: false, error: 'Could not determine title' }, 400);
  }
  
  const match = await findBestMatch(kind, searchTitle, searchYear, language);
  
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
        originalName: match.result.original_name || match.result.original_title,
        date: match.result.first_air_date || match.result.release_date,
        posterPath: getPosterUrl(match.result.poster_path, 'w185'),
        score: match.score,
      },
      candidates: match.candidates.slice(0, 5).map(r => ({
        id: r.id,
        name: r.name || r.title,
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
    for (const subExt of ['.srt', '.ass', '.ssa', '.sub']) {
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

// Batch process multiple items
scrapeRoutes.post('/batch', async (c) => {
  const body = await c.req.json();
  const { items, language = DEFAULT_LANGUAGE } = body;
  
  if (!items || !Array.isArray(items)) {
    return c.json({ success: false, error: 'Missing items array' }, 400);
  }
  
  // 创建批量任务
  const batchTask = createTask('process', `Batch processing ${items.length} items`);
  startTask(batchTask.id);
  addTaskLog(batchTask.id, `Starting batch process with ${items.length} items`);
  
  // Emit SSE start event
  emitProgress(batchTask.id, 'start', 0, items.length, undefined, `开始处理 ${items.length} 个项目`);
  
  const results: Array<Record<string, unknown>> = [];
  let completed = 0;
  let failed = 0;
  let processedCount = 0;
  
  for (const item of items) {
    try {
      addTaskLog(batchTask.id, `Processing: ${item.sourcePath}`);
      
      // Emit SSE progress event
      emitProgress(batchTask.id, 'progress', processedCount, items.length, item.sourcePath, `处理中: ${item.sourcePath}`);
      
      if (!item.tmdbId) {
        addTaskLog(batchTask.id, `No TMDB ID for ${item.sourcePath}, skipping`);
        failed++;
        results.push({ ...item, success: false, message: 'No TMDB ID provided' });
        continue;
      }
      
      if (item.kind === 'tv') {
        // Check if already in TV directory (refresh) or in Inbox (process)
        if (item.sourcePath.startsWith(MEDIA_PATHS.tv)) {
          // Already in TV directory, just refresh metadata
          const result = await refreshMetadata('tv', item.sourcePath, item.tmdbId, undefined, undefined, language);
          results.push({ ...item, ...result });
          if (result.success) completed++;
          else failed++;
        } else {
          // In Inbox, process (move + scrape)
          const result = await processTVShow(
            item.sourcePath,
            item.showName,
            item.tmdbId,
            item.season,
            item.episodes,
            language
          );
          results.push({ ...item, ...result });
          if (result.success) completed++;
          else failed++;
        }
      } else if (item.kind === 'movie') {
        // Check if already in Movies directory (refresh) or in Inbox (process)
        if (item.sourcePath.startsWith(MEDIA_PATHS.movies)) {
          // Already in Movies directory, just refresh metadata
          const result = await refreshMetadata('movie', item.sourcePath, item.tmdbId, undefined, undefined, language);
          results.push({ ...item, ...result });
          if (result.success) completed++;
          else failed++;
        } else {
          // In Inbox, process (move + scrape)
          const result = await processMovie(item.sourcePath, item.tmdbId, language);
          results.push({ ...item, ...result });
          if (result.success) completed++;
          else failed++;
        }
      }
      
      // 更新进度
      processedCount++;
      const progress = calculateBatchProgress(completed, failed, items.length);
      updateTask(batchTask.id, { progress: progress.percent });
      
      // Emit SSE progress event
      emitProgress(batchTask.id, 'progress', processedCount, items.length, item.sourcePath, `完成: ${item.sourcePath}`);
      
      // Small delay between items
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      addTaskLog(batchTask.id, `Error processing ${item.sourcePath}: ${error}`);
      failed++;
      processedCount++;
      results.push({ ...item, success: false, message: String(error) });
      
      // Emit SSE error event
      emitProgress(batchTask.id, 'error', processedCount, items.length, item.sourcePath, `错误: ${error}`);
    }
  }
  
  completeTask(batchTask.id, failed < items.length, `Completed: ${completed}, Failed: ${failed}`);
  
  // Emit SSE complete event
  emitProgress(batchTask.id, 'complete', items.length, items.length, undefined, `完成: ${completed} 成功, ${failed} 失败`);
  
  return c.json({
    success: true,
    data: results,
    processed: completed,
    failed: failed,
    taskId: batchTask.id,
  });
});

// 补刮 API - 处理已刮削目录中的新文件
scrapeRoutes.post('/supplement', async (c) => {
  const body = await c.req.json();
  const { showPath, language = DEFAULT_LANGUAGE } = body;
  
  if (!showPath) {
    return c.json({ success: false, error: 'Missing showPath' }, 400);
  }
  
  // 安全检查
  const fullPath = showPath.startsWith(MEDIA_PATHS.tv) ? showPath : join(MEDIA_PATHS.tv, showPath);
  if (!fullPath.startsWith(MEDIA_PATHS.tv)) {
    return c.json({ success: false, error: 'Invalid path' }, 403);
  }
  
  // 创建任务
  const task = createTask('supplement', showPath);
  startTask(task.id);
  
  try {
    const result = await supplementTVShow(fullPath, language);
    completeTask(task.id, result.success, result.message);
    
    return c.json({
      success: result.success,
      data: result,
      taskId: task.id,
    });
  } catch (error) {
    completeTask(task.id, false, String(error));
    return c.json({ success: false, error: String(error), taskId: task.id }, 500);
  }
});

// 修复缺失资产 API
scrapeRoutes.post('/fix-assets', async (c) => {
  const body = await c.req.json();
  const { kind, path, tmdbId, language = DEFAULT_LANGUAGE } = body;
  
  if (!kind || !path || !tmdbId) {
    return c.json({ success: false, error: 'Missing required parameters' }, 400);
  }
  
  // 安全检查
  const allowedPaths = [MEDIA_PATHS.tv, MEDIA_PATHS.movies];
  const isAllowed = allowedPaths.some(p => path.startsWith(p));
  if (!isAllowed) {
    return c.json({ success: false, error: 'Invalid path' }, 403);
  }
  
  // 创建任务
  const task = createTask('fix-assets', path);
  startTask(task.id);
  
  try {
    const result = await fixMissingAssets(kind, path, tmdbId, language);
    completeTask(task.id, result.success, result.message);
    
    return c.json({
      success: result.success,
      data: result,
      taskId: task.id,
    });
  } catch (error) {
    completeTask(task.id, false, String(error));
    return c.json({ success: false, error: String(error), taskId: task.id }, 500);
  }
});
