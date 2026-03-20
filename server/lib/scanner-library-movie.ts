import { extname } from 'path';
import type { MediaFile, MovieInfo } from '@media-scraper/shared/types';
import { getAssetFlags, findPosterPath } from './scanner-assets';
import { getCachedMovieSummary, mergeMovieDetail } from './library-cache';
import { scanDirectory } from './scanner-files';
import { scanLibrary, sortByDisplayName, type LibraryDetailMode } from './scanner-library-core';
import { extractNfoDetails, getNfoStatus, getNfoStatusWithTmdb } from './scanner-nfo';

async function loadMovieFile(moviePath: string): Promise<MediaFile | null> {
  const files = await scanDirectory(moviePath);
  return files.find(file => file.kind === 'movie' || file.kind === 'unknown') || null;
}

async function buildMovieInfo(
  moviePath: string,
  entryName: string,
  includeAssets: boolean,
  detailMode: LibraryDetailMode,
): Promise<MovieInfo | null> {
  const summary = await getCachedMovieSummary({
    moviePath,
    entryName,
    includeAssets,
    loadMovieFile: () => loadMovieFile(moviePath),
  });
  if (!summary) return null;

  if (detailMode === 'summary') {
    return summary;
  }

  const movieFile = await loadMovieFile(moviePath);
  if (!movieFile) return summary;

  const nfoPath = movieFile.path.replace(extname(movieFile.path), '.nfo');
  const nfoStatus = includeAssets
    ? await getNfoStatusWithTmdb(nfoPath)
    : await getNfoStatus(nfoPath);
  const nfoDetails = includeAssets ? await extractNfoDetails(nfoPath) : null;

  const movie: MovieInfo = {
    path: moviePath,
    name: entryName,
    file: movieFile,
    hasNfo: nfoStatus.hasNfo,
    isProcessed: nfoStatus.processed,
    posterPath: nfoDetails?.thumbUrl || await findPosterPath(moviePath),
    detailLoaded: true,
  };

  if (!includeAssets) return mergeMovieDetail(summary, movie);

  const assets = await getAssetFlags(moviePath, true);
  assets.hasNfo = nfoStatus.hasNfo;

  const yearMatch = entryName.match(/\((\d{4})\)/);
  movie.name = entryName.replace(/\s*\(\d{4}\)\s*$/, '').trim();
  movie.year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;
  movie.assets = assets;
  movie.tmdbId = nfoStatus.tmdbId;

  if (nfoDetails) {
    if (nfoDetails.overview) movie.overview = nfoDetails.overview;
    if (nfoDetails.tagline) movie.tagline = nfoDetails.tagline;
    if (typeof nfoDetails.runtime === 'number') movie.runtime = nfoDetails.runtime;
    if (typeof nfoDetails.voteAverage === 'number') movie.voteAverage = nfoDetails.voteAverage;
    if (!movie.year && typeof nfoDetails.year === 'number') movie.year = nfoDetails.year;
  }

  return mergeMovieDetail(summary, movie);
}

export async function scanMovies(moviesPath: string): Promise<MovieInfo[]> {
  return scanLibrary(moviesPath, (moviePath, name) => buildMovieInfo(moviePath, name, false, 'summary'), sortByDisplayName);
}

export async function scanMoviesWithAssets(moviesPath: string, detailMode: LibraryDetailMode = 'full'): Promise<MovieInfo[]> {
  return scanLibrary(moviesPath, (moviePath, name) => buildMovieInfo(moviePath, name, true, detailMode), sortByDisplayName);
}
