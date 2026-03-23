import { extname, join } from 'path';
import { DEFAULT_LANGUAGE } from '@media-scraper/shared/constants';
import { getMovieDetails, getTVDetails } from '../tmdb';
import { fileExists } from './common';
import { resolveMovieDestination, resolveTVEpisodeDestination, resolveTVSeasonDir, resolveTVShowDir } from './destination';

type PreviewPlanItem = {
  kind: 'tv' | 'movie';
  sourcePath: string;
  showName?: string;
  tmdbId: number;
  season?: number;
  episodes?: Array<{ source: string; episode: number; episodeEnd?: number }>;
};

type PreviewPlanAction = {
  type: 'move' | 'create-nfo' | 'download-poster' | 'create-dir';
  source?: string;
  destination: string;
  willOverwrite: boolean;
};

type PreviewPlan = {
  actions: PreviewPlanAction[];
  impactSummary: {
    filesMoving: number;
    nfoCreating: number;
    nfoOverwriting: number;
    postersDownloading: number;
    directoriesCreating: string[];
  };
};

type PreviewPlanOptions = {
  tvRoot?: string;
  moviesRoot?: string;
  getTVDetails?: typeof getTVDetails;
  getMovieDetails?: typeof getMovieDetails;
  fileExists?: typeof fileExists;
};

export async function generatePreviewPlan(
  items: PreviewPlanItem[],
  language = DEFAULT_LANGUAGE,
  options: PreviewPlanOptions = {},
): Promise<PreviewPlan> {
  const actions: PreviewPlanAction[] = [];
  const checkFileExists = options.fileExists ?? fileExists;
  const fetchTVDetails = options.getTVDetails ?? getTVDetails;
  const fetchMovieDetails = options.getMovieDetails ?? getMovieDetails;

  const directoriesCreating = new Set<string>();
  let filesMoving = 0;
  let nfoCreating = 0;
  let nfoOverwriting = 0;
  let postersDownloading = 0;

  for (const item of items) {
    try {
      if (item.kind === 'tv' && item.showName && item.season && item.episodes) {
        const show = await fetchTVDetails(item.tmdbId, language);
        if (!show) continue;

        const showDir = resolveTVShowDir(show.name, options.tvRoot);
        const seasonDir = resolveTVSeasonDir(show.name, item.season, options.tvRoot);

        if (!(await checkFileExists(showDir))) {
          directoriesCreating.add(showDir);
          actions.push({ type: 'create-dir', destination: showDir, willOverwrite: false });
        }
        if (!(await checkFileExists(seasonDir))) {
          directoriesCreating.add(seasonDir);
          actions.push({ type: 'create-dir', destination: seasonDir, willOverwrite: false });
        }

        const posterDest = join(showDir, 'poster.jpg');
        if (!(await checkFileExists(posterDest))) {
          postersDownloading++;
          actions.push({ type: 'download-poster', destination: posterDest, willOverwrite: false });
        }

        for (const nfoDest of [join(showDir, 'tvshow.nfo'), join(seasonDir, 'season.nfo')]) {
          const willOverwrite = await checkFileExists(nfoDest);
          if (willOverwrite) nfoOverwriting++;
          else nfoCreating++;
          actions.push({ type: 'create-nfo', destination: nfoDest, willOverwrite });
        }

        const seasonPosterDest = join(seasonDir, 'poster.jpg');
        if (!(await checkFileExists(seasonPosterDest))) {
          postersDownloading++;
          actions.push({ type: 'download-poster', destination: seasonPosterDest, willOverwrite: false });
        }

        for (const ep of item.episodes) {
          const { destPath } = resolveTVEpisodeDestination({
            showName: show.name,
            season: item.season,
            sourcePath: ep.source,
            episode: ep.episode,
            episodeEnd: ep.episodeEnd,
            tvRoot: options.tvRoot,
          });
          const willOverwrite = await checkFileExists(destPath);

          filesMoving++;
          actions.push({ type: 'move', source: ep.source, destination: destPath, willOverwrite });

          const epNfoDest = destPath.replace(extname(destPath), '.nfo');
          const epNfoOverwrite = await checkFileExists(epNfoDest);
          if (epNfoOverwrite) nfoOverwriting++;
          else nfoCreating++;
          actions.push({ type: 'create-nfo', destination: epNfoDest, willOverwrite: epNfoOverwrite });
        }
      } else if (item.kind === 'movie') {
        const movie = await fetchMovieDetails(item.tmdbId, language);
        if (!movie) continue;

        const { movieDir, destPath } = resolveMovieDestination(movie, item.sourcePath, options.moviesRoot);
        if (!(await checkFileExists(movieDir))) {
          directoriesCreating.add(movieDir);
          actions.push({ type: 'create-dir', destination: movieDir, willOverwrite: false });
        }

        const willOverwrite = await checkFileExists(destPath);
        filesMoving++;
        actions.push({ type: 'move', source: item.sourcePath, destination: destPath, willOverwrite });

        const nfoDest = destPath.replace(extname(destPath), '.nfo');
        const nfoOverwrite = await checkFileExists(nfoDest);
        if (nfoOverwrite) nfoOverwriting++;
        else nfoCreating++;
        actions.push({ type: 'create-nfo', destination: nfoDest, willOverwrite: nfoOverwrite });

        const posterDest = join(movieDir, 'poster.jpg');
        if (!(await checkFileExists(posterDest))) {
          postersDownloading++;
          actions.push({ type: 'download-poster', destination: posterDest, willOverwrite: false });
        }
      }
    } catch (error) {
      console.error('Preview plan error for item:', item, error);
    }
  }

  return {
    actions,
    impactSummary: {
      filesMoving,
      nfoCreating,
      nfoOverwriting,
      postersDownloading,
      directoriesCreating: Array.from(directoriesCreating),
    },
  };
}
