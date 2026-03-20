import type { MediaFile, MovieInfo, ShowInfo } from '@media-scraper/shared/types';
import type { CacheEntryKind } from './library-cache-meta';
import { refreshCachedEntry } from './library-cache-storage';
import { getCachedMovieSummary, getCachedShowSummary, invalidateLibraryCache } from './library-cache-summary';
import { mergeMovieDetail } from './library-movie-summary';
import { enrichShowStatus, mergeShowDetail } from './library-show-summary';

export type { CacheEntryKind } from './library-cache-meta';
export { getCachedMovieSummary, getCachedShowSummary, invalidateLibraryCache } from './library-cache-summary';

export async function refreshLibraryCache(path: string, kind: CacheEntryKind): Promise<void> {
  await refreshCachedEntry(path, kind);
}

export { enrichShowStatus, mergeMovieDetail, mergeShowDetail };
