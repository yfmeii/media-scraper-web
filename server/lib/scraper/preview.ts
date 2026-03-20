import { extname, join } from 'path';
import { DEFAULT_LANGUAGE } from '@media-scraper/shared/constants';
import { MEDIA_PATHS } from '../config';
import { getMovieDetails } from '../tmdb';
import {
  buildTVEpisodeDestinationName,
  fileExists,
  getMovieFolderName,
  getSeasonDirName,
} from './common';

export async function generatePreviewPlan(
  items: Array<{
    kind: 'tv' | 'movie';
    sourcePath: string;
    showName?: string;
    tmdbId: number;
    season?: number;
    episodes?: Array<{ source: string; episode: number; episodeEnd?: number }>;
  }>,
  language = DEFAULT_LANGUAGE,
): Promise<{
  actions: Array<{
    type: 'move' | 'create-nfo' | 'download-poster' | 'create-dir';
    source?: string;
    destination: string;
    willOverwrite: boolean;
  }>;
  impactSummary: {
    filesMoving: number;
    nfoCreating: number;
    nfoOverwriting: number;
    postersDownloading: number;
    directoriesCreating: string[];
  };
}> {
  const actions: Array<{
    type: 'move' | 'create-nfo' | 'download-poster' | 'create-dir';
    source?: string;
    destination: string;
    willOverwrite: boolean;
  }> = [];

  const directoriesCreating = new Set<string>();
  let filesMoving = 0;
  let nfoCreating = 0;
  let nfoOverwriting = 0;
  let postersDownloading = 0;

  for (const item of items) {
    try {
      if (item.kind === 'tv' && item.showName && item.season && item.episodes) {
        const showDir = join(MEDIA_PATHS.tv, item.showName);
        const seasonDir = join(showDir, getSeasonDirName(item.season));

        if (!(await fileExists(showDir))) {
          directoriesCreating.add(showDir);
          actions.push({ type: 'create-dir', destination: showDir, willOverwrite: false });
        }
        if (!(await fileExists(seasonDir))) {
          directoriesCreating.add(seasonDir);
          actions.push({ type: 'create-dir', destination: seasonDir, willOverwrite: false });
        }

        const posterDest = join(showDir, 'poster.jpg');
        if (!(await fileExists(posterDest))) {
          postersDownloading++;
          actions.push({ type: 'download-poster', destination: posterDest, willOverwrite: false });
        }

        for (const nfoDest of [join(showDir, 'tvshow.nfo'), join(seasonDir, 'season.nfo')]) {
          const willOverwrite = await fileExists(nfoDest);
          if (willOverwrite) nfoOverwriting++;
          else nfoCreating++;
          actions.push({ type: 'create-nfo', destination: nfoDest, willOverwrite });
        }

        const seasonPosterDest = join(seasonDir, 'poster.jpg');
        if (!(await fileExists(seasonPosterDest))) {
          postersDownloading++;
          actions.push({ type: 'download-poster', destination: seasonPosterDest, willOverwrite: false });
        }

        for (const ep of item.episodes) {
          const destName = buildTVEpisodeDestinationName(item.showName, item.season, ep.episode, ep.source, ep.episodeEnd);
          const destPath = join(seasonDir, destName);
          const willOverwrite = await fileExists(destPath);

          filesMoving++;
          actions.push({ type: 'move', source: ep.source, destination: destPath, willOverwrite });

          const epNfoDest = destPath.replace(extname(destPath), '.nfo');
          const epNfoOverwrite = await fileExists(epNfoDest);
          if (epNfoOverwrite) nfoOverwriting++;
          else nfoCreating++;
          actions.push({ type: 'create-nfo', destination: epNfoDest, willOverwrite: epNfoOverwrite });
        }
      } else if (item.kind === 'movie') {
        const movie = await getMovieDetails(item.tmdbId, language);
        if (!movie) continue;

        const folderName = getMovieFolderName(movie);
        const movieDir = join(MEDIA_PATHS.movies, folderName);
        if (!(await fileExists(movieDir))) {
          directoriesCreating.add(movieDir);
          actions.push({ type: 'create-dir', destination: movieDir, willOverwrite: false });
        }

        const ext = extname(item.sourcePath);
        const destPath = join(movieDir, `${folderName}${ext}`);
        const willOverwrite = await fileExists(destPath);
        filesMoving++;
        actions.push({ type: 'move', source: item.sourcePath, destination: destPath, willOverwrite });

        const nfoDest = destPath.replace(ext, '.nfo');
        const nfoOverwrite = await fileExists(nfoDest);
        if (nfoOverwrite) nfoOverwriting++;
        else nfoCreating++;
        actions.push({ type: 'create-nfo', destination: nfoDest, willOverwrite: nfoOverwrite });

        const posterDest = join(movieDir, 'poster.jpg');
        if (!(await fileExists(posterDest))) {
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
