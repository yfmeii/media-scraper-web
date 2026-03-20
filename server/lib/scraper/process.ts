import { DEFAULT_LANGUAGE } from '@media-scraper/shared/constants';
import { processMovie as processMovieImpl, processTVShow as processTVShowImpl } from './process-shared';

export async function processTVShow(
  sourcePath: string,
  showName: string,
  tmdbId: number,
  season: number,
  episodes: { source: string; episode: number; episodeEnd?: number }[],
  language = DEFAULT_LANGUAGE,
): Promise<{ success: boolean; message: string; destPath?: string }> {
  try {
    return await processTVShowImpl(sourcePath, showName, tmdbId, season, episodes, language);
  } catch (error) {
    console.error('Process TV show error:', error);
    return { success: false, message: String(error) };
  }
}

export async function processMovie(
  sourcePath: string,
  tmdbId: number,
  language = DEFAULT_LANGUAGE,
): Promise<{ success: boolean; message: string; destPath?: string }> {
  try {
    return await processMovieImpl(sourcePath, tmdbId, language);
  } catch (error) {
    console.error('Process movie error:', error);
    return { success: false, message: String(error) };
  }
}
