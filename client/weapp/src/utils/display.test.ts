import { describe, expect, test } from 'bun:test'
import {
  formatFileSizeLabel,
  formatVoteRating,
  formatVoteRatingWithScale,
  getEpisodeCode,
  getEpisodeTitle,
  getInboxFileMeta,
  getMediaFileDisplayName,
  getMovieDisplayName,
  getShowDisplayName,
  normalizeText,
} from './display'

describe('weapp display helpers', () => {
  test('normalizes empty and stringified null text', () => {
    expect(normalizeText(' null ', 'fallback')).toBe('fallback')
    expect(normalizeText('undefined', 'fallback')).toBe('fallback')
    expect(normalizeText(' For All Mankind ')).toBe('For All Mankind')
  })

  test('builds stable display names and meta', () => {
    const file = {
      path: '/media/inbox/F1.mkv',
      name: 'null',
      relativePath: 'F1.mkv',
      kind: 'movie' as const,
      size: 1024,
      parsed: { title: 'F1', year: 2025 },
    }
    expect(getMediaFileDisplayName(file)).toBe('F1.mkv')
    expect(getInboxFileMeta(file)).toBe('F1 (2025)')
  })

  test('formats movie, show and episode labels safely', () => {
    expect(getMovieDisplayName({ name: 'null', path: '/movies/Arrival (2016)', file: null as never })).toBe('Arrival (2016)')
    expect(getShowDisplayName({ name: '', path: '/tv/Andor' })).toBe('Andor')
    expect(getEpisodeTitle({ path: '/tv/Season 01/Andor - S01E01.mkv', name: 'null', relativePath: '', parsed: { title: '' }, size: 1, kind: 'tv', hasNfo: false, isProcessed: false })).toBe('Andor - S01E01.mkv')
    expect(getEpisodeCode({ path: '', name: '', relativePath: '', parsed: { title: '', season: 1, episode: 1, episodeEnd: 2 }, size: 1, kind: 'tv', hasNfo: false, isProcessed: false })).toBe('S01E01-E02')
  })

  test('formats rating and file size labels', () => {
    expect(formatVoteRating(7.64)).toBe('7.6')
    expect(formatVoteRatingWithScale(7.64)).toBe('7.6 / 10')
    expect(formatVoteRatingWithScale(undefined)).toBe('--')
    expect(formatFileSizeLabel(11.5 * 1024 * 1024 * 1024)).toBe('11.5 GB')
  })
})
