import { describe, expect, test, afterAll } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  parseFilename,
  parseFromPath,
  extractTmdbIdFromNfo,
  scanDirectory,
  scanInboxByDirectory,
  detectSupplementFiles,
} from './scanner';
import { buildDirectorySummary, getSidecarPath, inferMediaKind } from './scanner-files';

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
    expect(result.title).toBe('Anime Name');
    expect(result.episode).toBe(1);
    expect(result.season).toBe(1);
  });

  test('🉐 解析动漫常见方括号集数格式', () => {
    const result = parseFilename("[CZ&MAI] JoJo's Bizarre Adventure - Diamond is Unbreakable [30][Ma10p_2160p][x265_DTS-HDMA_ass].mkv");
    expect(result.title).toBe("JoJo's Bizarre Adventure Diamond is Unbreakable");
    expect(result.episode).toBe(30);
    expect(result.season).toBe(3);
    expect(result.resolution).toBe('2160p');
    expect(result.codec).toBe('x265');
  });

  test('🎵 动漫 NCED 特典不应识别为正片集数', () => {
    const result = parseFilename("[MAI] JoJo's Bizarre Adventure [NCED02][Ma10p_2160p][x265_flac].mkv");
    expect(result.title).toBe("JoJo's Bizarre Adventure");
    expect(result.episode).toBeUndefined();
    expect(result.season).toBeUndefined();
    expect(result.resolution).toBe('2160p');
    expect(result.codec).toBe('x265');
  });

  test('🧭 根据动漫篇章标题推断季号', () => {
    const result = parseFilename("JoJo's Bizarre Adventure - Diamond is Unbreakable [30].mkv");
    expect(result.title).toBe("JoJo's Bizarre Adventure Diamond is Unbreakable");
    expect(result.episode).toBe(30);
    expect(result.season).toBe(3);
  });

  test('🔁 解析动漫修正版集数 01v2', () => {
    const result = parseFilename('[SubsPlease] Kusuriya no Hitorigoto - 01v2 [1080p].mkv');
    expect(result.title).toBe('Kusuriya no Hitorigoto');
    expect(result.episode).toBe(1);
    expect(result.season).toBe(1);
    expect(result.resolution).toBe('1080p');
  });

  test('🧮 解析动漫方括号多集范围', () => {
    const result = parseFilename('[Group] Show Name [01-02][1080p].mkv');
    expect(result.title).toBe('Show Name');
    expect(result.episode).toBe(1);
    expect(result.episodeEnd).toBe(2);
    expect(result.season).toBe(1);
    expect(result.resolution).toBe('1080p');
  });

  test('🀄 动漫标题支持第30话格式', () => {
    const result = parseFilename('[LoliHouse] 葬送的芙莉莲 - 第30话 [WebRip 1080p].mkv');
    expect(result.title).toBe('葬送的芙莉莲');
    expect(result.episode).toBe(30);
    expect(result.season).toBe(1);
    expect(result.resolution).toBe('1080p');
  });

  test('🎁 OVA 文件不识别为正片集数', () => {
    const result = parseFilename('[Group] Show Name OVA 01 [1080p].mkv');
    expect(result.title).toBe('Show Name');
    expect(result.episode).toBeUndefined();
    expect(result.season).toBeUndefined();
    expect(result.resolution).toBe('1080p');
  });

  test('🎬 非括号 NCOP 文件不识别为正片集数', () => {
    const result = parseFilename('[Group] Show Name NCOP 01 [1080p].mkv');
    expect(result.title).toBe('Show Name');
    expect(result.episode).toBeUndefined();
    expect(result.season).toBeUndefined();
    expect(result.resolution).toBe('1080p');
  });

  test('🛡️ 普通电影文件不误判为动漫修正版集数', () => {
    const result = parseFilename('Movie Title 01v2 1080p.mkv');
    expect(result.title).toBe('Movie Title 01v2');
    expect(result.episode).toBeUndefined();
    expect(result.season).toBeUndefined();
    expect(result.resolution).toBe('1080p');
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

  test('🧮 scanner helper 会推断媒体类型和目录摘要', () => {
    expect(inferMediaKind({ title: 'Show', season: 1 })).toBe('tv');
    expect(inferMediaKind({ title: 'Movie' })).toBe('movie');
    expect(getSidecarPath('/tmp/Movie.MP4', '.nfo')).toBe('/tmp/Movie.nfo');
    expect(buildDirectorySummary([
      { kind: 'tv' },
      { kind: 'movie' },
      { kind: 'movie' },
    ] as any)).toEqual({ total: 3, tv: 1, movie: 2, unknown: 0 });
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

  test('📼 扫描目录支持大写扩展名且不会误读视频为 NFO', async () => {
    const root = await ensureTempRoot();
    const dir = join(root, 'scan-uppercase');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'Movie.2024.MP4'), 'video');

    const files = await scanDirectory(dir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({
      name: 'Movie.2024.MP4',
      hasNfo: false,
      isProcessed: false,
    });
  });

  test('🗃️ 收件箱目录分组包含根目录文件与子目录摘要', async () => {
    const root = await ensureTempRoot();
    const inbox = join(root, 'inbox-groups');
    const subDir = join(inbox, 'Show Folder');
    await mkdir(subDir, { recursive: true });
    await writeFile(join(inbox, 'Movie.2024.mkv'), 'movie');
    await writeFile(join(subDir, 'Show.S01E02.mkv'), 'episode');

    const groups = await scanInboxByDirectory(inbox);
    expect(groups).toHaveLength(2);

    const rootGroup = groups.find(group => group.name === '根目录');
    const folderGroup = groups.find(group => group.name === 'Show Folder');

    expect(rootGroup?.summary).toMatchObject({ total: 1, movie: 1, tv: 0 });
    expect(rootGroup?.files[0]?.relativePath).toBe('Movie.2024.mkv');
    expect(folderGroup?.summary).toMatchObject({ total: 1, movie: 0, tv: 1 });
    expect(folderGroup?.files[0]?.relativePath).toBe('Show Folder/Show.S01E02.mkv');
  });

  test('🩹 detectSupplementFiles only returns episodes missing NFO', async () => {
    const root = await ensureTempRoot();
    const showDir = join(root, 'supplement-show');
    const seasonDir = join(showDir, 'Season 01');
    await mkdir(seasonDir, { recursive: true });

    const missingNfoEpisode = join(seasonDir, 'Demo.Show.S01E03.mkv');
    const completeEpisode = join(seasonDir, 'Demo.Show.S01E04.mkv');
    await writeFile(missingNfoEpisode, 'episode-3');
    await writeFile(completeEpisode, 'episode-4');
    await writeFile(completeEpisode.replace('.mkv', '.nfo'), '<episodedetails />');

    const supplementFiles = await detectSupplementFiles(showDir);
    expect(supplementFiles).toHaveLength(1);
    expect(supplementFiles[0]).toMatchObject({
      name: 'Demo.Show.S01E03.mkv',
      kind: 'tv',
      hasNfo: false,
      isProcessed: false,
    });
    expect(supplementFiles[0]?.relativePath).toBe('Season 01/Demo.Show.S01E03.mkv');
    expect(supplementFiles[0]?.parsed.season).toBe(1);
    expect(supplementFiles[0]?.parsed.episode).toBe(3);
  });

  test('🧾 detectSupplementFiles correctly matches uppercase sidecar extensions', async () => {
    const root = await ensureTempRoot();
    const showDir = join(root, 'supplement-uppercase-show');
    const seasonDir = join(showDir, 'Season 01');
    await mkdir(seasonDir, { recursive: true });

    const completeEpisode = join(seasonDir, 'Demo.Show.S01E05.MP4');
    await writeFile(completeEpisode, 'episode-5');
    await writeFile(join(seasonDir, 'Demo.Show.S01E05.nfo'), '<episodedetails />');

    const supplementFiles = await detectSupplementFiles(showDir);
    expect(supplementFiles).toHaveLength(0);
  });
});
