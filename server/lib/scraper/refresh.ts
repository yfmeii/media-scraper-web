import { readdir, stat, writeFile } from 'fs/promises';
import { dirname, extname, join } from 'path';
import { DEFAULT_LANGUAGE } from '@media-scraper/shared/constants';
import { parseFilename } from '../scanner-parser';
import { getBackdropUrl, getMovieDetails, getPosterUrl, getSeasonDetails, getTVDetails, type TMDBSeasonDetails } from '../tmdb';
import { downloadImage, fileExists, getSeasonDirName, isVideoFile } from './common';
import { generateEpisodeNFO, generateMovieNFO, generateSeasonNFO, generateTVShowNFO } from './nfo';

async function writeSeasonAssets(
  showName: string,
  showDir: string,
  tmdbId: number,
  seasonNum: number,
  language: string,
  seasonPath?: string,
): Promise<TMDBSeasonDetails | null> {
  const seasonDetails = await getSeasonDetails(tmdbId, seasonNum, language);
  if (!seasonDetails) return null;

  const targetPath = seasonPath || join(showDir, getSeasonDirName(seasonNum));
  await writeFile(join(targetPath, 'season.nfo'), generateSeasonNFO(showName, seasonDetails), 'utf-8');

  const seasonPosterUrl = getPosterUrl(seasonDetails.poster_path, 'original');
  if (seasonPosterUrl) {
    await downloadImage(seasonPosterUrl, join(targetPath, 'poster.jpg'));
  }

  return seasonDetails;
}

async function refreshSeasonEpisodes(
  seasonPath: string,
  showName: string,
  tmdbId: number,
  seasonNum: number,
  seasonEpisodes: TMDBSeasonDetails['episodes'],
  targetEpisode?: number,
): Promise<void> {
  const files = await readdir(seasonPath, { withFileTypes: true });
  for (const file of files) {
    if (!file.isFile() || !isVideoFile(file.name)) continue;
    const epNum = parseFilename(file.name).episode;
    if (!epNum || (targetEpisode && epNum !== targetEpisode)) continue;

    const epData = seasonEpisodes.find(item => item.episode_number === epNum);
    if (!epData) continue;

    const filePath = join(seasonPath, file.name);
    await writeFile(
      filePath.replace(extname(file.name), '.nfo'),
      generateEpisodeNFO(showName, tmdbId, seasonNum, epNum, epData.name, epData.air_date, epData.overview, epData.still_path),
      'utf-8',
    );
    console.log(`[refreshMetadata] Updated NFO for S${seasonNum}E${epNum}`);
    if (targetEpisode) break;
  }
}

async function refreshTVMetadata(
  path: string,
  tmdbId: number,
  season: number | undefined,
  episode: number | undefined,
  language: string,
): Promise<{ success: boolean; message: string }> {
  const show = await getTVDetails(tmdbId, language);
  if (!show) return { success: false, message: 'Failed to get show details' };

  const showDir = path;
  await writeFile(join(showDir, 'tvshow.nfo'), generateTVShowNFO(show), 'utf-8');

  const posterUrl = getPosterUrl(show.poster_path, 'original');
  const backdropUrl = getBackdropUrl(show.backdrop_path, 'original');
  if (posterUrl) await downloadImage(posterUrl, join(showDir, 'poster.jpg'));
  if (backdropUrl) await downloadImage(backdropUrl, join(showDir, 'fanart.jpg'));

  if (season && episode) {
    const seasonPath = join(showDir, getSeasonDirName(season));
    if (!(await fileExists(seasonPath))) {
      return { success: false, message: `Season directory not found: ${seasonPath}` };
    }
    const seasonDetails = await writeSeasonAssets(show.name, showDir, tmdbId, season, language, seasonPath);
    await refreshSeasonEpisodes(seasonPath, show.name, tmdbId, season, seasonDetails?.episodes || [], episode);
    return { success: true, message: 'Metadata refreshed' };
  }

  if (season) {
    const seasonPath = join(showDir, getSeasonDirName(season));
    if (!(await fileExists(seasonPath))) {
      return { success: false, message: `Season directory not found: ${seasonPath}` };
    }
    const seasonDetails = await writeSeasonAssets(show.name, showDir, tmdbId, season, language, seasonPath);
    await refreshSeasonEpisodes(seasonPath, show.name, tmdbId, season, seasonDetails?.episodes || []);
    return { success: true, message: 'Metadata refreshed' };
  }

  const entries = await readdir(showDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.match(/Season\s*\d+/i)) continue;
    const seasonMatch = entry.name.match(/Season\s*(\d+)/i);
    const seasonNum = seasonMatch ? parseInt(seasonMatch[1], 10) : 1;
    const seasonPath = join(showDir, entry.name);
    const seasonDetails = await writeSeasonAssets(show.name, showDir, tmdbId, seasonNum, language, seasonPath);
    await refreshSeasonEpisodes(seasonPath, show.name, tmdbId, seasonNum, seasonDetails?.episodes || []);
  }

  return { success: true, message: 'Metadata refreshed' };
}

async function refreshMovieMetadata(
  path: string,
  tmdbId: number,
  language: string,
): Promise<{ success: boolean; message: string }> {
  const movie = await getMovieDetails(tmdbId, language);
  if (!movie) return { success: false, message: 'Failed to get movie details' };

  let movieDir: string;
  let movieFilePath: string | undefined;
  const pathStat = await stat(path);
  if (pathStat.isDirectory()) {
    movieDir = path;
    const files = await readdir(path, { withFileTypes: true });
    for (const file of files) {
      if (!file.isFile() || !isVideoFile(file.name)) continue;
      movieFilePath = join(path, file.name);
      break;
    }
  } else {
    movieDir = dirname(path);
    movieFilePath = path;
  }

  const movieNfo = generateMovieNFO(movie);
  if (movieFilePath) {
    await writeFile(movieFilePath.replace(extname(movieFilePath), '.nfo'), movieNfo, 'utf-8');
  } else {
    await writeFile(join(movieDir, 'movie.nfo'), movieNfo, 'utf-8');
  }

  const posterUrl = getPosterUrl(movie.poster_path, 'original');
  const backdropUrl = getBackdropUrl(movie.backdrop_path, 'original');
  if (posterUrl) await downloadImage(posterUrl, join(movieDir, 'poster.jpg'));
  if (backdropUrl) await downloadImage(backdropUrl, join(movieDir, 'fanart.jpg'));

  return { success: true, message: 'Metadata refreshed' };
}

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
