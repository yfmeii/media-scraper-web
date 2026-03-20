import { mkdir, writeFile } from 'fs/promises';
import { dirname, extname, join } from 'path';
import { DEFAULT_LANGUAGE } from '@media-scraper/shared/constants';
import { MEDIA_PATHS } from '../config';
import { cleanupSourceDir } from '../cleanup';
import { getBackdropUrl, getMovieDetails, getPosterUrl, getSeasonDetails, getTVDetails } from '../tmdb';
import {
  buildTVEpisodeDestinationName,
  downloadImage,
  getMovieFolderName,
  getSeasonDirName,
  moveFile,
  moveRelatedSubtitleFiles,
} from './common';
import {
  generateEpisodeNFO,
  generateMovieNFO,
  generateSeasonNFO,
  generateTVShowNFO,
} from './nfo';

export async function processTVShow(
  sourcePath: string,
  showName: string,
  tmdbId: number,
  season: number,
  episodes: { source: string; episode: number; episodeEnd?: number }[],
  language = DEFAULT_LANGUAGE,
): Promise<{ success: boolean; message: string; destPath?: string }> {
  try {
    const show = await getTVDetails(tmdbId, language);
    if (!show) {
      return { success: false, message: 'Failed to get show details from TMDB' };
    }

    const showDir = join(MEDIA_PATHS.tv, show.name);
    const seasonDir = join(showDir, getSeasonDirName(season));
    await mkdir(seasonDir, { recursive: true });

    const seasonDetails = await getSeasonDetails(tmdbId, season, language);
    const seasonEpisodes = seasonDetails?.episodes || [];
    const movedFiles: { destPath: string; episode: number }[] = [];

    for (const ep of episodes) {
      const destName = buildTVEpisodeDestinationName(show.name, season, ep.episode, ep.source, ep.episodeEnd);
      const destPath = join(seasonDir, destName);

      await moveFile(ep.source, destPath);
      movedFiles.push({ destPath, episode: ep.episode });
      await moveRelatedSubtitleFiles(ep.source, seasonDir, destName.replace(extname(destName), ''));
    }

    await writeFile(join(showDir, 'tvshow.nfo'), generateTVShowNFO(show), 'utf-8');

    const posterUrl = getPosterUrl(show.poster_path, 'original');
    const backdropUrl = getBackdropUrl(show.backdrop_path, 'original');
    if (posterUrl) await downloadImage(posterUrl, join(showDir, 'poster.jpg'));
    if (backdropUrl) await downloadImage(backdropUrl, join(showDir, 'fanart.jpg'));

    if (seasonDetails) {
      await writeFile(join(seasonDir, 'season.nfo'), generateSeasonNFO(show.name, seasonDetails), 'utf-8');
      const seasonPosterUrl = getPosterUrl(seasonDetails.poster_path, 'original');
      if (seasonPosterUrl) await downloadImage(seasonPosterUrl, join(seasonDir, 'poster.jpg'));
    }

    for (const { destPath, episode } of movedFiles) {
      const epData = seasonEpisodes.find(item => item.episode_number === episode);
      if (!epData) continue;
      await writeFile(
        destPath.replace(extname(destPath), '.nfo'),
        generateEpisodeNFO(show.name, tmdbId, season, episode, epData.name, epData.air_date, epData.overview, epData.still_path),
        'utf-8',
      );
    }

    await cleanupSourceDir(dirname(sourcePath));
    return { success: true, message: `Successfully processed ${episodes.length} episodes`, destPath: seasonDir };
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
    const movie = await getMovieDetails(tmdbId, language);
    if (!movie) {
      return { success: false, message: 'Failed to get movie details from TMDB' };
    }

    const folderName = getMovieFolderName(movie);
    const movieDir = join(MEDIA_PATHS.movies, folderName);
    await mkdir(movieDir, { recursive: true });

    const ext = extname(sourcePath);
    const destPath = join(movieDir, `${folderName}${ext}`);
    await moveFile(sourcePath, destPath);
    await moveRelatedSubtitleFiles(sourcePath, movieDir, folderName);

    await writeFile(destPath.replace(ext, '.nfo'), generateMovieNFO(movie), 'utf-8');

    const posterUrl = getPosterUrl(movie.poster_path, 'original');
    const backdropUrl = getBackdropUrl(movie.backdrop_path, 'original');
    if (posterUrl) await downloadImage(posterUrl, join(movieDir, 'poster.jpg'));
    if (backdropUrl) await downloadImage(backdropUrl, join(movieDir, 'fanart.jpg'));

    await cleanupSourceDir(dirname(sourcePath));
    return { success: true, message: `Successfully processed movie: ${movie.title}`, destPath: movieDir };
  } catch (error) {
    console.error('Process movie error:', error);
    return { success: false, message: String(error) };
  }
}
