import { stat } from 'fs/promises';
import { join } from 'path';
import type { MediaFile, SeasonInfo, ShowInfo } from '@media-scraper/shared/types';
import { getAssetFlags, findPosterPath } from './scanner-assets';
import { getCachedShowSummary, enrichShowStatus, mergeShowDetail } from './library-cache';
import { detectSupplementFiles, scanDirectory } from './scanner-files';
import { scanLibrary, sortByDisplayName, type LibraryDetailMode } from './scanner-library-core';
import { extractNfoDetails, getNfoStatus, getNfoStatusWithTmdb } from './scanner-nfo';

function buildSeasons(files: MediaFile[]): Map<number, MediaFile[]> {
  const seasons: Map<number, MediaFile[]> = new Map();
  for (const file of files) {
    const season = file.parsed.season || 1;
    if (!seasons.has(season)) seasons.set(season, []);
    seasons.get(season)!.push(file);
  }
  return seasons;
}

function sortSeasonEpisodes(files: MediaFile[]): MediaFile[] {
  return [...files].sort((a, b) => (a.parsed.episode || 0) - (b.parsed.episode || 0));
}

async function loadShowFiles(showPath: string): Promise<MediaFile[]> {
  const files = await scanDirectory(showPath);
  return files.filter(file => file.kind === 'tv');
}

async function buildSeasonInfos(
  showPath: string,
  seasons: Map<number, MediaFile[]>,
  includeAssets: boolean,
): Promise<SeasonInfo[]> {
  const seasonInfos: SeasonInfo[] = [];
  for (const [season, episodes] of seasons) {
    const seasonInfo: SeasonInfo = {
      season,
      episodes: sortSeasonEpisodes(episodes),
    };

    if (includeAssets) {
      const seasonPath = join(showPath, `Season ${season.toString().padStart(2, '0')}`);
      const seasonAssets = await getAssetFlags(seasonPath);

      let seasonHasNfo = false;
      try {
        await stat(join(seasonPath, 'season.nfo'));
        seasonHasNfo = true;
      } catch {}

      seasonInfo.hasNfo = seasonHasNfo;
      seasonAssets.hasNfo = seasonHasNfo;
      seasonInfo.assets = seasonAssets;
    }

    seasonInfos.push(seasonInfo);
  }

  return seasonInfos.sort((a, b) => a.season - b.season);
}

async function buildShowInfo(
  showPath: string,
  name: string,
  includeAssets: boolean,
  detailMode: LibraryDetailMode,
): Promise<ShowInfo | null> {
  const summary = await getCachedShowSummary({
    showPath,
    name,
    includeAssets,
    loadFiles: () => loadShowFiles(showPath),
  });
  if (!summary) return null;

  if (detailMode === 'summary') {
    if (!includeAssets) return summary;
    const supplementCount = summary.supplementCount ?? ((summary.hasNfo && summary.isProcessed) ? 1 : 0);
    return enrichShowStatus(summary, supplementCount, summary.assets);
  }

  const tvFiles = await loadShowFiles(showPath);
  if (tvFiles.length === 0) return summary;

  const seasons = buildSeasons(tvFiles);
  const nfoPath = join(showPath, 'tvshow.nfo');
  const nfoStatus = includeAssets
    ? await getNfoStatusWithTmdb(nfoPath)
    : await getNfoStatus(nfoPath);
  const nfoDetails = includeAssets ? await extractNfoDetails(nfoPath) : null;

  const show: ShowInfo = {
    path: showPath,
    name,
    seasons: await buildSeasonInfos(showPath, seasons, includeAssets),
    seasonCount: summary.seasonCount,
    episodeCount: summary.episodeCount,
    hasNfo: nfoStatus.hasNfo,
    isProcessed: nfoStatus.processed,
    posterPath: nfoDetails?.thumbUrl || await findPosterPath(showPath),
    detailLoaded: true,
  };

  if (!includeAssets) return mergeShowDetail(summary, show);

  const assets = await getAssetFlags(showPath);
  const supplementCount = (await detectSupplementFiles(showPath)).length;

  show.assets = assets;
  show.tmdbId = nfoStatus.tmdbId;
  show.supplementCount = supplementCount;

  if (nfoDetails) {
    if (nfoDetails.overview) show.overview = nfoDetails.overview;
    if (nfoDetails.status) show.status = nfoDetails.status;
    if (typeof nfoDetails.voteAverage === 'number') show.voteAverage = nfoDetails.voteAverage;
    if (!show.year && typeof nfoDetails.year === 'number') show.year = nfoDetails.year;
  }

  return enrichShowStatus(mergeShowDetail(summary, show), supplementCount, assets);
}

export async function scanTVShows(tvPath: string): Promise<ShowInfo[]> {
  return scanLibrary(tvPath, (showPath, name) => buildShowInfo(showPath, name, false, 'summary'), sortByDisplayName);
}

export async function scanTVShowsWithAssets(tvPath: string, detailMode: LibraryDetailMode = 'full'): Promise<ShowInfo[]> {
  return scanLibrary(tvPath, (showPath, name) => buildShowInfo(showPath, name, true, detailMode), sortByDisplayName);
}
