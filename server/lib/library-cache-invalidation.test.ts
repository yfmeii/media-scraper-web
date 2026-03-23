import { afterEach, describe, expect, mock, test } from 'bun:test';
import { MEDIA_PATHS } from './config';

const invalidateLibraryCacheMock = mock(async () => {});

const {
  invalidateMovedItemCache,
  invalidateMovieCache,
  invalidateTVShowCache,
  resolveMoveToInboxCachePath,
} = await import('./library-cache-invalidation');

describe('library cache invalidation helpers', () => {
  afterEach(() => {
    invalidateLibraryCacheMock.mockClear();
  });

  test('invalidateTVShowCache strips season suffix before invalidation', async () => {
    await invalidateTVShowCache('/media/tv/Show Name/Season 02', invalidateLibraryCacheMock);

    expect(invalidateLibraryCacheMock).toHaveBeenCalledWith('/media/tv/Show Name', 'tv');
  });

  test('invalidateMovieCache invalidates exact movie path', async () => {
    await invalidateMovieCache('/media/movies/Movie Name (2024)', invalidateLibraryCacheMock);

    expect(invalidateLibraryCacheMock).toHaveBeenCalledWith('/media/movies/Movie Name (2024)', 'movie');
  });

  test('resolveMoveToInboxCachePath resolves tv show root and movie parent directory', () => {
    const tvPath = `${MEDIA_PATHS.tv}/Show Name/Season 03/Episode.mkv`;
    const moviePath = `${MEDIA_PATHS.movies}/Movie Name (2024)/Movie Name (2024).mkv`;

    expect(resolveMoveToInboxCachePath(tvPath)).toEqual({
      kind: 'tv',
      cachePath: `${MEDIA_PATHS.tv}/Show Name`,
    });

    expect(resolveMoveToInboxCachePath(moviePath)).toEqual({
      kind: 'movie',
      cachePath: `${MEDIA_PATHS.movies}/Movie Name (2024)`,
    });
  });

  test('invalidateMovedItemCache ignores empty input and invalidates resolved path otherwise', async () => {
    await invalidateMovedItemCache('', invalidateLibraryCacheMock);
    expect(invalidateLibraryCacheMock).not.toHaveBeenCalled();

    await invalidateMovedItemCache(`${MEDIA_PATHS.movies}/Movie Name (2024)/Movie Name (2024).mkv`, invalidateLibraryCacheMock);
    expect(invalidateLibraryCacheMock).toHaveBeenCalledWith(`${MEDIA_PATHS.movies}/Movie Name (2024)`, 'movie');
  });
});
