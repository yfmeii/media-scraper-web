import { describe, expect, test } from 'bun:test';
import { CLIENT_API_ENDPOINTS, createClientApi } from './index';

describe('共享客户端 API 工厂', () => {
  test('createClientApi 复用搜索和处理逻辑', async () => {
    const calls: string[] = [];
    const api = createClientApi({
      async get<T = unknown>(path: string) {
        calls.push(`GET:${path}`);
        return { success: true, data: [] as unknown as T };
      },
      async post<T = unknown>(path: string, payload?: Record<string, unknown>) {
        calls.push(`POST:${path}`);
        if (path === CLIENT_API_ENDPOINTS.autoMatch) {
          return { success: true, data: { matched: false, candidates: [] } as unknown as T };
        }
        return { success: true, data: { message: String(payload && 'ok') } as unknown as T };
      },
    });

    await api.searchTMDB('tv', 'The Office', 2005);
    const result = await api.processMovie({ sourcePath: '/inbox/a.mkv', tmdbId: 1 });
    await api.fetchTVShowDetail('/tv/Andor');
    await api.fetchMovieDetail('/movie/Arrival');

    expect(calls[0]).toContain('/scrape/search/tv?q=The+Office&year=2005');
    expect(calls[2]).toBe('GET:/media/tv/detail?path=%2Ftv%2FAndor');
    expect(calls[3]).toBe('GET:/media/movies/detail?path=%2Fmovie%2FArrival');
    expect(result.success).toBe(true);
  });
});
