import { stat } from 'fs/promises';
import { join } from 'path';
import type { AssetFlags } from '@media-scraper/shared/types';

const POSTER_NAMES = ['poster.jpg', 'poster.png', 'folder.jpg'];

export async function findPosterPath(basePath: string): Promise<string | undefined> {
  for (const posterName of POSTER_NAMES) {
    try {
      await stat(join(basePath, posterName));
      return `/api/media/poster?path=${encodeURIComponent(join(basePath, posterName))}`;
    } catch {}
  }
  return undefined;
}

async function hasPoster(basePath: string): Promise<boolean> {
  for (const posterName of POSTER_NAMES) {
    try {
      await stat(join(basePath, posterName));
      return true;
    } catch {}
  }
  return false;
}

export async function getAssetFlags(basePath: string, isMovie = false): Promise<AssetFlags> {
  const flags: AssetFlags = {
    hasPoster: false,
    hasNfo: false,
    hasFanart: false,
  };

  flags.hasPoster = await hasPoster(basePath);

  const nfoName = isMovie ? undefined : 'tvshow.nfo';
  if (nfoName) {
    try {
      await stat(join(basePath, nfoName));
      flags.hasNfo = true;
    } catch {}
  }

  try {
    await stat(join(basePath, 'fanart.jpg'));
    flags.hasFanart = true;
  } catch {}

  return flags;
}
