import { unlink } from 'fs/promises';
import { basename, dirname, extname, join } from 'path';
import { SUB_EXTS } from '@media-scraper/shared/constants';
import { MEDIA_PATHS } from './config';
import { moveFile } from './scraper/common';

export interface MoveToInboxDeps {
  inboxPath: string;
  tvPath: string;
  moviesPath: string;
  subtitleExtensions: readonly string[];
  move: (sourcePath: string, destinationPath: string) => Promise<void>;
  unlinkFile: (filePath: string) => Promise<void>;
}

const defaultDeps: MoveToInboxDeps = {
  inboxPath: MEDIA_PATHS.inbox,
  tvPath: MEDIA_PATHS.tv,
  moviesPath: MEDIA_PATHS.movies,
  subtitleExtensions: SUB_EXTS,
  move: moveFile,
  unlinkFile: unlink,
};

export class MoveToInboxError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'MoveToInboxError';
    this.status = status;
  }
}

function isInLibrary(sourcePath: string, deps: MoveToInboxDeps): boolean {
  return sourcePath.startsWith(deps.tvPath) || sourcePath.startsWith(deps.moviesPath);
}

export async function moveMediaToInbox(
  sourcePath: string,
  overrides: Partial<MoveToInboxDeps> = {},
): Promise<{ success: true; message: string; destPath: string }> {
  const deps = { ...defaultDeps, ...overrides };

  if (!sourcePath) {
    throw new MoveToInboxError('Missing sourcePath parameter');
  }

  if (!isInLibrary(sourcePath, deps)) {
    throw new MoveToInboxError('File is not in library (TV/Movies)');
  }

  const fileName = basename(sourcePath);
  const destPath = join(deps.inboxPath, fileName);
  const sourceDir = dirname(sourcePath);
  const sourceBaseName = basename(sourcePath, extname(sourcePath));

  await deps.move(sourcePath, destPath);

  for (const subExt of deps.subtitleExtensions) {
    try {
      await deps.move(
        join(sourceDir, `${sourceBaseName}${subExt}`),
        join(deps.inboxPath, `${sourceBaseName}${subExt}`),
      );
    } catch {}
  }

  try {
    await deps.unlinkFile(join(sourceDir, `${sourceBaseName}.nfo`));
  } catch {}

  return {
    success: true,
    message: `Moved to inbox: ${fileName}`,
    destPath,
  };
}
