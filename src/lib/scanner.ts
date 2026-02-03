import { readdir, stat, readFile } from 'fs/promises';
import { join, extname, basename, dirname } from 'path';
import { VIDEO_EXTS, NFO_GENERATOR, EP_PATTERNS, RESOLUTION_TAGS, SOURCE_TAGS, CODEC_TAGS, AUDIO_TAGS } from './config';

export interface MediaFile {
  path: string;
  name: string;
  size: number;
  kind: 'tv' | 'movie' | 'unknown';
  parsed: ParsedInfo;
  hasNfo: boolean;
  isProcessed: boolean;
}

export interface ParsedInfo {
  title: string;
  year?: number;
  season?: number;
  episode?: number;
  episodeEnd?: number;
  resolution?: string;
  source?: string;
  codec?: string;
}

// 资产完整性标记
export interface AssetFlags {
  hasPoster: boolean;
  hasNfo: boolean;
  hasFanart: boolean;
}

export interface ShowInfo {
  path: string;
  name: string;
  seasons: SeasonInfo[];
  hasNfo: boolean;
  isProcessed: boolean;
  posterPath?: string;
  assets?: AssetFlags;
  tmdbId?: number;
  // 分组状态
  groupStatus?: 'scraped' | 'unscraped' | 'supplement';
  // 新增待补刮文件数
  supplementCount?: number;
}

export interface SeasonInfo {
  season: number;
  episodes: MediaFile[];
  hasNfo?: boolean;
  assets?: AssetFlags;
}

export interface MovieInfo {
  path: string;
  name: string;
  year?: number;
  file: MediaFile;
  hasNfo: boolean;
  isProcessed: boolean;
  posterPath?: string;
  assets?: AssetFlags;
  tmdbId?: number;
}

// 目录分组结构（收件箱视图）
export interface DirectoryGroup {
  path: string;
  name: string;
  files: MediaFile[];
  summary: {
    total: number;
    tv: number;
    movie: number;
    unknown: number;
  };
}

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

// Check if NFO contains our generator signature
async function isProcessed(nfoPath: string): Promise<boolean> {
  try {
    const content = await Bun.file(nfoPath).text();
    return content.includes(`<generator>${NFO_GENERATOR}</generator>`);
  } catch {
    return false;
  }
}

// Scan a directory for media files
export async function scanDirectory(dirPath: string): Promise<MediaFile[]> {
  const files: MediaFile[] = [];
  
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subFiles = await scanDirectory(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (VIDEO_EXTS.has(ext)) {
          const parsed = parseFilename(entry.name);
          const nfoPath = fullPath.replace(ext, '.nfo');
          let hasNfo = false;
          let processed = false;
          
          try {
            await stat(nfoPath);
            hasNfo = true;
            processed = await isProcessed(nfoPath);
          } catch {}
          
          const fileStat = await stat(fullPath);
          
          files.push({
            path: fullPath,
            name: entry.name,
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
      const files = await scanDirectory(showPath);
      const tvFiles = files.filter(f => f.kind === 'tv');
      
      if (tvFiles.length === 0) continue;
      
      // Group by season
      const seasons: Map<number, MediaFile[]> = new Map();
      for (const file of tvFiles) {
        const s = file.parsed.season || 1;
        if (!seasons.has(s)) seasons.set(s, []);
        seasons.get(s)!.push(file);
      }
      
      // Check for show NFO
      const nfoPath = join(showPath, 'tvshow.nfo');
      let hasNfo = false;
      let processed = false;
      try {
        await stat(nfoPath);
        hasNfo = true;
        processed = await isProcessed(nfoPath);
      } catch {}
      
      // Check for poster
      let posterPath: string | undefined;
      for (const posterName of ['poster.jpg', 'poster.png', 'folder.jpg']) {
        try {
          await stat(join(showPath, posterName));
          posterPath = `/api/media/poster?path=${encodeURIComponent(join(showPath, posterName))}`;
          break;
        } catch {}
      }
      
      shows.set(entry.name, {
        path: showPath,
        name: entry.name,
        seasons: Array.from(seasons.entries())
          .map(([season, episodes]) => ({ season, episodes: episodes.sort((a, b) => (a.parsed.episode || 0) - (b.parsed.episode || 0)) }))
          .sort((a, b) => a.season - b.season),
        hasNfo,
        isProcessed: processed,
        posterPath,
      });
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
      const files = await scanDirectory(moviePath);
      const movieFile = files.find(f => f.kind === 'movie' || f.kind === 'unknown');
      
      if (!movieFile) continue;
      
      // Check for NFO
      let hasNfo = false;
      let processed = false;
      const nfoPath = movieFile.path.replace(extname(movieFile.path), '.nfo');
      try {
        await stat(nfoPath);
        hasNfo = true;
        processed = await isProcessed(nfoPath);
      } catch {}
      
      // Check for poster
      let posterPath: string | undefined;
      for (const posterName of ['poster.jpg', 'poster.png', 'folder.jpg']) {
        try {
          await stat(join(moviePath, posterName));
          posterPath = `/api/media/poster?path=${encodeURIComponent(join(moviePath, posterName))}`;
          break;
        } catch {}
      }
      
      movies.push({
        path: moviePath,
        name: entry.name,
        file: movieFile,
        hasNfo,
        isProcessed: processed,
        posterPath,
      });
    }
  } catch (error) {
    console.error(`Error scanning movies:`, error);
  }
  
  return movies.sort((a, b) => a.name.localeCompare(b.name));
}

// Scan inbox for unorganized files
export async function scanInbox(inboxPath: string): Promise<MediaFile[]> {
  const files = await scanDirectory(inboxPath);
  return files.sort((a, b) => a.name.localeCompare(b.name));
}

// 按目录分组扫描收件箱
export async function scanInboxByDirectory(inboxPath: string): Promise<DirectoryGroup[]> {
  const groups: Map<string, DirectoryGroup> = new Map();
  
  try {
    const entries = await readdir(inboxPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(inboxPath, entry.name);
      
      if (entry.isDirectory()) {
        // 扫描子目录
        const files = await scanDirectory(fullPath);
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
          const parsed = parseFilename(entry.name);
          const nfoPath = fullPath.replace(ext, '.nfo');
          let hasNfo = false;
          let processed = false;
          
          try {
            await stat(nfoPath);
            hasNfo = true;
            processed = await isProcessed(nfoPath);
          } catch {}
          
          const fileStat = await stat(fullPath);
          const file: MediaFile = {
            path: fullPath,
            name: entry.name,
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

// 获取资产完整性状态
async function getAssetFlags(basePath: string, isMovie = false): Promise<AssetFlags> {
  const flags: AssetFlags = {
    hasPoster: false,
    hasNfo: false,
    hasFanart: false,
  };
  
  // 检查海报
  for (const posterName of ['poster.jpg', 'poster.png', 'folder.jpg']) {
    try {
      await stat(join(basePath, posterName));
      flags.hasPoster = true;
      break;
    } catch {}
  }
  
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
      const files = await scanDirectory(showPath);
      const tvFiles = files.filter(f => f.kind === 'tv');
      
      if (tvFiles.length === 0) continue;
      
      // Group by season
      const seasons: Map<number, MediaFile[]> = new Map();
      for (const file of tvFiles) {
        const s = file.parsed.season || 1;
        if (!seasons.has(s)) seasons.set(s, []);
        seasons.get(s)!.push(file);
      }
      
      // Check for show NFO and extract TMDB ID
      const nfoPath = join(showPath, 'tvshow.nfo');
      let hasNfo = false;
      let processed = false;
      let tmdbId: number | undefined;
      
      try {
        await stat(nfoPath);
        hasNfo = true;
        processed = await isProcessed(nfoPath);
        tmdbId = await extractTmdbIdFromNfo(nfoPath);
      } catch {}
      
      // Check for poster
      let posterPath: string | undefined;
      for (const posterName of ['poster.jpg', 'poster.png', 'folder.jpg']) {
        try {
          await stat(join(showPath, posterName));
          posterPath = `/api/media/poster?path=${encodeURIComponent(join(showPath, posterName))}`;
          break;
        } catch {}
      }
      
      // Get asset flags
      const assets = await getAssetFlags(showPath);
      
      // Detect supplement files
      const supplementFiles = await detectSupplementFiles(showPath);
      const supplementCount = supplementFiles.length;
      
      // Determine group status
      let groupStatus: 'scraped' | 'unscraped' | 'supplement' = 'unscraped';
      if (processed && hasNfo) {
        groupStatus = supplementCount > 0 ? 'supplement' : 'scraped';
      }
      
      // Build season info with assets
      const seasonInfos: SeasonInfo[] = [];
      for (const [season, episodes] of seasons) {
        const seasonPath = join(showPath, `Season ${season.toString().padStart(2, '0')}`);
        const seasonAssets = await getAssetFlags(seasonPath);
        
        // Check season NFO
        let seasonHasNfo = false;
        try {
          await stat(join(seasonPath, 'season.nfo'));
          seasonHasNfo = true;
        } catch {}
        
        seasonInfos.push({
          season,
          episodes: episodes.sort((a, b) => (a.parsed.episode || 0) - (b.parsed.episode || 0)),
          hasNfo: seasonHasNfo,
          assets: seasonAssets,
        });
      }
      
      shows.set(entry.name, {
        path: showPath,
        name: entry.name,
        seasons: seasonInfos.sort((a, b) => a.season - b.season),
        hasNfo,
        isProcessed: processed,
        posterPath,
        assets,
        tmdbId,
        groupStatus,
        supplementCount,
      });
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
      const files = await scanDirectory(moviePath);
      const movieFile = files.find(f => f.kind === 'movie' || f.kind === 'unknown');
      
      if (!movieFile) continue;
      
      // Parse year from directory name (e.g., "Movie Name (2020)")
      const yearMatch = entry.name.match(/\((\d{4})\)/);
      const year = yearMatch ? parseInt(yearMatch[1]) : undefined;
      const displayName = entry.name.replace(/\s*\(\d{4}\)\s*$/, '').trim();
      
      // Check for NFO and extract TMDB ID
      let hasNfo = false;
      let processed = false;
      let tmdbId: number | undefined;
      const nfoPath = movieFile.path.replace(extname(movieFile.path), '.nfo');
      try {
        await stat(nfoPath);
        hasNfo = true;
        processed = await isProcessed(nfoPath);
        tmdbId = await extractTmdbIdFromNfo(nfoPath);
      } catch {}
      
      // Check for poster
      let posterPath: string | undefined;
      for (const posterName of ['poster.jpg', 'poster.png', 'folder.jpg']) {
        try {
          await stat(join(moviePath, posterName));
          posterPath = `/api/media/poster?path=${encodeURIComponent(join(moviePath, posterName))}`;
          break;
        } catch {}
      }
      
      // Get asset flags
      const assets = await getAssetFlags(moviePath, true);
      assets.hasNfo = hasNfo; // Movie NFO is per-file
      
      movies.push({
        path: moviePath,
        name: displayName,
        year,
        file: movieFile,
        hasNfo,
        isProcessed: processed,
        posterPath,
        assets,
        tmdbId,
      });
    }
  } catch (error) {
    console.error(`Error scanning movies with assets:`, error);
  }
  
  return movies.sort((a, b) => a.name.localeCompare(b.name));
}
