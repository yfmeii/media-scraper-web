import { describe, expect, test } from 'bun:test';
import { parseFilename, parseFromPath } from './scanner-parser';

describe('scanner parser edge cases', () => {
  test('parses anime-style episode ranges with revision suffixes', () => {
    const result = parseFilename('[SubsPlease] Dan Da Dan - [11v2-12v3][1080p][AAC].mkv');

    expect(result).toMatchObject({
      title: 'Dan Da Dan',
      season: 1,
      episode: 11,
      episodeEnd: 12,
      resolution: '1080p',
    });
  });

  test('uses path folders as a season fallback for bare episode filenames', () => {
    const result = parseFromPath('Anime Title/Season 02/E12.mkv');

    expect(result.title).toBe('');
    expect(result.season).toBe(2);
    expect(result.episode).toBe(12);
  });

  test('supports short season folder names with numeric episode files', () => {
    const result = parseFromPath('Show Name/S03/07.mkv');

    expect(result.season).toBe(3);
    expect(result.episode).toBe(7);
  });

  test('treats anime specials as non-episode extras', () => {
    const result = parseFilename('[LoliHouse] Frieren - Special 01 [WebRip 1080p AVC].mkv');

    expect(result.title).toBe('Frieren');
    expect(result.season).toBeUndefined();
    expect(result.episode).toBeUndefined();
    expect(result.resolution).toBe('1080p');
    expect(result.codec).toBe('avc');
  });

  test('keeps movie titles clean while extracting year and technical tags', () => {
    const result = parseFilename('Dune.Part.Two.2024.2160p.WEB-DL.H265.Atmos.mkv');

    expect(result).toMatchObject({
      title: 'Dune Part Two',
      year: 2024,
      resolution: '2160p',
      source: 'web-dl',
      codec: 'h265',
    });
    expect(result.episode).toBeUndefined();
  });
});
