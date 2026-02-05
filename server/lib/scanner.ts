import { readdir, stat } from 'fs/promises';
import { join, extname, dirname } from 'path';
import type { MediaFile, ParsedInfo, AssetFlags, ShowInfo, SeasonInfo, MovieInfo, DirectoryGroup } from '@media-scraper/shared';
import { VIDEO_EXTS, NFO_GENERATOR, EP_PATTERNS, RESOLUTION_TAGS, SOURCE_TAGS, CODEC_TAGS, AUDIO_TAGS } from './config';

export type { MediaFile, ParsedInfo, AssetFlags, ShowInfo, SeasonInfo, MovieInfo, DirectoryGroup } from '@media-scraper/shared';

// Parse filename to extract metadata
export function parseFilename(filename: string): ParsedInfo {
  const name = filename.replace(extname(filename), '');
  const tokens = name.replace(/[.\-_\[\](){}]/g, ' ').split(/\s+/).filter(Boolean);
  
  let title = '';
  let year: number | undefined;
  let season: number | undefined;
  let episode: number | undefined;
  let episodeEnd: number | undefined;
  let resolution: string | undefined;
  let source: string | undefined;
  let codec: string | undefined;

  // Find episode pattern
  for (const pattern of EP_PATTERNS) {
    const match = name.match(pattern);
    if (match) {
      if (pattern.source.startsWith('[Ss]')) {
        season = parseInt(match[1]);
        episode = parseInt(match[2]);
        if (match[3]) episodeEnd = parseInt(match[3]);
      } else if (pattern.source.startsWith('(\\d')) {
        season = parseInt(match[1]);
        episode = parseInt(match[2]);
      } else {
        season = 1;
        episode = parseInt(match[1]);
      }
      break;
    }
  }

  // Extract title (stop at episode marker or technical tags)
  const titleTokens: string[] = [];
  for (const token of tokens) {
    const lower = token.toLowerCase();
    
    // Stop at season/episode markers
    if (/^[Ss]\d{1,2}[Ee]\d{1,3}/.test(token)) break;
    if (/^\d{1,2}x\d{1,3}$/.test(token)) break;
    if (/^(?:EP|E)\d{1,3}$/i.test(token)) break;
    
    // Stop at resolution tags
    if (RESOLUTION_TAGS.has(lower)) {
      resolution = lower;
      break;
    }
    
    // Skip technical tags
    if (SOURCE_TAGS.has(lower)) {
      source = lower;
      continue;
    }
    if (CODEC_TAGS.has(lower)) {
      codec = lower;
      continue;
    }
    if (AUDIO_TAGS.has(lower)) continue;
    
    // Check for year
    if (/^\d{4}$/.test(token)) {
      const y = parseInt(token);
      if (y >= 1900 && y <= 2099) {
        year = y;
        continue;
      }
    }
    
    titleTokens.push(token);
  }
  
  title = titleTokens.join(' ').trim();

  return { title, year, season, episode, episodeEnd, resolution, source, codec };
}

// 从相对路径解析元数据（用于 Inbox 文件）
// 不对目录结构做过多假设，只从文件名提取基本信息
export function parseFromPath(relativePath: string): ParsedInfo {
  const parts = relativePath.split('/');
  const filename = parts[parts.length - 1];
  
  // 从文件名解析基本信息
  const parsed = parseFilename(filename);
  
  // 如果文件名是纯数字（如 12.mp4），尝试提取集数
  if (parsed.episode === undefined) {
    const baseName = filename.replace(extname(filename), '');
    // 匹配纯数字
    const epMatch = baseName.match(/^(\d{1,3})$/);
    if (epMatch) {
      parsed.episode = parseInt(epMatch[1]);
      if (!parsed.season) {
        parsed.season = 1;
      }
    }
    // 匹配 E12、EP12 格式
    const epMatch2 = baseName.match(/^[Ee][Pp]?(\d{1,3})$/);
    if (epMatch2) {
      parsed.episode = parseInt(epMatch2[1]);
      if (!parsed.season) {
        parsed.season = 1;
      }
    }
  }
  
  return parsed;
}

// Check if NFO contains our generator signature
async function isProcessed(nfoPath: string): Promise<boolean> {
  try {
    const content = await Bun.file(nfoPath).text();
    return content.includes(`<generator>${NFO_GENERATOR}</generator>`);
  } catch {
    return false;
  }
}

interface NfoDetails {
  overview?: string;
  tagline?: string;
  runtime?: number;
  voteAverage?: number;
  status?: string;
  year?: number;
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function extractNfoTag(content: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
  const match = content.match(regex);
  if (!match) return undefined;
  const value = decodeXml(match[1]).trim();
  return value.length ? value : undefined;
}

async function extractNfoDetails(nfoPath: string): Promise<NfoDetails | null> {
  try {
    const content = await Bun.file(nfoPath).text();
    const overview = extractNfoTag(content, 'plot');
    const tagline = extractNfoTag(content, 'tagline');
    const status = extractNfoTag(content, 'status');
    const ratingValue = extractNfoTag(content, 'rating');
    const runtimeValue = extractNfoTag(content, 'runtime');
    const yearValue = extractNfoTag(content, 'year');
    const premieredValue = extractNfoTag(content, 'premiered');

    const runtime = runtimeValue ? parseInt(runtimeValue, 10) : undefined;
    const voteAverage = ratingValue ? parseFloat(ratingValue) : undefined;
    let year = yearValue ? parseInt(yearValue, 10) : undefined;
    if (!year && premieredValue) {
      const yearMatch = premieredValue.match(/^(\d{4})/);
      if (yearMatch) year = parseInt(yearMatch[1], 10);
    }

    return {
      overview,
      tagline,
      runtime: Number.isFinite(runtime) ? runtime : undefined,
      voteAverage: Number.isFinite(voteAverage) ? voteAverage : undefined,
      status,
      year: Number.isFinite(year) ? year : undefined,
    };
  } catch {
    return null;
  }
}

async function getNfoStatus(nfoPath: string): Promise<{ hasNfo: boolean; processed: boolean; tmdbId?: number }> {
  try {
    await stat(nfoPath);
    return { hasNfo: true, processed: await isProcessed(nfoPath) };
  } catch {
    return { hasNfo: false, processed: false };
  }
}

async function getNfoStatusWithTmdb(
  nfoPath: string
): Promise<{ hasNfo: boolean; processed: boolean; tmdbId?: number }> {
  const status = await getNfoStatus(nfoPath);
  if (!status.hasNfo) return { ...status, tmdbId: undefined };

  const tmdbId = await extractTmdbIdFromNfo(nfoPath);
  return { ...status, tmdbId };
}

function buildSeasons(files: MediaFile[]): Map<number, MediaFile[]> {
  const seasons: Map<number, MediaFile[]> = new Map();
  for (const file of files) {
    const season = file.parsed.season || 1;
    if (!seasons.has(season)) seasons.set(season, []);
    seasons.get(season)!.push(file);
  }
  return seasons;
}

function sortSeasonEpisodes(files: MediaFile[]): MediaFile[] {
  return files.sort((a, b) => (a.parsed.episode || 0) - (b.parsed.episode || 0));
}

async function buildSeasonInfos(
  showPath: string,
  seasons: Map<number, MediaFile[]>,
  includeAssets: boolean
): Promise<SeasonInfo[]> {
  const seasonInfos: SeasonInfo[] = [];
  for (const [season, episodes] of seasons) {
    const seasonInfo: SeasonInfo = {
      season,
      episodes: sortSeasonEpisodes(episodes),
    };

    if (includeAssets) {
      const seasonPath = join(showPath, `Season ${season.toString().padStart(2, '0')}`);
      const seasonAssets = await getAssetFlags(seasonPath);

      let seasonHasNfo = false;
      try {
        await stat(join(seasonPath, 'season.nfo'));
        seasonHasNfo = true;
      } catch {}

      seasonInfo.hasNfo = seasonHasNfo;
      seasonAssets.hasNfo = seasonHasNfo;
      seasonInfo.assets = seasonAssets;
    }

    seasonInfos.push(seasonInfo);
  }

  return seasonInfos.sort((a, b) => a.season - b.season);
}

async function buildShowInfo(
  showPath: string,
  name: string,
  includeAssets: boolean
): Promise<ShowInfo | null> {
  const files = await scanDirectory(showPath);
  const tvFiles = files.filter(f => f.kind === 'tv');
  if (tvFiles.length === 0) return null;

  const seasons = buildSeasons(tvFiles);
  const nfoPath = join(showPath, 'tvshow.nfo');
  const nfoStatus = includeAssets
    ? await getNfoStatusWithTmdb(nfoPath)
    : await getNfoStatus(nfoPath);
  const nfoDetails = includeAssets ? await extractNfoDetails(nfoPath) : null;

  const posterPath = await findPosterPath(showPath);
  const seasonInfos = await buildSeasonInfos(showPath, seasons, includeAssets);

  const show: ShowInfo = {
    path: showPath,
    name,
    seasons: seasonInfos,
    hasNfo: nfoStatus.hasNfo,
    isProcessed: nfoStatus.processed,
    posterPath,
  };

  if (includeAssets) {
    const assets = await getAssetFlags(showPath);
    const supplementFiles = await detectSupplementFiles(showPath);
    const supplementCount = supplementFiles.length;

    let groupStatus: 'scraped' | 'unscraped' | 'supplement' = 'unscraped';
    if (nfoStatus.processed && nfoStatus.hasNfo) {
      groupStatus = supplementCount > 0 ? 'supplement' : 'scraped';
    }

    show.assets = assets;
    show.tmdbId = nfoStatus.tmdbId;
    show.groupStatus = groupStatus;
    show.supplementCount = supplementCount;

    if (nfoDetails) {
      if (nfoDetails.overview) show.overview = nfoDetails.overview;
      if (nfoDetails.status) show.status = nfoDetails.status;
      if (typeof nfoDetails.voteAverage === 'number') show.voteAverage = nfoDetails.voteAverage;
      if (!show.year && typeof nfoDetails.year === 'number') show.year = nfoDetails.year;
    }
  }

  return show;
}

async function buildMovieInfo(
  moviePath: string,
  entryName: string,
  includeAssets: boolean
): Promise<MovieInfo | null> {
  const files = await scanDirectory(moviePath);
  const movieFile = files.find(f => f.kind === 'movie' || f.kind === 'unknown');
  if (!movieFile) return null;

  const nfoPath = movieFile.path.replace(extname(movieFile.path), '.nfo');
  const nfoStatus = includeAssets
    ? await getNfoStatusWithTmdb(nfoPath)
    : await getNfoStatus(nfoPath);
  const nfoDetails = includeAssets ? await extractNfoDetails(nfoPath) : null;

  const posterPath = await findPosterPath(moviePath);

  const movie: MovieInfo = {
    path: moviePath,
    name: entryName,
    file: movieFile,
    hasNfo: nfoStatus.hasNfo,
    isProcessed: nfoStatus.processed,
    posterPath,
  };

  if (includeAssets) {
    const assets = await getAssetFlags(moviePath, true);
    assets.hasNfo = nfoStatus.hasNfo;

    const yearMatch = entryName.match(/\((\d{4})\)/);
    const year = yearMatch ? parseInt(yearMatch[1]) : undefined;
    const displayName = entryName.replace(/\s*\(\d{4}\)\s*$/, '').trim();

    movie.name = displayName;
    movie.year = year;
    movie.assets = assets;
    movie.tmdbId = nfoStatus.tmdbId;

    if (nfoDetails) {
      if (nfoDetails.overview) movie.overview = nfoDetails.overview;
      if (nfoDetails.tagline) movie.tagline = nfoDetails.tagline;
      if (typeof nfoDetails.runtime === 'number') movie.runtime = nfoDetails.runtime;
      if (typeof nfoDetails.voteAverage === 'number') movie.voteAverage = nfoDetails.voteAverage;
      if (!movie.year && typeof nfoDetails.year === 'number') movie.year = nfoDetails.year;
    }
  }

  return movie;
}

// Scan a directory for media files
// basePath 用于计算相对路径，如果不提供则相对路径为文件名
export async function scanDirectory(dirPath: string, basePath?: string): Promise<MediaFile[]> {
  const files: MediaFile[] = [];
  const rootPath = basePath || dirPath;
  
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively scan subdirectories, 保持相同的 basePath
        const subFiles = await scanDirectory(fullPath, rootPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (VIDEO_EXTS.has(ext)) {
          // 计算相对路径
          const relativePath = fullPath.replace(rootPath + '/', '');
          
          // 使用相对路径解析，而不是单独的文件名
          const parsed = parseFromPath(relativePath);
          
          const nfoPath = fullPath.replace(ext, '.nfo');
          const { hasNfo, processed } = await getNfoStatus(nfoPath);
          
          const fileStat = await stat(fullPath);
          
          files.push({
            path: fullPath,
            name: entry.name,
            relativePath,
            size: fileStat.size,
            kind: parsed.season || parsed.episode ? 'tv' : 'movie',
            parsed,
            hasNfo,
            isProcessed: processed,
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning ${dirPath}:`, error);
  }
  
  return files;
}

// Group TV shows by series
export async function scanTVShows(tvPath: string): Promise<ShowInfo[]> {
  const shows: Map<string, ShowInfo> = new Map();
  
  try {
    const entries = await readdir(tvPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const showPath = join(tvPath, entry.name);
      const show = await buildShowInfo(showPath, entry.name, false);
      if (!show) continue;
      shows.set(entry.name, show);
    }
  } catch (error) {
    console.error(`Error scanning TV shows:`, error);
  }
  
  return Array.from(shows.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// Scan movies directory
export async function scanMovies(moviesPath: string): Promise<MovieInfo[]> {
  const movies: MovieInfo[] = [];
  
  try {
    const entries = await readdir(moviesPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const moviePath = join(moviesPath, entry.name);
      const movie = await buildMovieInfo(moviePath, entry.name, false);
      if (!movie) continue;
      movies.push(movie);
    }
  } catch (error) {
    console.error(`Error scanning movies:`, error);
  }
  
  return movies.sort((a, b) => a.name.localeCompare(b.name));
}

// Scan inbox for unorganized files
export async function scanInbox(inboxPath: string): Promise<MediaFile[]> {
  const files = await scanDirectory(inboxPath, inboxPath);
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

// 按目录分组扫描收件箱
export async function scanInboxByDirectory(inboxPath: string): Promise<DirectoryGroup[]> {
  const groups: Map<string, DirectoryGroup> = new Map();
  
  try {
    const entries = await readdir(inboxPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(inboxPath, entry.name);
      
      if (entry.isDirectory()) {
        // 扫描子目录，使用 inboxPath 作为 basePath 来计算相对路径
        const files = await scanDirectory(fullPath, inboxPath);
        if (files.length > 0) {
          groups.set(entry.name, {
            path: fullPath,
            name: entry.name,
            files,
            summary: {
              total: files.length,
              tv: files.filter(f => f.kind === 'tv').length,
              movie: files.filter(f => f.kind === 'movie').length,
              unknown: files.filter(f => f.kind === 'unknown').length,
            },
          });
        }
      } else if (entry.isFile()) {
        // 根目录下的文件
        const ext = extname(entry.name).toLowerCase();
        if (VIDEO_EXTS.has(ext)) {
          // 根目录下的文件，相对路径就是文件名
          const relativePath = entry.name;
          // 使用相对路径解析
          const parsed = parseFromPath(relativePath);
          
          const nfoPath = fullPath.replace(ext, '.nfo');
          const { hasNfo, processed } = await getNfoStatus(nfoPath);
          
          const fileStat = await stat(fullPath);
          const file: MediaFile = {
            path: fullPath,
            name: entry.name,
            relativePath,
            size: fileStat.size,
            kind: parsed.season || parsed.episode ? 'tv' : 'movie',
            parsed,
            hasNfo,
            isProcessed: processed,
          };
          
          const rootKey = '__ROOT__';
          if (!groups.has(rootKey)) {
            groups.set(rootKey, {
              path: inboxPath,
              name: '根目录',
              files: [],
              summary: { total: 0, tv: 0, movie: 0, unknown: 0 },
            });
          }
          const rootGroup = groups.get(rootKey)!;
          rootGroup.files.push(file);
          rootGroup.summary.total++;
          if (file.kind === 'tv') rootGroup.summary.tv++;
          else if (file.kind === 'movie') rootGroup.summary.movie++;
          else rootGroup.summary.unknown++;
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning inbox by directory:`, error);
  }
  
  return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// 从 NFO 中提取 TMDB ID
export async function extractTmdbIdFromNfo(nfoPath: string): Promise<number | undefined> {
  try {
    const content = await Bun.file(nfoPath).text();
    const match = content.match(/<tmdbid>(\d+)<\/tmdbid>/);
    return match ? parseInt(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

// 检测已刮削目录中的新文件（补刮识别）
export async function detectSupplementFiles(showPath: string): Promise<MediaFile[]> {
  const supplementFiles: MediaFile[] = [];
  
  try {
    const seasonDirs = await readdir(showPath, { withFileTypes: true });
    
    for (const seasonDir of seasonDirs) {
      if (!seasonDir.isDirectory() || !seasonDir.name.startsWith('Season')) continue;
      
      const seasonPath = join(showPath, seasonDir.name);
      const seasonMatch = seasonDir.name.match(/Season\s*(\d+)/i);
      const seasonNum = seasonMatch ? parseInt(seasonMatch[1]) : 1;
      
      const files = await readdir(seasonPath, { withFileTypes: true });
      
      for (const file of files) {
        if (!file.isFile()) continue;
        const ext = extname(file.name).toLowerCase();
        if (!VIDEO_EXTS.has(ext)) continue;
        
        const filePath = join(seasonPath, file.name);
        const nfoPath = filePath.replace(ext, '.nfo');
        
        // 没有 NFO 的文件需要补刮
        try {
          await stat(nfoPath);
        } catch {
          const parsed = parseFilename(file.name);
          parsed.season = seasonNum;
          const fileStat = await stat(filePath);
          
          supplementFiles.push({
            path: filePath,
            name: file.name,
            relativePath: filePath.replace(showPath + '/', ''),
            size: fileStat.size,
            kind: 'tv',
            parsed,
            hasNfo: false,
            isProcessed: false,
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error detecting supplement files:`, error);
  }
  
  return supplementFiles;
}

// 海报文件名列表（优先级顺序）
const POSTER_NAMES = ['poster.jpg', 'poster.png', 'folder.jpg'];

// 查找海报路径（返回 API URL 或 undefined）
async function findPosterPath(basePath: string): Promise<string | undefined> {
  for (const posterName of POSTER_NAMES) {
    try {
      await stat(join(basePath, posterName));
      return `/api/media/poster?path=${encodeURIComponent(join(basePath, posterName))}`;
    } catch {}
  }
  return undefined;
}

// 检查海报是否存在
async function hasPoster(basePath: string): Promise<boolean> {
  for (const posterName of POSTER_NAMES) {
    try {
      await stat(join(basePath, posterName));
      return true;
    } catch {}
  }
  return false;
}

// 获取资产完整性状态
async function getAssetFlags(basePath: string, isMovie = false): Promise<AssetFlags> {
  const flags: AssetFlags = {
    hasPoster: false,
    hasNfo: false,
    hasFanart: false,
  };
  
  // 检查海报
  flags.hasPoster = await hasPoster(basePath);
  
  // 检查 NFO
  const nfoName = isMovie ? undefined : 'tvshow.nfo';
  if (nfoName) {
    try {
      await stat(join(basePath, nfoName));
      flags.hasNfo = true;
    } catch {}
  }
  
  // 检查背景图
  try {
    await stat(join(basePath, 'fanart.jpg'));
    flags.hasFanart = true;
  } catch {}
  
  return flags;
}

// 扫描剧集（带资产完整性和分组状态）
export async function scanTVShowsWithAssets(tvPath: string): Promise<ShowInfo[]> {
  const shows: Map<string, ShowInfo> = new Map();
  
  try {
    const entries = await readdir(tvPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const showPath = join(tvPath, entry.name);
      const show = await buildShowInfo(showPath, entry.name, true);
      if (!show) continue;
      shows.set(entry.name, show);
    }
  } catch (error) {
    console.error(`Error scanning TV shows with assets:`, error);
  }
  
  return Array.from(shows.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// 扫描电影（带资产完整性）
export async function scanMoviesWithAssets(moviesPath: string): Promise<MovieInfo[]> {
  const movies: MovieInfo[] = [];
  
  try {
    const entries = await readdir(moviesPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const moviePath = join(moviesPath, entry.name);
      const movie = await buildMovieInfo(moviePath, entry.name, true);
      if (!movie) continue;
      movies.push(movie);
    }
  } catch (error) {
    console.error(`Error scanning movies with assets:`, error);
  }
  
  return movies.sort((a, b) => a.name.localeCompare(b.name));
}
