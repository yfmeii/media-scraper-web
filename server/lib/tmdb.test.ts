import { describe, expect, test, afterEach } from 'bun:test';
import { calculateScore, getPosterUrl, getBackdropUrl, getSeasonDetails, type TMDBSearchResult } from './tmdb';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('TMDB 工具函数', () => {
  test('🎯 精确标题匹配得分更高', () => {
    const result: TMDBSearchResult = {
      id: 1,
      name: 'Breaking Bad',
      overview: '',
      vote_average: 8.5,
      first_air_date: '2008-01-20',
    };

    const score = calculateScore('Breaking Bad', 2008, result);
    expect(score).toBeGreaterThan(0.7);
  });

  test('📅 年份匹配提高得分', () => {
    const result: TMDBSearchResult = {
      id: 1,
      name: 'Some Show',
      overview: '',
      vote_average: 7.0,
      first_air_date: '2020-05-15',
    };

    const scoreWithYear = calculateScore('Some Show', 2020, result);
    const scoreWithoutYear = calculateScore('Some Show', undefined, result);

    expect(scoreWithYear).toBeGreaterThan(scoreWithoutYear);
  });

  test('🔍 部分标题匹配仍有分数', () => {
    const result: TMDBSearchResult = {
      id: 1,
      name: 'The Walking Dead',
      overview: '',
      vote_average: 7.5,
    };

    const partialScore = calculateScore('Walking Dead', undefined, result);
    expect(partialScore).toBeGreaterThan(0.2);
  });

  test('⭐ 评分越高分数越高', () => {
    const highRated: TMDBSearchResult = {
      id: 1,
      name: 'Show',
      overview: '',
      vote_average: 9.0,
    };

    const lowRated: TMDBSearchResult = {
      id: 2,
      name: 'Show',
      overview: '',
      vote_average: 2.0,
    };

    const highScore = calculateScore('Show', undefined, highRated);
    const lowScore = calculateScore('Show', undefined, lowRated);

    expect(highScore).toBeGreaterThan(lowScore);
  });

  test('🧯 分数上限为 1', () => {
    const result: TMDBSearchResult = {
      id: 1,
      name: 'Exact Match',
      overview: '',
      vote_average: 10.0,
      first_air_date: '2020-01-01',
    };

    const score = calculateScore('Exact Match', 2020, result);
    expect(score).toBeLessThanOrEqual(1);
  });

  test('🖼️ 海报地址拼接正确', () => {
    const url = getPosterUrl('/abc123.jpg', 'w500');
    expect(url).toBe('https://image.tmdb.org/t/p/w500/abc123.jpg');
  });

  test('🧾 海报路径缺失返回 null', () => {
    const url = getPosterUrl(undefined);
    expect(url).toBeNull();
  });

  test('🌄 背景图地址拼接正确', () => {
    const url = getBackdropUrl('/backdrop.jpg', 'w1280');
    expect(url).toBe('https://image.tmdb.org/t/p/w1280/backdrop.jpg');
  });

  test('🧩 获取季详情成功返回数据', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({
      id: 10,
      name: 'Season 1',
      season_number: 1,
      overview: 'Season overview',
      episodes: [],
    }), { status: 200 });

    const season = await getSeasonDetails(1, 1);
    expect(season?.season_number).toBe(1);
    expect(season?.episodes?.length).toBe(0);
  });

  test('🚫 获取季详情失败返回 null', async () => {
    globalThis.fetch = async () => new Response('error', { status: 500 });
    const season = await getSeasonDetails(1, 1);
    expect(season).toBeNull();
  });
});
