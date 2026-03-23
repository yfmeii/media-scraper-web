import { mkdir, writeFile } from 'fs/promises';
import { dirname, extname, join } from 'path';
import { cleanupSourceDir } from '../cleanup';
import { getMovieDetails, getSeasonDetails, getTVDetails } from '../tmdb';
import {
  moveFile,
  moveRelatedSubtitleFiles,
} from './common';
import { resolveMovieDestination, resolveTVEpisodeDestination, resolveTVSeasonDir, resolveTVShowDir } from './destination';
import { generateEpisodeNFO, generateMovieNFO, generateTVShowNFO } from './nfo';
import { writeSeasonAssets, writeShowAssets } from './refresh-shared';

export type ProcessResult = { success: boolean; message: string; destPath?: string };

export async function moveTVEpisodes(params: {
  showName: string;
  season: number;
  episodes: { source: string; episode: number; episodeEnd?: number }[];
  tvRoot?: string;
}) {
  const movedFiles: Array<{ destPath: string; episode: number }> = [];

  for (const ep of params.episodes) {
    const { seasonDir, destName, destPath } = resolveTVEpisodeDestination({
      showName: params.showName,
      season: params.season,
      sourcePath: ep.source,
      episode: ep.episode,
      episodeEnd: ep.episodeEnd,
      tvRoot: params.tvRoot,
    });

    await moveFile(ep.source, destPath);
    movedFiles.push({ destPath, episode: ep.episode });
    await moveRelatedSubtitleFiles(ep.source, seasonDir, destName.replace(extname(destName), ''));
  }

  return movedFiles;
}

async function fetchTVProcessContext(tmdbId: number, season: number, language: string) {
  const show = await getTVDetails(tmdbId, language);
  if (!show) {
    return null;
  }

  const seasonDetails = await getSeasonDetails(tmdbId, season, language);

  return {
    show,
    seasonDetails,
    showDir: resolveTVShowDir(show.name),
    seasonDir: resolveTVSeasonDir(show.name, season),
  };
}

async function runTVMovePhase(params: {
  showName: string;
  season: number;
  seasonDir: string;
  episodes: { source: string; episode: number; episodeEnd?: number }[];
}) {
  await mkdir(params.seasonDir, { recursive: true });

  return moveTVEpisodes({
    showName: params.showName,
    season: params.season,
    episodes: params.episodes,
  });
}

async function runTVMetadataPhase(params: {
  show: Awaited<ReturnType<typeof getTVDetails>> extends infer T ? NonNullable<T> : never;
  tmdbId: number;
  season: number;
  language: string;
  showDir: string;
  seasonDir: string;
  movedFiles: Array<{ destPath: string; episode: number }>;
  seasonDetails: Awaited<ReturnType<typeof getSeasonDetails>>;
}) {
  await writeFile(join(params.showDir, 'tvshow.nfo'), generateTVShowNFO(params.show), 'utf-8');
  await writeShowAssets(params.showDir, params.show.poster_path, params.show.backdrop_path);

  if (params.seasonDetails) {
    await writeSeasonAssets(params.show.name, params.showDir, params.tmdbId, params.season, params.language, params.seasonDir);
  }

  await writeEpisodeNfos({
    showName: params.show.name,
    tmdbId: params.tmdbId,
    season: params.season,
    movedFiles: params.movedFiles,
    seasonEpisodes: params.seasonDetails?.episodes || [],
  });
}

async function runMovieMovePhase(sourcePath: string, movie: { title: string; release_date?: string }) {
  const { folderName, movieDir, destPath } = resolveMovieDestination(movie, sourcePath);
  await mkdir(movieDir, { recursive: true });
  await moveFile(sourcePath, destPath);
  await moveRelatedSubtitleFiles(sourcePath, movieDir, folderName);

  return { folderName, movieDir, destPath };
}

async function runMovieMetadataPhase(
  movie: Awaited<ReturnType<typeof getMovieDetails>> extends infer T ? NonNullable<T> : never,
  destPath: string,
  movieDir: string,
) {
  await writeFile(destPath.replace(extname(destPath), '.nfo'), generateMovieNFO(movie), 'utf-8');
  await writeShowAssets(movieDir, movie.poster_path, movie.backdrop_path);
}

export async function writeEpisodeNfos(params: {
  showName: string;
  tmdbId: number;
  season: number;
  movedFiles: Array<{ destPath: string; episode: number }>;
  seasonEpisodes: Array<{ episode_number: number; name: string; air_date: string; overview: string; still_path?: string }>;
}) {
  for (const { destPath, episode } of params.movedFiles) {
    const epData = params.seasonEpisodes.find(item => item.episode_number === episode);
    if (!epData) continue;
    await writeFile(
      destPath.replace(extname(destPath), '.nfo'),
      generateEpisodeNFO(
        params.showName,
        params.tmdbId,
        params.season,
        episode,
        epData.name,
        epData.air_date,
        epData.overview,
        epData.still_path,
      ),
      'utf-8',
    );
  }
}

export async function processTVShow(
  sourcePath: string,
  _showName: string,
  tmdbId: number,
  season: number,
  episodes: { source: string; episode: number; episodeEnd?: number }[],
  language: string,
): Promise<ProcessResult> {
  const context = await fetchTVProcessContext(tmdbId, season, language);
  if (!context) {
    return { success: false, message: 'Failed to get show details from TMDB' };
  }

  const movedFiles = await runTVMovePhase({
    showName: context.show.name,
    season,
    seasonDir: context.seasonDir,
    episodes,
  });

  await runTVMetadataPhase({
    show: context.show,
    tmdbId,
    season,
    language,
    showDir: context.showDir,
    seasonDir: context.seasonDir,
    movedFiles,
    seasonDetails: context.seasonDetails,
  });

  await cleanupSourceDir(dirname(sourcePath));
  return { success: true, message: `Successfully processed ${episodes.length} episodes`, destPath: context.seasonDir };
}

export async function processMovie(sourcePath: string, tmdbId: number, language: string): Promise<ProcessResult> {
  const movie = await getMovieDetails(tmdbId, language);
  if (!movie) {
    return { success: false, message: 'Failed to get movie details from TMDB' };
  }

  const { movieDir, destPath } = await runMovieMovePhase(sourcePath, movie);
  await runMovieMetadataPhase(movie, destPath, movieDir);

  await cleanupSourceDir(dirname(sourcePath));
  return { success: true, message: `Successfully processed movie: ${movie.title}`, destPath: movieDir };
}
