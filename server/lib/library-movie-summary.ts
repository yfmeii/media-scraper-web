import type { MovieInfo } from '@media-scraper/shared/types';
import { findPosterPath, getAssetFlags } from './scanner-assets';
import { extractNfoDetails, getNfoStatus, getNfoStatusWithTmdb } from './scanner-nfo';

export async function buildMovieBaseSummary(params: {
  moviePath: string;
  entryName: string;
  movieFile: MovieInfo['file'] extends infer T ? Exclude<T, undefined> : never;
  includeAssets: boolean;
}): Promise<MovieInfo> {
  const nfoPath = params.movieFile.path.replace(/\.[^.]+$/, '.nfo');
  const nfoStatus = params.includeAssets
    ? await getNfoStatusWithTmdb(nfoPath)
    : await getNfoStatus(nfoPath);
  const nfoDetails = params.includeAssets ? await extractNfoDetails(nfoPath) : null;

  const movie: MovieInfo = {
    path: params.moviePath,
    name: params.entryName,
    file: params.movieFile,
    hasNfo: nfoStatus.hasNfo,
    isProcessed: nfoStatus.processed,
    posterPath: nfoDetails?.thumbUrl || await findPosterPath(params.moviePath),
    detailLoaded: false,
  };

  if (!params.includeAssets) return movie;

  const assets = await getAssetFlags(params.moviePath, true);
  assets.hasNfo = nfoStatus.hasNfo;

  const yearMatch = params.entryName.match(/\((\d{4})\)/);
  movie.name = params.entryName.replace(/\s*\(\d{4}\)\s*$/, '').trim();
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

  return movie;
}

export function mergeMovieDetail(summary: MovieInfo, detail: Partial<MovieInfo>): MovieInfo {
  return {
    ...summary,
    ...detail,
    file: detail.file || summary.file,
    detailLoaded: true,
  };
}
