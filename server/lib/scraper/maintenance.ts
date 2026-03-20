import { DEFAULT_LANGUAGE } from '@media-scraper/shared/constants';
import { fixMissingAssets as fixMissingAssetsImpl, supplementTVShow as supplementTVShowImpl } from './maintenance-shared';

export async function supplementTVShow(
  showPath: string,
  language = DEFAULT_LANGUAGE,
): Promise<{ success: boolean; message: string; processed: number }> {
  try {
    return await supplementTVShowImpl(showPath, language);
  } catch (error) {
    console.error('Supplement TV show error:', error);
    return { success: false, message: String(error), processed: 0 };
  }
}

export async function fixMissingAssets(
  kind: 'tv' | 'movie',
  path: string,
  tmdbId: number,
  language = DEFAULT_LANGUAGE,
): Promise<{ success: boolean; message: string; fixed: string[] }> {
  try {
    return await fixMissingAssetsImpl(kind, path, tmdbId, language);
  } catch (error) {
    console.error('Fix assets error:', error);
    return { success: false, message: String(error), fixed: [] };
  }
}
