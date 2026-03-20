import { readdir, stat, writeFile } from 'fs/promises';
import { dirname, extname, join } from 'path';
import { parseFilename } from '../scanner-parser';
import { extractTmdbIdFromNfo } from '../scanner-nfo';
import { getMovieDetails, getSeasonDetails, getTVDetails } from '../tmdb';
import { downloadImage, fileExists, isVideoFile } from './common';
import { generateEpisodeNFO, generateMovieNFO, generateTVShowNFO } from './nfo';
import { resolveMoviePaths, writeSeasonAssets, writeShowAssets } from './refresh-shared';

export type SupplementResult = { success: boolean; message: string; processed: number };
export type FixAssetsResult = { success: boolean; message: string; fixed: string[] };

export function getSeasonNumberFromEntry(name: string): number {
  const seasonMatch = name.match(/Season\s*(\d+)/i);
  return seasonMatch ? parseInt(seasonMatch[1], 10) : 1;
}

export async function supplementTVShow(showPath: string, language: string): Promise<SupplementResult> {
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
    const seasonNum = getSeasonNumberFromEntry(entry.name);
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
}

async function fixTVAssets(showPath: string, tmdbId: number, language: string, fixed: string[]): Promise<FixAssetsResult> {
  const show = await getTVDetails(tmdbId, language);
  if (!show) return { success: false, message: 'Failed to get show details', fixed };

  const showDir = showPath;
  const posterPath = join(showDir, 'poster.jpg');
  const fanartPath = join(showDir, 'fanart.jpg');
  const nfoPath = join(showDir, 'tvshow.nfo');

  if (!(await fileExists(posterPath)) || !(await fileExists(fanartPath))) {
    const before = { poster: await fileExists(posterPath), fanart: await fileExists(fanartPath) };
    await writeShowAssets(showDir, show.poster_path, show.backdrop_path);
    if (!before.poster && await fileExists(posterPath)) fixed.push('poster.jpg');
    if (!before.fanart && await fileExists(fanartPath)) fixed.push('fanart.jpg');
  }

  if (!(await fileExists(nfoPath))) {
    await writeFile(nfoPath, generateTVShowNFO(show), 'utf-8');
    fixed.push('tvshow.nfo');
  }

  const entries = await readdir(showDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.match(/Season\s*\d+/i)) continue;

    const seasonPath = join(showDir, entry.name);
    const seasonNfoPath = join(seasonPath, 'season.nfo');
    const seasonPosterPath = join(seasonPath, 'poster.jpg');
    const hadSeasonNfo = await fileExists(seasonNfoPath);
    const hadSeasonPoster = await fileExists(seasonPosterPath);

    await writeSeasonAssets(show.name, showDir, tmdbId, getSeasonNumberFromEntry(entry.name), language, seasonPath);

    if (!hadSeasonNfo && await fileExists(seasonNfoPath)) fixed.push(`${entry.name}/season.nfo`);
    if (!hadSeasonPoster && await fileExists(seasonPosterPath)) fixed.push(`${entry.name}/poster.jpg`);
  }

  return {
    success: true,
    message: fixed.length > 0 ? `Fixed: ${fixed.join(', ')}` : 'No assets needed fixing',
    fixed,
  };
}

async function fixMovieAssets(path: string, tmdbId: number, language: string, fixed: string[]): Promise<FixAssetsResult> {
  const movie = await getMovieDetails(tmdbId, language);
  if (!movie) return { success: false, message: 'Failed to get movie details', fixed };

  const { movieDir, movieFilePath } = await resolveMoviePaths(path);
  const posterPath = join(movieDir, 'poster.jpg');
  const fanartPath = join(movieDir, 'fanart.jpg');

  if (!(await fileExists(posterPath)) || !(await fileExists(fanartPath))) {
    const before = { poster: await fileExists(posterPath), fanart: await fileExists(fanartPath) };
    await writeShowAssets(movieDir, movie.poster_path, movie.backdrop_path);
    if (!before.poster && await fileExists(posterPath)) fixed.push('poster.jpg');
    if (!before.fanart && await fileExists(fanartPath)) fixed.push('fanart.jpg');
  }

  const nfoPath = movieFilePath
    ? movieFilePath.replace(extname(movieFilePath), '.nfo')
    : join(movieDir, 'movie.nfo');
  if (!(await fileExists(nfoPath))) {
    await writeFile(nfoPath, generateMovieNFO(movie), 'utf-8');
    fixed.push('movie.nfo');
  }

  return {
    success: true,
    message: fixed.length > 0 ? `Fixed: ${fixed.join(', ')}` : 'No assets needed fixing',
    fixed,
  };
}

export async function fixMissingAssets(kind: 'tv' | 'movie', path: string, tmdbId: number, language: string): Promise<FixAssetsResult> {
  const fixed: string[] = [];
  return kind === 'tv'
    ? fixTVAssets(path, tmdbId, language, fixed)
    : fixMovieAssets(path, tmdbId, language, fixed);
}
