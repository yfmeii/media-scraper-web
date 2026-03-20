import { join } from 'path';
import type { AssetFlags, MediaFile, ShowInfo } from '@media-scraper/shared/types';
import { findPosterPath, getAssetFlags } from './scanner-assets';
import { extractNfoDetails, getNfoStatus, getNfoStatusWithTmdb } from './scanner-nfo';
import { summarizeShowEpisodes } from './library-summary-shared';

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
