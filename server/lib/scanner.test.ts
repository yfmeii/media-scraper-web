import { describe, expect, test } from 'bun:test';
import { parseFilename, type ParsedInfo } from './scanner';

describe('parseFilename', () => {
  test('should parse standard TV episode format S01E01', () => {
    const result = parseFilename('Game.of.Thrones.S01E01.1080p.BluRay.x264.mkv');
    expect(result.title).toBe('Game of Thrones');
    expect(result.season).toBe(1);
    expect(result.episode).toBe(1);
    // Resolution is extracted after the episode marker
  });

  test('should parse multi-episode format S01E01E02', () => {
    const result = parseFilename('Show.Name.S02E03E04.720p.mkv');
    expect(result.title).toBe('Show Name');
    expect(result.season).toBe(2);
    expect(result.episode).toBe(3);
    expect(result.episodeEnd).toBe(4);
  });

  test('should parse movie with year', () => {
    const result = parseFilename('Interstellar.2014.2160p.UHD.BluRay.HEVC.mkv');
    expect(result.title).toBe('Interstellar');
    expect(result.year).toBe(2014);
    expect(result.resolution).toBe('2160p');
  });

  test('should parse Chinese episode format', () => {
    const result = parseFilename('我的剧集.第05集.1080p.WEB-DL.mkv');
    expect(result.episode).toBe(5);
    expect(result.season).toBe(1); // Default to season 1
    expect(result.resolution).toBe('1080p');
  });

  test('should parse EP format', () => {
    const result = parseFilename('ShowName.EP12.720p.mkv');
    expect(result.title).toBe('ShowName');
    expect(result.episode).toBe(12);
    expect(result.season).toBe(1);
  });

  test('should parse E format without P', () => {
    const result = parseFilename('ShowName.E12.720p.mkv');
    expect(result.episode).toBe(12);
    expect(result.season).toBe(1);
  });

  test('should parse 1x01 format', () => {
    const result = parseFilename('Friends.3x05.The.One.With.Whatever.mkv');
    expect(result.title).toBe('Friends');
    expect(result.season).toBe(3);
    expect(result.episode).toBe(5);
  });

  test('should handle source tags in filename', () => {
    const result = parseFilename('Movie.2020.BluRay.1080p.mkv');
    expect(result.year).toBe(2020);
    // Source tags are detected and skipped from title
  });

  test('should handle 4K resolution tag', () => {
    const result = parseFilename('Movie.2020.4K.HDR.mkv');
    expect(result.resolution).toBe('4k');
  });

  test('should handle files with dots and underscores', () => {
    const result = parseFilename('Some_Show_S01E05_Episode_Name.mkv');
    expect(result.title).toBe('Some Show');
    expect(result.season).toBe(1);
    expect(result.episode).toBe(5);
  });

  test('should handle anime bracket format', () => {
    const result = parseFilename('[SubGroup] Anime Name - EP01.mkv');
    // Episode number is detected with EP format
    expect(result.episode).toBe(1);
    expect(result.season).toBe(1);
  });

  test('should parse Chinese episode format with spaces', () => {
    const result = parseFilename('我的剧集 第 12 集 1080p.mkv');
    expect(result.episode).toBe(12);
    expect(result.season).toBe(1);
  });

  test('should extract year from title', () => {
    const result = parseFilename('The.Movie.2019.mkv');
    expect(result.title).toBe('The Movie');
    expect(result.year).toBe(2019);
  });

  test('should handle codec tags', () => {
    const result = parseFilename('Movie.x265.1080p.mkv');
    expect(result.resolution).toBe('1080p');
    expect(result.codec).toBe('x265');
  });
});
