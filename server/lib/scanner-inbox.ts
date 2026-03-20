import { readdir } from 'fs/promises';
import { extname, join } from 'path';
import type { DirectoryGroup, MediaFile } from '@media-scraper/shared/types';
import { VIDEO_EXTS } from './config';
import { parseFromPath } from './scanner-parser';
import { buildDirectorySummary, buildMediaFile, buildRelativePath } from './scanner-paths';

async function scanVideoEntry(fullPath: string, entryName: string, rootPath: string): Promise<MediaFile> {
  const relativePath = buildRelativePath(fullPath, rootPath);
  return buildMediaFile({
    fullPath,
    name: entryName,
    relativePath,
    parsed: parseFromPath(relativePath),
  });
}

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
    console.error('Error scanning inbox by directory:', error);
  }

  return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
}
