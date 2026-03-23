import { extname, join } from 'path';
import { MEDIA_PATHS } from '../config';
import { buildTVEpisodeDestinationName, getMovieFolderName, getSeasonDirName } from './common';

export function resolveTVShowDir(showName: string, tvRoot = MEDIA_PATHS.tv): string {
  return join(tvRoot, showName);
}

export function resolveTVSeasonDir(showName: string, season: number, tvRoot = MEDIA_PATHS.tv): string {
  return join(resolveTVShowDir(showName, tvRoot), getSeasonDirName(season));
}

export function resolveTVEpisodeDestination(params: {
  showName: string;
  season: number;
  sourcePath: string;
  episode: number;
  episodeEnd?: number;
  tvRoot?: string;
}): { seasonDir: string; destName: string; destPath: string } {
  const seasonDir = resolveTVSeasonDir(params.showName, params.season, params.tvRoot);
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

export function resolveMovieDestination(
  movie: { title: string; release_date?: string },
  sourcePath: string,
  moviesRoot = MEDIA_PATHS.movies,
): {
  folderName: string;
  movieDir: string;
  destPath: string;
} {
  const folderName = getMovieFolderName(movie);
  const movieDir = join(moviesRoot, folderName);
  const destPath = join(movieDir, `${folderName}${extname(sourcePath)}`);

  return {
    folderName,
    movieDir,
    destPath,
  };
}
