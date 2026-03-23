import { describe, expect, test, afterEach } from 'bun:test';
import { recognizePath } from './dify';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('Dify 路径识别', () => {
  test('🧠 能解析 streaming JSON 返回结果', async () => {
    const payload = {
      title: 'Test Show',
      media_type: 'tv',
      year: 2020,
      season: 1,
      episode: 2,
      tmdb_id: 123,
      tmdb_name: 'Test Show',
      confidence: 0.9,
      reason: 'match',
    };
    const sse = `data: ${JSON.stringify({ event: 'message', answer: JSON.stringify(payload) })}\n\n`;

    globalThis.fetch = async () => new Response(sse, { status: 200 });

    const result = await recognizePath('/path/to/file.mkv');
    expect(result?.title).toBe('Test Show');
    expect(result?.tmdb_id).toBe(123);
    expect(result?.path).toBe('/path/to/file.mkv');
  });

  test('🧷 当返回缺少 path 时自动补齐', async () => {
    const payload = {
      title: 'Test Movie',
      media_type: 'movie',
      year: 2021,
      season: null,
      episode: null,
      tmdb_id: 321,
      tmdb_name: 'Test Movie',
      confidence: 0.8,
      reason: 'match',
    };
    const sse = `data: ${JSON.stringify({ event: 'message', answer: JSON.stringify(payload) })}\n\n`;

    globalThis.fetch = async () => new Response(sse, { status: 200 });

    const result = await recognizePath('/movie/file.mkv');
    expect(result?.path).toBe('/movie/file.mkv');
    expect(result?.media_type).toBe('movie');
  });

  test('🧩 能解析多个 AI 候选并保留首选信息', async () => {
    const payload = {
      title: 'Andor',
      recognize_candidates: [
        {
          title: 'Andor',
          media_type: 'tv',
          year: 2022,
          season: 1,
          episode: 1,
          tmdb_id: 83867,
          tmdb_name: 'Andor',
          confidence: 0.92,
          reason: 'exact folder match',
        },
        {
          title: 'Andorra',
          media_type: 'movie',
          year: 2024,
          season: null,
          episode: null,
          tmdb_id: 91919,
          tmdb_name: 'Andorra',
          confidence: 0.31,
          reason: 'title similarity',
        },
      ],
      preferred_tmdb_id: 83867,
    };
    const sse = `data: ${JSON.stringify({ event: 'message', answer: JSON.stringify(payload) })}\n\n`;

    globalThis.fetch = async () => new Response(sse, { status: 200 });

    const result = await recognizePath('/tv/Andor.S01E01.mkv');
    expect(result?.tmdb_id).toBe(83867);
    expect(result?.preferred_tmdb_id).toBe(83867);
    expect(result?.recognize_candidates).toHaveLength(2);
    expect(result?.recognize_candidates?.[1]?.tmdb_name).toBe('Andorra');
  });

  test('🚫 接口失败返回 null', async () => {
    globalThis.fetch = async () => new Response('error', { status: 500 });
    const result = await recognizePath('/bad/file.mkv');
    expect(result).toBeNull();
  });
});
