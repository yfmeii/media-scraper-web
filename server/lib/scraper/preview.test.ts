import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
const { generatePreviewPlan } = await import('./preview-plan');

let tempRoot = '';

beforeEach(async () => {
  tempRoot = join(tmpdir(), `preview-plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await mkdir(join(tempRoot, 'TV'), { recursive: true });
  await mkdir(join(tempRoot, 'Movies'), { recursive: true });
});

afterEach(async () => {
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

describe('scraper preview planning', () => {
  test.serial('plans mixed create and overwrite actions for TV episodes', async () => {
    const tvRoot = join(tempRoot, 'TV');
    const showDir = join(tvRoot, 'Andor');
    const seasonDir = join(showDir, 'Season 02');
    const existingEpisode = join(seasonDir, 'Andor - S02E03E04.mkv');
    const existingEpisodeNfo = join(seasonDir, 'Andor - S02E03E04.nfo');
    const existingShowNfo = join(showDir, 'tvshow.nfo');
    const sourceA = join(tempRoot, 'andor.s02e03e04.mkv');
    const sourceB = join(tempRoot, 'andor.s02e05.mkv');

    await mkdir(seasonDir, { recursive: true });
    await writeFile(existingShowNfo, 'existing show nfo');
    await writeFile(existingEpisode, 'existing video');
    await writeFile(existingEpisodeNfo, 'existing episode nfo');
    await writeFile(sourceA, 'source a');
    await writeFile(sourceB, 'source b');

    const plan = await generatePreviewPlan([
      {
        kind: 'tv',
        sourcePath: sourceA,
        showName: 'ignored by preview',
        tmdbId: 101,
        season: 2,
        episodes: [
          { source: sourceA, episode: 3, episodeEnd: 4 },
          { source: sourceB, episode: 5 },
        ],
      },
    ], 'zh-CN', {
      tvRoot,
      getTVDetails: async () => ({ id: 101, name: 'Andor' } as any),
    });

    expect(plan.actions).toEqual([
      { type: 'download-poster', destination: join(showDir, 'poster.jpg'), willOverwrite: false },
      { type: 'create-nfo', destination: existingShowNfo, willOverwrite: true },
      { type: 'create-nfo', destination: join(seasonDir, 'season.nfo'), willOverwrite: false },
      { type: 'download-poster', destination: join(seasonDir, 'poster.jpg'), willOverwrite: false },
      { type: 'move', source: sourceA, destination: existingEpisode, willOverwrite: true },
      { type: 'create-nfo', destination: existingEpisodeNfo, willOverwrite: true },
      { type: 'move', source: sourceB, destination: join(seasonDir, 'Andor - S02E05.mkv'), willOverwrite: false },
      { type: 'create-nfo', destination: join(seasonDir, 'Andor - S02E05.nfo'), willOverwrite: false },
    ]);

    expect(plan.impactSummary).toEqual({
      filesMoving: 2,
      nfoCreating: 2,
      nfoOverwriting: 2,
      postersDownloading: 2,
      directoriesCreating: [],
    });
  });

  test.serial('plans directory creation and clean create actions for new movie imports', async () => {
    const source = join(tempRoot, 'arrival.avi');
    const moviesRoot = join(tempRoot, 'Movies');
    const movieDir = join(moviesRoot, 'Arrival (2016)');
    const moviePath = join(movieDir, 'Arrival (2016).avi');
    const movieNfo = join(movieDir, 'Arrival (2016).nfo');
    const poster = join(movieDir, 'poster.jpg');

    await writeFile(source, 'movie source');

    const plan = await generatePreviewPlan([
      {
        kind: 'movie',
        sourcePath: source,
        tmdbId: 202,
      },
    ], 'zh-CN', {
      moviesRoot,
      getMovieDetails: async () => ({ id: 202, title: 'Arrival', release_date: '2016-11-11' } as any),
    });

    expect(plan.actions).toEqual([
      { type: 'create-dir', destination: movieDir, willOverwrite: false },
      { type: 'move', source, destination: moviePath, willOverwrite: false },
      { type: 'create-nfo', destination: movieNfo, willOverwrite: false },
      { type: 'download-poster', destination: poster, willOverwrite: false },
    ]);

    expect(plan.impactSummary).toEqual({
      filesMoving: 1,
      nfoCreating: 1,
      nfoOverwriting: 0,
      postersDownloading: 1,
      directoriesCreating: [movieDir],
    });
  });
});
