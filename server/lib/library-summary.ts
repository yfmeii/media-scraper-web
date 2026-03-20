import { join } from 'path';
import type { AssetFlags, MediaFile, MovieInfo, ShowInfo } from '@media-scraper/shared/types';
import { findPosterPath, getAssetFlags } from './scanner-assets';
import { extractNfoDetails, getNfoStatus, getNfoStatusWithTmdb } from './scanner-nfo';

function sortEpisodes(files: MediaFile[]): MediaFile[] {
  return [...files].sort((a, b) => (a.parsed.episode || 0) - (b.parsed.episode || 0));
}

export function summarizeShowEpisodes(files: MediaFile[]) {
  const seasonsMap = new Map<number, MediaFile[]>();
  for (const file of files) {
    const season = file.parsed.season || 1;
    const bucket = seasonsMap.get(season) || [];
    bucket.push(file);
    seasonsMap.set(season, bucket);
  }

  const seasons = Array.from(seasonsMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([season, episodes]) => ({ season, episodes: sortEpisodes(episodes) }));

  return {
    seasons,
    seasonCount: seasons.length,
    episodeCount: seasons.reduce((sum, season) => sum + season.episodes.length, 0),
  };
}

export async function buildShowBaseSummary(params: {
  showPath: string;
  name: string;
  files: MediaFile[];
  includeAssets: boolean;
}): Promise<ShowInfo> {
  const { seasons, seasonCount, episodeCount } = summarizeShowEpisodes(params.files);
  const nfoPath = join(params.showPath, 'tvshow.nfo');
  const nfoStatus = params.includeAssets
    ? await getNfoStatusWithTmdb(nfoPath)
    : await getNfoStatus(nfoPath);
  const nfoDetails = params.includeAssets ? await extractNfoDetails(nfoPath) : null;

  const show: ShowInfo = {
    path: params.showPath,
    name: params.name,
    seasons,
    seasonCount,
    episodeCount,
    hasNfo: nfoStatus.hasNfo,
    isProcessed: nfoStatus.processed,
    posterPath: nfoDetails?.thumbUrl || await findPosterPath(params.showPath),
    detailLoaded: false,
  };

  if (!params.includeAssets) return show;

  const assets = await getAssetFlags(params.showPath);
  show.assets = assets;
  show.tmdbId = nfoStatus.tmdbId;
  show.groupStatus = nfoStatus.processed && nfoStatus.hasNfo ? 'scraped' : 'unscraped';
  show.supplementCount = 0;

  if (nfoDetails) {
    if (nfoDetails.overview) show.overview = nfoDetails.overview;
    if (nfoDetails.status) show.status = nfoDetails.status;
    if (typeof nfoDetails.voteAverage === 'number') show.voteAverage = nfoDetails.voteAverage;
    if (!show.year && typeof nfoDetails.year === 'number') show.year = nfoDetails.year;
  }

  return show;
}

export async function buildMovieBaseSummary(params: {
  moviePath: string;
  entryName: string;
  movieFile: MediaFile;
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

export function mergeShowDetail(summary: ShowInfo, detail: Partial<ShowInfo>): ShowInfo {
  return {
    ...summary,
    ...detail,
    seasons: detail.seasons || summary.seasons,
    seasonCount: detail.seasonCount ?? summary.seasonCount,
    episodeCount: detail.episodeCount ?? summary.episodeCount,
    detailLoaded: true,
  };
}

export function mergeMovieDetail(summary: MovieInfo, detail: Partial<MovieInfo>): MovieInfo {
  return {
    ...summary,
    ...detail,
    file: detail.file || summary.file,
    detailLoaded: true,
  };
}

export function enrichShowStatus(summary: ShowInfo, supplementCount: number, assets?: AssetFlags): ShowInfo {
  const groupStatus = summary.hasNfo && summary.isProcessed
    ? (supplementCount > 0 ? 'supplement' : 'scraped')
    : 'unscraped';

  return {
    ...summary,
    assets: assets || summary.assets,
    supplementCount,
    groupStatus,
  };
}
