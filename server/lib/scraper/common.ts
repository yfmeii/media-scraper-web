import { copyFile, rename as renameFile, stat, unlink } from 'fs/promises';
import { basename, dirname, extname, join } from 'path';
import { SUB_EXTS } from '@media-scraper/shared/constants';
import { FILE_OPS_MODE } from '../config';

export const VIDEO_FILE_EXTENSIONS = new Set(['.mkv', '.mp4', '.m4v', '.avi', '.mov']);

export async function moveFile(src: string, dest: string): Promise<void> {
  if (FILE_OPS_MODE === 'copy') {
    await copyFile(src, dest);
    await unlink(src);
    return;
  }
  await renameFile(src, dest);
}

export async function downloadImage(url: string, destPath: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    if (!response.ok) return false;
    const buffer = await response.arrayBuffer();
    await Bun.write(destPath, Buffer.from(buffer));
    return true;
  } catch (error) {
    console.error('Download error:', error);
    return false;
  }
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export function getSeasonDirName(season: number): string {
  return `Season ${season.toString().padStart(2, '0')}`;
}

export function buildEpisodeCode(episode: number, episodeEnd?: number): string {
  let code = `E${episode.toString().padStart(2, '0')}`;
  if (episodeEnd && episodeEnd !== episode) {
    code += `E${episodeEnd.toString().padStart(2, '0')}`;
  }
  return code;
}

export function buildTVEpisodeDestinationName(
  showName: string,
  season: number,
  episode: number,
  sourcePath: string,
  episodeEnd?: number,
): string {
  const ext = extname(sourcePath);
  return `${showName} - S${season.toString().padStart(2, '0')}${buildEpisodeCode(episode, episodeEnd)}${ext}`;
}

export function getMovieFolderName(movie: { title: string; release_date?: string }): string {
  const year = movie.release_date?.split('-')[0] || '';
  return year ? `${movie.title} (${year})` : movie.title;
}

export async function moveRelatedSubtitleFiles(
  sourcePath: string,
  destinationDir: string,
  destinationBaseName: string,
): Promise<void> {
  const ext = extname(sourcePath);
  const srcName = basename(sourcePath, ext);
  const srcDir = dirname(sourcePath);
  for (const subExt of SUB_EXTS) {
    const subPath = join(srcDir, srcName + subExt);
    try {
      await moveFile(subPath, join(destinationDir, `${destinationBaseName}${subExt}`));
    } catch {}
  }
}

export function isVideoFile(fileName: string): boolean {
  return VIDEO_FILE_EXTENSIONS.has(extname(fileName).toLowerCase());
}
