import { beforeEach, describe, expect, mock, test } from 'bun:test'
import type { MatchResult, MediaFile, SearchResult } from '@media-scraper/shared'

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const autoMatchMock = mock(async (...args: unknown[]) => autoMatchImpl(...args))
const searchTMDBMock = mock(async (...args: unknown[]) => searchTMDBImpl(...args))
const processTVMock = mock(async () => ({ success: true }))
const processMovieMock = mock(async () => ({ success: true }))

let autoMatchImpl: (...args: unknown[]) => Promise<MatchResult>
let searchTMDBImpl: (...args: unknown[]) => Promise<SearchResult[]>

mock.module('@/utils/api', () => ({
  autoMatch: autoMatchMock,
  searchTMDB: searchTMDBMock,
  processTV: processTVMock,
  processMovie: processMovieMock,
}))

const { useMediaMatch } = await import('./useMediaMatch')

const file: MediaFile = {
  path: '/inbox/Andor.S01E01.mkv',
  name: 'Andor.S01E01.mkv',
  relativePath: 'Andor.S01E01.mkv',
  size: 1,
  kind: 'tv',
  parsed: { title: 'Andor', year: 2022, season: 1, episode: 1 },
  hasNfo: false,
  isProcessed: false,
}

describe('useMediaMatch', () => {
  beforeEach(() => {
    autoMatchMock.mockClear()
    searchTMDBMock.mockClear()
    autoMatchImpl = async () => ({ matched: false, candidates: [] })
    searchTMDBImpl = async () => []
  })

  test('tracks auto-match loading and maps selected candidates on success', async () => {
    const pending = deferred<MatchResult>()
    autoMatchImpl = async () => pending.promise

    const match = useMediaMatch()
    const resultPromise = match.doAutoMatch(file)

    expect(match.matchLoading.value).toBe(true)
    expect(autoMatchMock).toHaveBeenCalledWith(file.path, 'Andor', 2022)

    pending.resolve({
      matched: true,
      result: {
        id: 77,
        name: 'Andor',
        mediaType: 'tv',
        date: '2022-09-21',
        score: 0.98,
      },
      candidates: [{
        id: 77,
        name: 'Andor',
        mediaType: 'tv',
        date: '2022-09-21',
        overview: 'Rebel spy story',
      }],
    })

    await expect(resultPromise).resolves.toBe(true)
    expect(match.matchLoading.value).toBe(false)
    expect(match.candidates.value).toHaveLength(1)
    expect(match.selectedCandidate.value?.id).toBe(77)
    expect(match.selectedCandidate.value?.firstAirDate).toBe('2022-09-21')
  })

  test('ignores stale auto-match responses when a newer request wins', async () => {
    const first = deferred<MatchResult>()
    const second = deferred<MatchResult>()
    let callCount = 0
    autoMatchImpl = async () => (++callCount === 1 ? first.promise : second.promise)

    const match = useMediaMatch()
    const firstPromise = match.doAutoMatch(file, 'Old Title', 2021)
    const secondPromise = match.doAutoMatch(file, 'New Title', 2022)

    second.resolve({
      matched: true,
      result: {
        id: 2,
        name: 'New Title',
        mediaType: 'tv',
        date: '2022-01-01',
        score: 0.95,
      },
      candidates: [{ id: 2, name: 'New Title', mediaType: 'tv', date: '2022-01-01' }],
    })

    await expect(secondPromise).resolves.toBe(true)
    expect(match.selectedCandidate.value?.id).toBe(2)
    expect(match.matchLoading.value).toBe(false)

    first.resolve({
      matched: true,
      result: {
        id: 1,
        name: 'Old Title',
        mediaType: 'tv',
        date: '2021-01-01',
        score: 0.5,
      },
      candidates: [{ id: 1, name: 'Old Title', mediaType: 'tv', date: '2021-01-01' }],
    })

    await expect(firstPromise).resolves.toBe(false)
    expect(match.selectedCandidate.value?.id).toBe(2)
    expect(match.candidates.value[0]?.id).toBe(2)
  })

  test('preserves prior search results when a search request fails', async () => {
    searchTMDBImpl = async () => [{ id: 10, name: 'Existing Result', mediaType: 'movie' }]

    const match = useMediaMatch()
    await expect(match.doSearch('  Existing Result  ')).resolves.toBe(true)
    expect(match.searching.value).toBe(false)
    expect(match.candidates.value[0]?.id).toBe(10)

    const failure = deferred<SearchResult[]>()
    searchTMDBImpl = async () => failure.promise

    const failedSearch = match.doSearch('Replacement')
    expect(match.searching.value).toBe(true)
    failure.reject(new Error('network'))

    await expect(failedSearch).resolves.toBe(false)
    expect(match.searching.value).toBe(false)
    expect(match.lastError.value).toBe('network')
    expect(match.candidates.value[0]?.id).toBe(10)
    expect(match.selectedCandidate.value).toBeNull()
  })

  test('supports default multi manual search requests', async () => {
    searchTMDBImpl = async () => [{ id: 40, name: 'Andor', mediaType: 'tv' }]

    const match = useMediaMatch()
    await expect(match.doSearch('Andor')).resolves.toBe(true)

    expect(searchTMDBMock).toHaveBeenCalledWith('Andor')
    expect(match.candidates.value[0]?.id).toBe(40)
  })

  test('reset clears state and invalidates in-flight requests', async () => {
    searchTMDBImpl = async () => [{ id: 20, name: 'Filled State', mediaType: 'movie' }]

    const match = useMediaMatch()
    await match.doSearch('Filled State')
    match.selectCandidate(match.candidates.value[0]!)

    const pending = deferred<SearchResult[]>()
    searchTMDBImpl = async () => pending.promise
    const searchPromise = match.doSearch('Pending')

    match.reset()
    expect(match.candidates.value).toEqual([])
    expect(match.selectedCandidate.value).toBeNull()
    expect(match.searching.value).toBe(false)
    expect(match.matchLoading.value).toBe(false)

    pending.resolve([{ id: 99, name: 'Stale Result', mediaType: 'movie' }])

    await expect(searchPromise).resolves.toBe(false)
    expect(match.candidates.value).toEqual([])
    expect(match.selectedCandidate.value).toBeNull()
  })

  test('cancelPending stops loading without discarding existing candidates', async () => {
    searchTMDBImpl = async () => [{ id: 31, name: 'Settled Result', mediaType: 'movie' }]

    const match = useMediaMatch()
    await match.doSearch('Settled Result')

    const pending = deferred<MatchResult>()
    autoMatchImpl = async () => pending.promise
    const autoMatchPromise = match.doAutoMatch(file)

    expect(match.matchLoading.value).toBe(true)
    match.cancelPending()
    expect(match.matchLoading.value).toBe(false)
    expect(match.candidates.value[0]?.id).toBe(31)

    pending.resolve({
      matched: true,
      result: {
        id: 88,
        name: 'Should Be Ignored',
        mediaType: 'tv',
        date: '2022-01-01',
        score: 0.9,
      },
      candidates: [{ id: 88, name: 'Should Be Ignored', mediaType: 'tv', date: '2022-01-01' }],
    })

    await expect(autoMatchPromise).resolves.toBe(false)
    expect(match.candidates.value[0]?.id).toBe(31)
    expect(match.selectedCandidate.value).toBeNull()
  })
})
