import { describe, expect, test } from 'bun:test';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { moveTVEpisodes, writeEpisodeNfos } from './process-shared';
import { resolveTVSeasonDir } from './destination';

describe('scraper process helpers', () => {
  test('writeEpisodeNfos skips episodes missing TMDB data', async () => {
    await expect(writeEpisodeNfos({
      showName: 'Show',
      tmdbId: 1,
      season: 1,
      movedFiles: [{ destPath: '/tmp/Show - S01E01.mkv', episode: 1 }],
      seasonEpisodes: [],
    })).resolves.toBeUndefined();
  });

  test('moveTVEpisodes moves files and returns episode metadata', async () => {
    const root = join(tmpdir(), `process-move-${Date.now()}`);
    const srcDir = join(root, 'src');
    const previousTVPath = process.env.TV_PATH;
    try {
      process.env.TV_PATH = join(root, 'TV');
      const seasonDir = resolveTVSeasonDir('Show', 1);
      await mkdir(srcDir, { recursive: true });
      await mkdir(seasonDir, { recursive: true });
      const source = join(srcDir, 'Show.S01E01.mkv');
      await writeFile(source, 'video');

      const moved = await moveTVEpisodes({
        showName: 'Show',
        season: 1,
        episodes: [{ source, episode: 1 }],
      });

      expect(moved).toHaveLength(1);
      expect(moved[0]?.episode).toBe(1);
      expect(await Bun.file(join(seasonDir, 'Show - S01E01.mkv')).exists()).toBe(true);
    } finally {
      process.env.TV_PATH = previousTVPath;
      await rm(root, { recursive: true, force: true });
    }
  });

  test('writeEpisodeNfos writes NFO for matched episode metadata', async () => {
    const root = join(tmpdir(), `process-nfo-${Date.now()}`);
    await mkdir(root, { recursive: true });
    const videoPath = join(root, 'Show - S01E01.mkv');
    await writeFile(videoPath, 'video');

    await writeEpisodeNfos({
      showName: 'Show',
      tmdbId: 1,
      season: 1,
      movedFiles: [{ destPath: videoPath, episode: 1 }],
      seasonEpisodes: [{ episode_number: 1, name: 'Pilot', air_date: '2020-01-01', overview: 'Intro' }],
    });

    const nfo = await readFile(join(root, 'Show - S01E01.nfo'), 'utf-8');
    expect(nfo).toContain('Pilot');
    expect(nfo).toContain('Intro');
    await rm(root, { recursive: true, force: true });
  });
});
