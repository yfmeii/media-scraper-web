import { describe, expect, test } from 'bun:test';

describe('scraper destination helpers', () => {
  test.serial('builds tv paths from configured root and multi-episode source', async () => {
    const { resolveTVShowDir, resolveTVSeasonDir, resolveTVEpisodeDestination } = await import('./destination');

    expect(resolveTVShowDir('Andor', '/library/TV')).toBe('/library/TV/Andor');
    expect(resolveTVSeasonDir('Andor', 2, '/library/TV')).toBe('/library/TV/Andor/Season 02');
    expect(resolveTVEpisodeDestination({
      showName: 'Andor',
      season: 2,
      sourcePath: '/inbox/andor.s02e03.mp4',
      episode: 3,
      episodeEnd: 4,
      tvRoot: '/library/TV',
    })).toEqual({
      seasonDir: '/library/TV/Andor/Season 02',
      destName: 'Andor - S02E03E04.mp4',
      destPath: '/library/TV/Andor/Season 02/Andor - S02E03E04.mp4',
    });
  });

  test.serial('builds movie destination with and without release year', async () => {
    const { resolveMovieDestination } = await import('./destination');

    expect(resolveMovieDestination({ title: 'Arrival', release_date: '2016-11-11' }, '/inbox/arrival.mkv', '/library/Movies')).toEqual({
      folderName: 'Arrival (2016)',
      movieDir: '/library/Movies/Arrival (2016)',
      destPath: '/library/Movies/Arrival (2016)/Arrival (2016).mkv',
    });

    expect(resolveMovieDestination({ title: 'Primer' }, '/inbox/primer.avi', '/library/Movies')).toEqual({
      folderName: 'Primer',
      movieDir: '/library/Movies/Primer',
      destPath: '/library/Movies/Primer/Primer.avi',
    });
  });
});
