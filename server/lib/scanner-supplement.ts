import { readdir, stat } from 'fs/promises';
import { extname, join } from 'path';
import type { MediaFile } from '@media-scraper/shared/types';
import { VIDEO_EXTS } from './config';
import { parseFilename } from './scanner-parser';
import { buildRelativePath, getSidecarPath } from './scanner-paths';

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
        const nfoPath = getSidecarPath(filePath, '.nfo');

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
    console.error('Error detecting supplement files:', error);
  }

  return supplementFiles;
}
