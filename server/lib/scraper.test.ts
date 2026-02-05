import { describe, expect, test, beforeAll, afterAll, afterEach } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { TMDBSeasonDetails } from './tmdb';

let tmpRoot = '';
let tvRoot = '';
let movieRoot = '';
let inboxRoot = '';

let mockShowName = 'Test Show';
let mockSeasonOverview = 'Season overview';
let mockEpisodeOverview = 'Episode overview';
let mockMovieTitle = 'Test Movie';
let mockMovieYear = '2019-01-01';

const originalFetch = globalThis.fetch;

function createMockFetch() {
  return async (input: string | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    const seasonMatch = url.match(/\/tv\/123\/season\/(\d+)/);
    if (seasonMatch) {
      const seasonNum = parseInt(seasonMatch[1], 10);
      const seasonDetails: TMDBSeasonDetails = {
        id: 456 + seasonNum,
        name: `Season ${seasonNum}`,
        season_number: seasonNum,
        overview: mockSeasonOverview,
        poster_path: '/season.jpg',
        air_date: '2020-01-01',
        episodes: [
          {
            id: 1,
            name: 'Ep 1',
            episode_number: 1,
            season_number: seasonNum,
            overview: mockEpisodeOverview,
            air_date: '2020-01-01',
            vote_average: 8,
          },
        ],
      };
      return new Response(JSON.stringify(seasonDetails), { status: 200 });
    }

    if (url.includes('/tv/123')) {
      return new Response(JSON.stringify({
        id: 123,
        name: mockShowName,
        original_name: mockShowName,
        overview: 'Show overview',
        poster_path: '/show.jpg',
        backdrop_path: '/show-bg.jpg',
        first_air_date: '2020-01-01',
        vote_average: 8,
        genres: [],
        number_of_seasons: 1,
      }), { status: 200 });
    }

    if (url.includes('/movie/99')) {
      return new Response(JSON.stringify({
        id: 99,
        title: mockMovieTitle,
        original_title: mockMovieTitle,
        overview: 'Movie overview',
        poster_path: '/movie.jpg',
        backdrop_path: '/movie-bg.jpg',
        release_date: mockMovieYear,
        vote_average: 7,
        runtime: 120,
        genres: [],
      }), { status: 200 });
    }

    if (url.startsWith('https://image.tmdb.org/')) {
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }

    return new Response('not found', { status: 404 });
  };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function uniqueName(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

beforeAll(async () => {
  tmpRoot = await mkdtemp(join(tmpdir(), 'media-scraper-'));
  tvRoot = join(tmpRoot, 'TV');
  movieRoot = join(tmpRoot, 'Movies');
  inboxRoot = join(tmpRoot, 'Inbox');
  process.env.TV_PATH = tvRoot;
  process.env.MOVIES_PATH = movieRoot;
  process.env.INBOX_PATH = inboxRoot;

  await mkdir(tvRoot, { recursive: true });
  await mkdir(movieRoot, { recursive: true });
  await mkdir(inboxRoot, { recursive: true });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

afterAll(async () => {
  globalThis.fetch = originalFetch;
  await rm(tmpRoot, { recursive: true, force: true });
});

describe('刮削业务逻辑', () => {
  test('🎬 处理剧集生成季 NFO 与海报', async () => {
    globalThis.fetch = createMockFetch();
    mockShowName = uniqueName('Show');

    const { processTVShow } = await import('./scraper');
    const srcDir = join(inboxRoot, uniqueName('inbox-tv'));
    await mkdir(srcDir, { recursive: true });
    const srcFile = join(srcDir, `${mockShowName}.S01E01.mkv`);
    await writeFile(srcFile, 'video');

    const result = await processTVShow(srcFile, mockShowName, 123, 1, [
      { source: srcFile, episode: 1 },
    ]);

    expect(result.success).toBe(true);
    const showDir = join(tvRoot, mockShowName);
    const seasonDir = join(showDir, 'Season 01');

    expect(await pathExists(join(showDir, 'tvshow.nfo'))).toBe(true);
    expect(await pathExists(join(showDir, 'poster.jpg'))).toBe(true);
    expect(await pathExists(join(seasonDir, 'season.nfo'))).toBe(true);
    expect(await pathExists(join(seasonDir, 'poster.jpg'))).toBe(true);
    expect(await pathExists(join(seasonDir, `${mockShowName} - S01E01.mkv`))).toBe(true);
    expect(await pathExists(join(seasonDir, `${mockShowName} - S01E01.nfo`))).toBe(true);
  });

  test('🎞️ 处理电影生成 NFO 与海报', async () => {
    globalThis.fetch = createMockFetch();
    mockMovieTitle = uniqueName('Movie');
    mockMovieYear = '2019-01-01';

    const { processMovie } = await import('./scraper');
    const srcDir = join(inboxRoot, uniqueName('inbox-movie'));
    await mkdir(srcDir, { recursive: true });
    const srcFile = join(srcDir, `${mockMovieTitle}.mkv`);
    await writeFile(srcFile, 'video');

    const result = await processMovie(srcFile, 99);
    expect(result.success).toBe(true);

    const movieDir = join(movieRoot, `${mockMovieTitle} (2019)`);
    expect(await pathExists(join(movieDir, `${mockMovieTitle} (2019).mkv`))).toBe(true);
    expect(await pathExists(join(movieDir, `${mockMovieTitle} (2019).nfo`))).toBe(true);
    expect(await pathExists(join(movieDir, 'poster.jpg'))).toBe(true);
  });

  test('🔄 刷新指定季与集生成最新 NFO', async () => {
    globalThis.fetch = createMockFetch();
    mockShowName = uniqueName('RefreshShow');
    mockSeasonOverview = 'Season updated';
    mockEpisodeOverview = 'Episode updated';

    const { refreshMetadata } = await import('./scraper');
    const showDir = join(tvRoot, mockShowName);
    const seasonDir = join(showDir, 'Season 01');
    await mkdir(seasonDir, { recursive: true });

    const videoPath = join(seasonDir, `${mockShowName} - S01E01.mkv`);
    await writeFile(videoPath, 'video');

    const result = await refreshMetadata('tv', showDir, 123, 1, 1);
    expect(result.success).toBe(true);

    const seasonNfo = await readFile(join(seasonDir, 'season.nfo'), 'utf-8');
    const episodeNfo = await readFile(join(seasonDir, `${mockShowName} - S01E01.nfo`), 'utf-8');
    expect(seasonNfo).toContain(mockSeasonOverview);
    expect(episodeNfo).toContain(mockEpisodeOverview);
  });

  test('🧩 补刮只生成缺失的集 NFO', async () => {
    globalThis.fetch = createMockFetch();
    mockShowName = uniqueName('SupplementShow');

    const { supplementTVShow, generateTVShowNFO } = await import('./scraper');
    const showDir = join(tvRoot, mockShowName);
    const seasonDir = join(showDir, 'Season 01');
    await mkdir(seasonDir, { recursive: true });

    const videoPath = join(seasonDir, `${mockShowName} - S01E01.mkv`);
    await writeFile(videoPath, 'video');

    const tvshowNfo = generateTVShowNFO({
      id: 123,
      name: mockShowName,
      original_name: mockShowName,
      overview: 'Show overview',
      poster_path: '/show.jpg',
      backdrop_path: '/show-bg.jpg',
      first_air_date: '2020-01-01',
      vote_average: 8,
      genres: [],
      number_of_seasons: 1,
    });
    await writeFile(join(showDir, 'tvshow.nfo'), tvshowNfo, 'utf-8');

    const result = await supplementTVShow(showDir);
    expect(result.success).toBe(true);
    expect(await pathExists(join(seasonDir, `${mockShowName} - S01E01.nfo`))).toBe(true);
  });

  test('🛠️ 修复缺失资产补齐季级内容', async () => {
    globalThis.fetch = createMockFetch();
    mockShowName = uniqueName('FixShow');

    const { fixMissingAssets } = await import('./scraper');
    const showDir = join(tvRoot, mockShowName);
    const seasonDir = join(showDir, 'Season 01');
    await mkdir(seasonDir, { recursive: true });

    const result = await fixMissingAssets('tv', showDir, 123);
    expect(result.success).toBe(true);
    expect(await pathExists(join(showDir, 'tvshow.nfo'))).toBe(true);
    expect(await pathExists(join(showDir, 'poster.jpg'))).toBe(true);
    expect(await pathExists(join(seasonDir, 'season.nfo'))).toBe(true);
    expect(await pathExists(join(seasonDir, 'poster.jpg'))).toBe(true);
  });

  test('🧾 预览计划包含季 NFO 与海报动作', async () => {
    globalThis.fetch = createMockFetch();
    mockShowName = uniqueName('PlanShow');

    const { generatePreviewPlan } = await import('./scraper');
    const srcDir = join(inboxRoot, uniqueName('inbox-plan'));
    await mkdir(srcDir, { recursive: true });
    const srcFile = join(srcDir, `${mockShowName}.S01E01.mkv`);
    await writeFile(srcFile, 'video');

    const plan = await generatePreviewPlan([{
      kind: 'tv',
      sourcePath: srcFile,
      showName: mockShowName,
      tmdbId: 123,
      season: 1,
      episodes: [{ source: srcFile, episode: 1 }],
    }]);

    expect(plan.impactSummary.filesMoving).toBe(1);
    expect(plan.impactSummary.directoriesCreating.length).toBe(2);
    expect(plan.impactSummary.nfoCreating).toBe(3);
    expect(plan.impactSummary.postersDownloading).toBe(2);
  });
});
