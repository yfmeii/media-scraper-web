import { extname, join } from 'path';
import { MEDIA_PATHS } from '../config';
import { buildTVEpisodeDestinationName, getMovieFolderName, getSeasonDirName } from './common';

export function resolveTVShowDir(showName: string): string {
  return join(MEDIA_PATHS.tv, showName);
}

export function resolveTVSeasonDir(showName: string, season: number): string {
  return join(resolveTVShowDir(showName), getSeasonDirName(season));
}

export function resolveTVEpisodeDestination(params: {
  showName: string;
  season: number;
  sourcePath: string;
  episode: number;
  episodeEnd?: number;
}): { seasonDir: string; destName: string; destPath: string } {
  const seasonDir = resolveTVSeasonDir(params.showName, params.season);
  const destName = buildTVEpisodeDestinationName(
    params.showName,
    params.season,
    params.episode,
    params.sourcePath,
    params.episodeEnd,
  );

  return {
    seasonDir,
    destName,
    destPath: join(seasonDir, destName),
  };
}

export function resolveMovieDestination(movie: { title: string; release_date?: string }, sourcePath: string): {
  folderName: string;
  movieDir: string;
  destPath: string;
} {
  const folderName = getMovieFolderName(movie);
  const movieDir = join(MEDIA_PATHS.movies, folderName);
  const destPath = join(movieDir, `${folderName}${extname(sourcePath)}`);

  return {
    folderName,
    movieDir,
    destPath,
  };
}
