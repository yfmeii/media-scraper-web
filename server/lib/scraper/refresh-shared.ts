import { dirname, extname, join } from 'path';
import { readdir, stat, writeFile } from 'fs/promises';
import { parseFilename } from '../scanner-parser';
import { getBackdropUrl, getMovieDetails, getPosterUrl, getSeasonDetails, getTVDetails, type TMDBSeasonDetails } from '../tmdb';
import { downloadImage, fileExists, getSeasonDirName, isVideoFile } from './common';
import { generateEpisodeNFO, generateMovieNFO, generateSeasonNFO, generateTVShowNFO } from './nfo';

export type RefreshResult = { success: boolean; message: string };

export async function writeShowAssets(showDir: string, posterPath?: string, backdropPath?: string) {
  const posterUrl = getPosterUrl(posterPath, 'original');
  const backdropUrl = getBackdropUrl(backdropPath, 'original');
  if (posterUrl) await downloadImage(posterUrl, join(showDir, 'poster.jpg'));
  if (backdropUrl) await downloadImage(backdropUrl, join(showDir, 'fanart.jpg'));
}

export async function writeSeasonAssets(
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

export async function refreshSeasonEpisodes(
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

export async function resolveMoviePaths(path: string): Promise<{ movieDir: string; movieFilePath?: string }> {
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

  return { movieDir, movieFilePath };
}

export async function refreshMovieMetadata(path: string, tmdbId: number, language: string): Promise<RefreshResult> {
  const movie = await getMovieDetails(tmdbId, language);
  if (!movie) return { success: false, message: 'Failed to get movie details' };

  const { movieDir, movieFilePath } = await resolveMoviePaths(path);
  const movieNfo = generateMovieNFO(movie);
  if (movieFilePath) {
    await writeFile(movieFilePath.replace(extname(movieFilePath), '.nfo'), movieNfo, 'utf-8');
  } else {
    await writeFile(join(movieDir, 'movie.nfo'), movieNfo, 'utf-8');
  }

  await writeShowAssets(movieDir, movie.poster_path, movie.backdrop_path);
  return { success: true, message: 'Metadata refreshed' };
}

export async function ensureSeasonPath(showDir: string, season: number): Promise<string | null> {
  const seasonPath = join(showDir, getSeasonDirName(season));
  if (!(await fileExists(seasonPath))) {
    return null;
  }
  return seasonPath;
}

export async function refreshTVMetadata(path: string, tmdbId: number, season: number | undefined, episode: number | undefined, language: string): Promise<RefreshResult> {
  const show = await getTVDetails(tmdbId, language);
  if (!show) return { success: false, message: 'Failed to get show details' };

  const showDir = path;
  await writeFile(join(showDir, 'tvshow.nfo'), generateTVShowNFO(show), 'utf-8');
  await writeShowAssets(showDir, show.poster_path, show.backdrop_path);

  if (season && episode) {
    const seasonPath = await ensureSeasonPath(showDir, season);
    if (!seasonPath) {
      return { success: false, message: `Season directory not found: ${join(showDir, getSeasonDirName(season))}` };
    }
    const seasonDetails = await writeSeasonAssets(show.name, showDir, tmdbId, season, language, seasonPath);
    await refreshSeasonEpisodes(seasonPath, show.name, tmdbId, season, seasonDetails?.episodes || [], episode);
    return { success: true, message: 'Metadata refreshed' };
  }

  if (season) {
    const seasonPath = await ensureSeasonPath(showDir, season);
    if (!seasonPath) {
      return { success: false, message: `Season directory not found: ${join(showDir, getSeasonDirName(season))}` };
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
