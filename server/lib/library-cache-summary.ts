import type { MediaFile, MovieInfo, ShowInfo } from '@media-scraper/shared/types';
import type { CacheEntryKind } from './library-cache-meta';
import { buildMovieBaseSummary } from './library-movie-summary';
import { buildShowBaseSummary } from './library-show-summary';
import { deleteCachedEntry, readCachedEntry, writeCachedEntry } from './library-cache-storage';

export async function getCachedShowSummary(params: {
  showPath: string;
  name: string;
  includeAssets: boolean;
  loadFiles: () => Promise<MediaFile[]>;
}): Promise<ShowInfo | null> {
  const cached = await readCachedEntry<ShowInfo>('tv', params.showPath);
  if (cached.hit) return cached.data;

  const files = await params.loadFiles();
  if (files.length === 0) {
    deleteCachedEntry(params.showPath, 'tv');
    return null;
  }

  const summary = await buildShowBaseSummary({
    showPath: params.showPath,
    name: params.name,
    files,
    includeAssets: params.includeAssets,
  });
  await writeCachedEntry('tv', params.showPath, summary);
  return summary;
}

export async function getCachedMovieSummary(params: {
  moviePath: string;
  entryName: string;
  includeAssets: boolean;
  loadMovieFile: () => Promise<MediaFile | null>;
}): Promise<MovieInfo | null> {
  const cached = await readCachedEntry<MovieInfo>('movie', params.moviePath);
  if (cached.hit) return cached.data;

  const movieFile = await params.loadMovieFile();
  if (!movieFile) {
    deleteCachedEntry(params.moviePath, 'movie');
    return null;
  }

  const summary = await buildMovieBaseSummary({
    moviePath: params.moviePath,
    entryName: params.entryName,
    movieFile,
    includeAssets: params.includeAssets,
  });
  await writeCachedEntry('movie', params.moviePath, summary);
  return summary;
}

export async function invalidateLibraryCache(path: string, kind: CacheEntryKind): Promise<void> {
  deleteCachedEntry(path, kind);
}
