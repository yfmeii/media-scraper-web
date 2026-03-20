import { DEFAULT_LANGUAGE } from '@media-scraper/shared/constants';
import { refreshMovieMetadata, refreshTVMetadata } from './refresh-shared';

export async function refreshMetadata(
  kind: 'tv' | 'movie',
  path: string,
  tmdbId: number,
  season?: number,
  episode?: number,
  language = DEFAULT_LANGUAGE,
): Promise<{ success: boolean; message: string }> {
  try {
    return kind === 'tv'
      ? await refreshTVMetadata(path, tmdbId, season, episode, language)
      : await refreshMovieMetadata(path, tmdbId, language);
  } catch (error) {
    console.error('Refresh metadata error:', error);
    return { success: false, message: String(error) };
  }
}
