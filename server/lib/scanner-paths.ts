import { stat } from 'fs/promises';
import { extname } from 'path';
import type { MediaFile, ParsedInfo } from '@media-scraper/shared/types';
import { getNfoStatus } from './scanner-nfo';

export function buildRelativePath(fullPath: string, rootPath: string): string {
  return fullPath.replace(`${rootPath}/`, '');
}

export function getSidecarPath(filePath: string, nextExt: string): string {
  const currentExt = extname(filePath);
  if (!currentExt) return `${filePath}${nextExt}`;
  return `${filePath.slice(0, -currentExt.length)}${nextExt}`;
}

export function inferMediaKind(parsed: ParsedInfo): MediaFile['kind'] {
  return parsed.season || parsed.episode ? 'tv' : 'movie';
}

export async function buildMediaFile(params: {
  fullPath: string;
  name: string;
  relativePath: string;
  parsed: ParsedInfo;
}): Promise<MediaFile> {
  const nfoPath = getSidecarPath(params.fullPath, '.nfo');
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

export function buildDirectorySummary(files: MediaFile[]) {
  return {
    total: files.length,
    tv: files.filter(file => file.kind === 'tv').length,
    movie: files.filter(file => file.kind === 'movie').length,
    unknown: files.filter(file => file.kind === 'unknown').length,
  };
}
