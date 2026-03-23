import { beforeEach, describe, expect, mock, test } from 'bun:test'
import type { MediaFile, SearchResult } from '@media-scraper/shared'

const processTVMock = mock(async (...args: unknown[]) => processTVImpl(...args))
const processMovieMock = mock(async (...args: unknown[]) => processMovieImpl(...args))
const autoMatchMock = mock(async () => ({ matched: false, candidates: [] }))
const searchTMDBMock = mock(async () => [])

let processTVImpl: (...args: unknown[]) => Promise<{ success: boolean; message?: string }>
let processMovieImpl: (...args: unknown[]) => Promise<{ success: boolean; message?: string }>

mock.module('@/utils/api', () => ({
  processTV: processTVMock,
  processMovie: processMovieMock,
  autoMatch: autoMatchMock,
  searchTMDB: searchTMDBMock,
}))

const { processMedia } = await import('./useMediaProcess')

const baseFile: MediaFile = {
  path: '/inbox/Show.S01E03-E04.mkv',
  name: 'Show.S01E03-E04.mkv',
  relativePath: 'Show.S01E03-E04.mkv',
  size: 1,
  kind: 'tv',
  parsed: { title: 'Show', season: 1, episode: 3, episodeEnd: 4 },
  hasNfo: false,
  isProcessed: false,
}

describe('processMedia', () => {
  beforeEach(() => {
    processTVMock.mockClear()
    processMovieMock.mockClear()
    processTVImpl = async () => ({ success: true, message: 'tv ok' })
    processMovieImpl = async () => ({ success: true, message: 'movie ok' })
  })

  test('builds TV payload with defaults and forwards successful results', async () => {
    const candidate: SearchResult = { id: 42, name: 'Resolved Show', mediaType: 'tv' }

    await expect(processMedia({
      file: baseFile,
      candidate,
      type: 'tv',
    })).resolves.toEqual({ success: true, message: 'tv ok' })

    expect(processTVMock).toHaveBeenCalledWith({
      sourcePath: baseFile.path,
      tmdbId: 42,
      showName: 'Resolved Show',
      season: 1,
      episodes: [{
        source: baseFile.path,
        episode: 1,
        episodeEnd: 4,
      }],
    })
    expect(processMovieMock).not.toHaveBeenCalled()
  })

  test('uses explicit TV season/episode overrides and candidate title fallback', async () => {
    const candidate: SearchResult = { id: 7, title: 'Fallback Title', mediaType: 'tv' }

    await processMedia({
      file: baseFile,
      candidate,
      type: 'tv',
      season: 5,
      episode: 9,
    })

    expect(processTVMock).toHaveBeenCalledWith({
      sourcePath: baseFile.path,
      tmdbId: 7,
      showName: 'Fallback Title',
      season: 5,
      episodes: [{
        source: baseFile.path,
        episode: 9,
        episodeEnd: 4,
      }],
    })
  })

  test('builds movie payload and forwards failure results unchanged', async () => {
    processMovieImpl = async () => ({ success: false, message: 'movie failed' })
    const candidate: SearchResult = { id: 99, title: 'Movie Title', mediaType: 'movie' }

    await expect(processMedia({
      file: { ...baseFile, kind: 'movie', parsed: { title: 'Movie' } },
      candidate,
      type: 'movie',
    })).resolves.toEqual({ success: false, message: 'movie failed' })

    expect(processMovieMock).toHaveBeenCalledWith({
      sourcePath: baseFile.path,
      tmdbId: 99,
    })
    expect(processTVMock).not.toHaveBeenCalled()
  })
})
