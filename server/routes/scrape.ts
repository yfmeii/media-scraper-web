import { Hono } from 'hono';
import { handlePreview, handleProcessMovie, handleProcessTV, handleRefresh, handleMoveToInbox } from './scrape-process';
import { handleRecognize } from './scrape-recognize';
import { handleMatch, handleSearch, handleSearchByImdb } from './scrape-search';

export const scrapeRoutes = new Hono();

// Search TMDB
scrapeRoutes.get('/search/tv', (c) => handleSearch(c, 'tv'));
scrapeRoutes.get('/search/movie', (c) => handleSearch(c, 'movie'));
scrapeRoutes.get('/search/multi', (c) => handleSearch(c, 'multi'));
scrapeRoutes.get('/search/imdb', handleSearchByImdb);

// AI 路径识别 - 使用 Dify 完整工作流（解析路径 + TMDB 搜索 + AI 匹配）
scrapeRoutes.post('/recognize', handleRecognize);

// Auto-match a file
scrapeRoutes.post('/match', handleMatch);

// Process TV show (move and scrape)
scrapeRoutes.post('/process/tv', handleProcessTV);

// Process movie (move and scrape)
scrapeRoutes.post('/process/movie', handleProcessMovie);

// Move file back to inbox
scrapeRoutes.post('/move-to-inbox', handleMoveToInbox);

// Refresh metadata only
scrapeRoutes.post('/refresh', handleRefresh);

// 预览清单 API - 返回移动/覆盖预览
scrapeRoutes.post('/preview', handlePreview);
