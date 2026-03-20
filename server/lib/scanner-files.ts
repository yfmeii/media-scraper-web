import { readdir, stat } from 'fs/promises';
import { extname, join } from 'path';
import type { DirectoryGroup, MediaFile, ParsedInfo } from '@media-scraper/shared/types';
import { VIDEO_EXTS } from './config';
import { getNfoStatus } from './scanner-nfo';
import { parseFilename, parseFromPath } from './scanner-parser';

function buildRelativePath(fullPath: string, rootPath: string): string {
  return fullPath.replace(`${rootPath}/`, '');
}

function inferMediaKind(parsed: ParsedInfo): MediaFile['kind'] {
  return parsed.season || parsed.episode ? 'tv' : 'movie';
}

async function buildMediaFile(params: {
  fullPath: string;
  name: string;
  relativePath: string;
  parsed: ParsedInfo;
}): Promise<MediaFile> {
  const ext = extname(params.name).toLowerCase();
  const nfoPath = params.fullPath.replace(ext, '.nfo');
  const { hasNfo, processed } = await getNfoStatus(nfoPath);
  const fileStat = await stat(params.fullPath);

  return {
    path: params.fullPath,
    name: params.name,
    relativePath: params.relativePath,
    size: fileStat.size,
    kind: inferMediaKind(params.parsed),
    parsed: params.parsed,
    hasNfo,
    isProcessed: processed,
  };
}

async function scanVideoEntry(fullPath: string, entryName: string, rootPath: string): Promise<MediaFile> {
  const relativePath = buildRelativePath(fullPath, rootPath);
  return buildMediaFile({
    fullPath,
    name: entryName,
    relativePath,
    parsed: parseFromPath(relativePath),
  });
}

function buildDirectorySummary(files: MediaFile[]) {
  return {
    total: files.length,
    tv: files.filter(file => file.kind === 'tv').length,
    movie: files.filter(file => file.kind === 'movie').length,
    unknown: files.filter(file => file.kind === 'unknown').length,
  };
}

// Scan a directory for media files.
// basePath 用于计算相对路径，如果不提供则相对路径为文件名。
export async function scanDirectory(dirPath: string, basePath?: string): Promise<MediaFile[]> {
  const files: MediaFile[] = [];
  const rootPath = basePath || dirPath;

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        files.push(...await scanDirectory(fullPath, rootPath));
        continue;
      }

      if (!entry.isFile()) continue;

      const ext = extname(entry.name).toLowerCase();
      if (!VIDEO_EXTS.has(ext)) continue;

      files.push(await scanVideoEntry(fullPath, entry.name, rootPath));
    }
  } catch (error) {
    console.error(`Error scanning ${dirPath}:`, error);
  }

  return files;
}

export async function scanInbox(inboxPath: string): Promise<MediaFile[]> {
  const files = await scanDirectory(inboxPath, inboxPath);
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

// 按目录分组扫描收件箱。
export async function scanInboxByDirectory(inboxPath: string): Promise<DirectoryGroup[]> {
  const groups: Map<string, DirectoryGroup> = new Map();

  try {
    const entries = await readdir(inboxPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(inboxPath, entry.name);

      if (entry.isDirectory()) {
        const files = await scanDirectory(fullPath, inboxPath);
        if (files.length === 0) continue;

        groups.set(entry.name, {
          path: fullPath,
          name: entry.name,
          files,
          summary: buildDirectorySummary(files),
        });
        continue;
      }

      if (!entry.isFile()) continue;

      const ext = extname(entry.name).toLowerCase();
      if (!VIDEO_EXTS.has(ext)) continue;

      const rootKey = '__ROOT__';
      if (!groups.has(rootKey)) {
        groups.set(rootKey, {
          path: inboxPath,
          name: '根目录',
          files: [],
          summary: { total: 0, tv: 0, movie: 0, unknown: 0 },
        });
      }

      const file = await buildMediaFile({
        fullPath,
        name: entry.name,
        relativePath: entry.name,
        parsed: parseFromPath(entry.name),
      });
      const rootGroup = groups.get(rootKey)!;

      rootGroup.files.push(file);
      rootGroup.summary = buildDirectorySummary(rootGroup.files);
    }
  } catch (error) {
    console.error(`Error scanning inbox by directory:`, error);
  }

  return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// 检测已刮削目录中的新文件（补刮识别）。
export async function detectSupplementFiles(showPath: string): Promise<MediaFile[]> {
  const supplementFiles: MediaFile[] = [];

  try {
    const seasonDirs = await readdir(showPath, { withFileTypes: true });

    for (const seasonDir of seasonDirs) {
      if (!seasonDir.isDirectory() || !seasonDir.name.startsWith('Season')) continue;

      const seasonPath = join(showPath, seasonDir.name);
      const seasonMatch = seasonDir.name.match(/Season\s*(\d+)/i);
      const seasonNum = seasonMatch ? parseInt(seasonMatch[1], 10) : 1;
      const files = await readdir(seasonPath, { withFileTypes: true });

      for (const file of files) {
        if (!file.isFile()) continue;

        const ext = extname(file.name).toLowerCase();
        if (!VIDEO_EXTS.has(ext)) continue;

        const filePath = join(seasonPath, file.name);
        const nfoPath = filePath.replace(ext, '.nfo');

        try {
          await stat(nfoPath);
          continue;
        } catch {}

        const parsed = parseFilename(file.name);
        parsed.season = seasonNum;
        const fileStat = await stat(filePath);

        supplementFiles.push({
          path: filePath,
          name: file.name,
          relativePath: buildRelativePath(filePath, showPath),
          size: fileStat.size,
          kind: 'tv',
          parsed,
          hasNfo: false,
          isProcessed: false,
        });
      }
    }
  } catch (error) {
    console.error(`Error detecting supplement files:`, error);
  }

  return supplementFiles;
}
