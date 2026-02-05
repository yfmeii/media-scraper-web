import { describe, expect, test, afterAll } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { parseFilename, parseFromPath, extractTmdbIdFromNfo, scanDirectory } from './scanner';

let tempRoot = '';

async function ensureTempRoot() {
  if (!tempRoot) {
    tempRoot = await mkdtemp(join(tmpdir(), 'media-scraper-scan-'));
  }
  return tempRoot;
}

afterAll(async () => {
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

describe('文件名解析', () => {
  test('🎬 解析标准 S01E01 格式', () => {
    const result = parseFilename('Game.of.Thrones.S01E01.1080p.BluRay.x264.mkv');
    expect(result.title).toBe('Game of Thrones');
    expect(result.season).toBe(1);
    expect(result.episode).toBe(1);
  });

  test('🎞️ 解析多集 S01E01E02 格式', () => {
    const result = parseFilename('Show.Name.S02E03E04.720p.mkv');
    expect(result.title).toBe('Show Name');
    expect(result.season).toBe(2);
    expect(result.episode).toBe(3);
    expect(result.episodeEnd).toBe(4);
  });

  test('📼 解析包含年份的电影', () => {
    const result = parseFilename('Interstellar.2014.2160p.UHD.BluRay.HEVC.mkv');
    expect(result.title).toBe('Interstellar');
    expect(result.year).toBe(2014);
    expect(result.resolution).toBe('2160p');
  });

  test('🈶 解析中文集数格式', () => {
    const result = parseFilename('我的剧集.第05集.1080p.WEB-DL.mkv');
    expect(result.episode).toBe(5);
    expect(result.season).toBe(1);
    expect(result.resolution).toBe('1080p');
  });

  test('🔤 解析 EP 格式', () => {
    const result = parseFilename('ShowName.EP12.720p.mkv');
    expect(result.title).toBe('ShowName');
    expect(result.episode).toBe(12);
    expect(result.season).toBe(1);
  });

  test('🔢 解析 1x01 格式', () => {
    const result = parseFilename('Friends.3x05.The.One.With.Whatever.mkv');
    expect(result.title).toBe('Friends');
    expect(result.season).toBe(3);
    expect(result.episode).toBe(5);
  });

  test('🧪 解析技术标签并跳过标题', () => {
    const result = parseFilename('Movie.2020.BluRay.1080p.mkv');
    expect(result.year).toBe(2020);
    expect(result.resolution).toBe('1080p');
  });

  test('✨ 支持 4K 分辨率标签', () => {
    const result = parseFilename('Movie.2020.4K.HDR.mkv');
    expect(result.resolution).toBe('4k');
  });

  test('🧵 点号与下划线分隔也能解析', () => {
    const result = parseFilename('Some_Show_S01E05_Episode_Name.mkv');
    expect(result.title).toBe('Some Show');
    expect(result.season).toBe(1);
    expect(result.episode).toBe(5);
  });

  test('🧩 解析括号字幕组格式', () => {
    const result = parseFilename('[SubGroup] Anime Name - EP01.mkv');
    expect(result.episode).toBe(1);
    expect(result.season).toBe(1);
  });

  test('🧭 从路径解析纯数字集数', () => {
    const result = parseFromPath('Show/Season 01/12.mkv');
    expect(result.episode).toBe(12);
    expect(result.season).toBe(1);
  });

  test('🗂️ 从路径解析 E12 格式', () => {
    const result = parseFromPath('Show/Season 02/E12.mkv');
    expect(result.episode).toBe(12);
    expect(result.season).toBe(1);
  });

  test('🧪 解析编码标签', () => {
    const result = parseFilename('Movie.x265.1080p.mkv');
    expect(result.resolution).toBe('1080p');
    expect(result.codec).toBe('x265');
  });

  test('🧷 从 NFO 提取 TMDB ID', async () => {
    const root = await ensureTempRoot();
    const nfoPath = join(root, 'tvshow.nfo');
    await writeFile(nfoPath, '<tvshow><tmdbid>123</tmdbid></tvshow>', 'utf-8');
    const tmdbId = await extractTmdbIdFromNfo(nfoPath);
    expect(tmdbId).toBe(123);
  });

  test('📂 扫描目录识别视频文件', async () => {
    const root = await ensureTempRoot();
    const dir = join(root, 'scan');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'Show.S01E01.mkv'), 'video');
    await writeFile(join(dir, 'README.txt'), 'text');

    const files = await scanDirectory(dir);
    expect(files.length).toBe(1);
    expect(files[0].kind).toBe('tv');
    expect(files[0].name).toContain('Show.S01E01.mkv');
  });
});
