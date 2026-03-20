import { readdir, stat, writeFile } from 'fs/promises';
import { dirname, extname, join } from 'path';
import { DEFAULT_LANGUAGE } from '@media-scraper/shared/constants';
import { parseFilename } from '../scanner-parser';
import { extractTmdbIdFromNfo } from '../scanner-nfo';
import { getBackdropUrl, getMovieDetails, getPosterUrl, getSeasonDetails, getTVDetails } from '../tmdb';
import { downloadImage, fileExists, isVideoFile } from './common';
import { generateEpisodeNFO, generateMovieNFO, generateSeasonNFO, generateTVShowNFO } from './nfo';

export async function supplementTVShow(
  showPath: string,
  language = DEFAULT_LANGUAGE,
): Promise<{ success: boolean; message: string; processed: number }> {
  try {
    const tmdbId = await extractTmdbIdFromNfo(join(showPath, 'tvshow.nfo'));
    if (!tmdbId) {
      return { success: false, message: 'Cannot find TMDB ID in tvshow.nfo', processed: 0 };
    }

    const show = await getTVDetails(tmdbId, language);
    if (!show) {
      return { success: false, message: 'Failed to get show details from TMDB', processed: 0 };
    }

    const entries = await readdir(showPath, { withFileTypes: true });
    let processed = 0;
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.match(/Season\s*\d+/i)) continue;

      const seasonPath = join(showPath, entry.name);
      const seasonMatch = entry.name.match(/Season\s*(\d+)/i);
      const seasonNum = seasonMatch ? parseInt(seasonMatch[1], 10) : 1;
      const seasonDetails = await getSeasonDetails(tmdbId, seasonNum, language);
      const seasonEpisodes = seasonDetails?.episodes || [];
      const files = await readdir(seasonPath, { withFileTypes: true });

      for (const file of files) {
        if (!file.isFile() || !isVideoFile(file.name)) continue;

        const filePath = join(seasonPath, file.name);
        const nfoPath = filePath.replace(extname(file.name), '.nfo');
        try {
          await stat(nfoPath);
          continue;
        } catch {}

        const episodeNum = parseFilename(file.name).episode;
        if (!episodeNum) continue;
        const epData = seasonEpisodes.find(item => item.episode_number === episodeNum);
        if (!epData) continue;

        await writeFile(
          nfoPath,
          generateEpisodeNFO(show.name, tmdbId, seasonNum, episodeNum, epData.name, epData.air_date, epData.overview, epData.still_path),
          'utf-8',
        );
        processed++;
      }
    }

    return {
      success: true,
      message: `Supplemented ${processed} episode(s)`,
      processed,
    };
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
  const fixed: string[] = [];

  try {
    if (kind === 'tv') {
      const show = await getTVDetails(tmdbId, language);
      if (!show) return { success: false, message: 'Failed to get show details', fixed };

      const showDir = path;
      const posterPath = join(showDir, 'poster.jpg');
      if (!(await fileExists(posterPath))) {
        const posterUrl = getPosterUrl(show.poster_path, 'original');
        if (posterUrl && await downloadImage(posterUrl, posterPath)) fixed.push('poster.jpg');
      }

      const fanartPath = join(showDir, 'fanart.jpg');
      if (!(await fileExists(fanartPath))) {
        const backdropUrl = getBackdropUrl(show.backdrop_path, 'original');
        if (backdropUrl && await downloadImage(backdropUrl, fanartPath)) fixed.push('fanart.jpg');
      }

      const nfoPath = join(showDir, 'tvshow.nfo');
      if (!(await fileExists(nfoPath))) {
        await writeFile(nfoPath, generateTVShowNFO(show), 'utf-8');
        fixed.push('tvshow.nfo');
      }

      const entries = await readdir(showDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || !entry.name.match(/Season\s*\d+/i)) continue;

        const seasonPath = join(showDir, entry.name);
        const seasonMatch = entry.name.match(/Season\s*(\d+)/i);
        const seasonNum = seasonMatch ? parseInt(seasonMatch[1], 10) : 1;
        const seasonDetails = await getSeasonDetails(tmdbId, seasonNum, language);
        if (!seasonDetails) continue;

        const seasonNfoPath = join(seasonPath, 'season.nfo');
        if (!(await fileExists(seasonNfoPath))) {
          await writeFile(seasonNfoPath, generateSeasonNFO(show.name, seasonDetails), 'utf-8');
          fixed.push(`${entry.name}/season.nfo`);
        }

        const seasonPosterPath = join(seasonPath, 'poster.jpg');
        if (!(await fileExists(seasonPosterPath))) {
          const seasonPosterUrl = getPosterUrl(seasonDetails.poster_path, 'original');
          if (seasonPosterUrl && await downloadImage(seasonPosterUrl, seasonPosterPath)) {
            fixed.push(`${entry.name}/poster.jpg`);
          }
        }
      }
    } else {
      const movie = await getMovieDetails(tmdbId, language);
      if (!movie) return { success: false, message: 'Failed to get movie details', fixed };

      const movieDir = dirname(path);
      const posterPath = join(movieDir, 'poster.jpg');
      if (!(await fileExists(posterPath))) {
        const posterUrl = getPosterUrl(movie.poster_path, 'original');
        if (posterUrl && await downloadImage(posterUrl, posterPath)) fixed.push('poster.jpg');
      }

      const fanartPath = join(movieDir, 'fanart.jpg');
      if (!(await fileExists(fanartPath))) {
        const backdropUrl = getBackdropUrl(movie.backdrop_path, 'original');
        if (backdropUrl && await downloadImage(backdropUrl, fanartPath)) fixed.push('fanart.jpg');
      }

      const nfoPath = path.replace(extname(path), '.nfo');
      if (!(await fileExists(nfoPath))) {
        await writeFile(nfoPath, generateMovieNFO(movie), 'utf-8');
        fixed.push('movie.nfo');
      }
    }

    return {
      success: true,
      message: fixed.length > 0 ? `Fixed: ${fixed.join(', ')}` : 'No assets needed fixing',
      fixed,
    };
  } catch (error) {
    console.error('Fix assets error:', error);
    return { success: false, message: String(error), fixed };
  }
}
