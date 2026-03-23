import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { MediaFile, SearchResult } from '@media-scraper/shared'

function ref<T>(value: T) {
  return { value }
}

function computed<T>(getter: () => T) {
  return {
    get value() {
      return getter()
    },
  }
}

const showToastMock = mock(() => {})
const doAutoMatchMock = mock(async (...args: unknown[]) => doAutoMatchImpl(...args))
const doSearchMock = mock(async (...args: unknown[]) => doSearchImpl(...args))
const selectCandidateMock = mock((candidate: SearchResult | null) => {
  mediaMatchState.selectedCandidate.value = candidate
})
const cancelPendingMock = mock(() => {})
const resetMatchMock = mock(() => {
  mediaMatchState.candidates.value = []
  mediaMatchState.selectedCandidate.value = null
})
const syncTvEpisodeByCandidateMock = mock(() => {})
const resetTargetPreviewMock = mock(() => {})
const buildPreviewItemMock = mock(() => ({ sourcePath: '/inbox/Andor.S01E01.mkv', kind: 'tv' as const }))
const applyAutoMatchResultMock = mock((options: {
  ok: boolean
  candidates: { value: SearchResult[] }
  selectedCandidate: { value: SearchResult | null }
  syncTvEpisodeByCandidate: (candidate: SearchResult | null, preferAI?: boolean) => void
}) => {
  if (!options.ok) return false
  const resolved = options.candidates.value[0] || null
  options.selectedCandidate.value = resolved
  options.syncTvEpisodeByCandidate(resolved, false)
  return true
})
const resetInboxDetailStateMock = mock((options: {
  processing: { value: boolean }
  aiLoading: { value: boolean }
  previewVisible: { value: boolean }
  previewLoading: { value: boolean }
  previewActions: { value: unknown[] }
  previewSummary: { value: unknown }
  searchQuery: { value: string }
  season: { value: number }
  episode: { value: number }
  aiResult: { value: unknown }
  selectedAiCandidateId: { value: number | null }
  aiHint: { value: string }
  autoMatchTried: { value: boolean }
  targetPreviewPath: { value: string }
  targetPreviewLoading: { value: boolean }
  resetTargetPreview: () => void
  resetMatch: () => void
}) => {
  options.processing.value = false
  options.aiLoading.value = false
  options.previewVisible.value = false
  options.previewLoading.value = false
  options.previewActions.value = []
  options.previewSummary.value = null
  options.searchQuery.value = ''
  options.season.value = 1
  options.episode.value = 1
  options.aiResult.value = null
  options.selectedAiCandidateId.value = null
  options.aiHint.value = ''
  options.autoMatchTried.value = false
  options.targetPreviewPath.value = ''
  options.targetPreviewLoading.value = false
  options.resetTargetPreview()
  options.resetMatch()
})
const handleAiCandidateSelectionMock = mock(async ({ id, selectedAiCandidateId }: {
  id: number
  selectedAiCandidateId: { value: number | null }
}) => {
  selectedAiCandidateId.value = id
})
const handlePreviewPlanRequestMock = mock(async () => {})
const handleProcessRequestMock = mock(async (_options: unknown) => {})
const initializeInboxDetailMock = mock(async ({ file, searchQuery, season, episode, handleAutoMatch }: {
  file: MediaFile
  searchQuery: { value: string }
  season: { value: number }
  episode: { value: number }
  handleAutoMatch: (silent?: boolean) => Promise<void>
}) => {
  searchQuery.value = file.parsed.title
  season.value = file.parsed.season || 1
  episode.value = file.parsed.episode || 1
  await handleAutoMatch(true)
})
const runInboxAiRecognizeMock = mock(async () => {})

let doAutoMatchImpl: (...args: unknown[]) => Promise<boolean>
let doSearchImpl: (...args: unknown[]) => Promise<boolean>
let mediaMatchState: ReturnType<typeof createMediaMatchState>
let previewState: ReturnType<typeof createPreviewState>

mock.module('@/hooks/useToast', () => ({
  useToast: () => ({ showToast: showToastMock }),
}))

mock.module('wevu', () => ({
  ref,
  computed,
}))

mock.module('@/hooks/useMediaMatch', () => ({
  useMediaMatch: () => mediaMatchState,
}))

mock.module('./detail-preview', () => ({
  useInboxTargetPreview: () => previewState,
}))

mock.module('./detail-actions', () => ({
  runInboxAiRecognize: runInboxAiRecognizeMock,
}))

mock.module('./detail-controller', () => ({
  applyAutoMatchResult: applyAutoMatchResultMock,
  handleAiCandidateSelection: handleAiCandidateSelectionMock,
  handlePreviewPlanRequest: handlePreviewPlanRequestMock,
  handleProcessRequest: handleProcessRequestMock,
  initializeInboxDetail: initializeInboxDetailMock,
  resetInboxDetailState: resetInboxDetailStateMock,
  sanitizeStepperValue: (value: unknown, fallback: number, max: number) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < 1) return fallback
    return Math.min(Math.floor(parsed), max)
  },
  toAiCandidateCard: (candidate: { tmdb_id?: number | null; tmdb_name?: string | null; media_type?: 'tv' | 'movie' }) => ({
    id: candidate.tmdb_id || 0,
    tmdbId: candidate.tmdb_id || null,
    displayName: candidate.tmdb_name || 'Unknown',
    mediaType: candidate.media_type === 'movie' ? 'movie' : 'tv',
    yearText: '',
    seasonEpisodeText: '',
    confidenceText: '0%',
    reason: '',
    isPreferred: false,
  }),
  toCandidateCard: (candidate: SearchResult) => ({
    id: candidate.id,
    displayName: candidate.name || candidate.title || 'Unknown',
    displayYear: '',
    posterUrl: '',
    mediaType: candidate.mediaType === 'movie' ? 'movie' : 'tv',
  }),
}))

const { useInboxFileDetail } = await import('./useInboxFileDetail')

afterAll(() => {
  mock.restore()
})

const baseFile: MediaFile = {
  path: '/inbox/Andor.S01E01.mkv',
  name: 'Andor.S01E01.mkv',
  relativePath: 'Andor.S01E01.mkv',
  size: 1,
  kind: 'tv',
  parsed: { title: 'Andor', year: 2022, season: 1, episode: 1 },
  hasNfo: false,
  isProcessed: false,
}

function createMediaMatchState() {
  return {
    matchLoading: ref(false),
    searching: ref(false),
    candidates: ref<SearchResult[]>([]),
    selectedCandidate: ref<SearchResult | null>(null),
    lastError: ref('search failed'),
    doAutoMatch: doAutoMatchMock,
    doSearch: doSearchMock,
    selectCandidate: selectCandidateMock,
    cancelPending: cancelPendingMock,
    reset: resetMatchMock,
  }
}

function createPreviewState() {
  return {
    selectedMediaType: ref<'tv' | 'movie'>('tv'),
    buildPreviewItem: buildPreviewItemMock,
    resetTargetPreview: resetTargetPreviewMock,
    syncTvEpisodeByCandidate: syncTvEpisodeByCandidateMock,
  }
}

function createHook(options?: { visible?: boolean; file?: MediaFile | null }) {
  let visible = options?.visible ?? true
  let file = options?.file ?? baseFile
  const emitClose = mock(() => {})
  const emitProcessed = mock(() => {})
  const hook = useInboxFileDetail({
    getVisible: () => visible,
    getFile: () => file,
    emitClose,
    emitProcessed,
  })

  return {
    hook,
    emitClose,
    emitProcessed,
    setVisible(value: boolean) {
      visible = value
    },
    setFile(value: MediaFile | null) {
      file = value
    },
  }
}

describe('useInboxFileDetail', () => {
  beforeEach(() => {
    doAutoMatchImpl = async () => true
    doSearchImpl = async () => true
    mediaMatchState = createMediaMatchState()
    previewState = createPreviewState()

    showToastMock.mockClear()
    doAutoMatchMock.mockClear()
    doSearchMock.mockClear()
    selectCandidateMock.mockClear()
    cancelPendingMock.mockClear()
    resetMatchMock.mockClear()
    syncTvEpisodeByCandidateMock.mockClear()
    resetTargetPreviewMock.mockClear()
    buildPreviewItemMock.mockClear()
    applyAutoMatchResultMock.mockClear()
    resetInboxDetailStateMock.mockClear()
    handleAiCandidateSelectionMock.mockClear()
    handlePreviewPlanRequestMock.mockClear()
    handleProcessRequestMock.mockClear()
    initializeInboxDetailMock.mockClear()
    runInboxAiRecognizeMock.mockClear()
  })

  test('warns when manual search is empty and skips API work', async () => {
    const { hook } = createHook()

    await hook.handleManualSearch()

    expect(showToastMock).toHaveBeenCalledWith('请输入搜索关键词', 'warning')
    expect(doSearchMock).not.toHaveBeenCalled()
  })

  test('manual search appends parsed year and selects the first candidate', async () => {
    doSearchImpl = async (query) => {
      expect(query).toBe('Cassian 2022')
      mediaMatchState.candidates.value = [{ id: 7, name: 'Andor', mediaType: 'tv' }]
      return true
    }

    const { hook } = createHook()
    hook.onSearchInput('  Cassian  ')
    await hook.handleManualSearch()

    expect(doSearchMock).toHaveBeenCalledTimes(1)
    expect(hook.selectedCandidate.value?.id).toBe(7)
    expect(syncTvEpisodeByCandidateMock).toHaveBeenCalledWith(mediaMatchState.candidates.value[0], true)
    expect(hook.autoMatchTried.value).toBe(true)
  })

  test('auto match uses the trimmed override query and syncs the resolved candidate', async () => {
    mediaMatchState.candidates.value = [{ id: 9, name: 'Andor', mediaType: 'tv' }]

    const { hook } = createHook()
    hook.onSearchInput('  Rogue One  ')
    await hook.handleAutoMatch()

    expect(doAutoMatchMock).toHaveBeenCalledWith(baseFile, 'Rogue One', 2022)
    expect(applyAutoMatchResultMock).toHaveBeenCalledTimes(1)
    expect(hook.selectedCandidate.value?.id).toBe(9)
    expect(syncTvEpisodeByCandidateMock).toHaveBeenCalledWith(mediaMatchState.candidates.value[0], false)
    expect(hook.autoMatchTried.value).toBe(true)
  })

  test('closePopup resets local state and emits close once', () => {
    const { hook, emitClose } = createHook()
    hook.onSearchInput('Pending')
    hook.onSeasonChange('4')
    hook.onEpisodeChange('8')
    hook.previewVisible.value = true
    hook.autoMatchTried.value = true

    hook.closePopup()

    expect(hook.localVisible.value).toBe(false)
    expect(hook.searchQuery.value).toBe('')
    expect(hook.season.value).toBe(1)
    expect(hook.episode.value).toBe(1)
    expect(hook.previewVisible.value).toBe(false)
    expect(hook.autoMatchTried.value).toBe(false)
    expect(resetTargetPreviewMock).toHaveBeenCalledTimes(1)
    expect(resetMatchMock).toHaveBeenCalledTimes(1)
    expect(emitClose).toHaveBeenCalledTimes(1)
  })

  test('handleProcess forwards the active file state and helper callbacks', async () => {
    mediaMatchState.selectedCandidate.value = { id: 18, name: 'Andor', mediaType: 'tv' }
    handleProcessRequestMock.mockImplementationOnce(async (options: {
      closePopup: () => void
      emitProcessed: () => void
      file: MediaFile | null
      season: { value: number }
      episode: { value: number }
      selectedCandidate: { value: SearchResult | null }
    }) => {
      expect(options.file?.path).toBe(baseFile.path)
      expect(options.selectedCandidate.value?.id).toBe(18)
      expect(options.season.value).toBe(1)
      expect(options.episode.value).toBe(1)
      options.closePopup()
      options.emitProcessed()
    })

    const { hook, emitClose, emitProcessed } = createHook()
    await hook.handleProcess()

    expect(handleProcessRequestMock).toHaveBeenCalledTimes(1)
    expect(emitClose).toHaveBeenCalledTimes(1)
    expect(emitProcessed).toHaveBeenCalledTimes(1)
    expect(hook.localVisible.value).toBe(false)
  })

  test('initForFile seeds the form from the file and triggers silent auto match', async () => {
    const file = { ...baseFile, parsed: { ...baseFile.parsed, season: 2, episode: 5 } }
    const { hook } = createHook({ file })

    await hook.initForFile(file)

    expect(initializeInboxDetailMock).toHaveBeenCalledTimes(1)
    expect(hook.searchQuery.value).toBe('Andor')
    expect(hook.season.value).toBe(2)
    expect(hook.episode.value).toBe(5)
    expect(doAutoMatchMock).toHaveBeenCalledWith(file, 'Andor', 2022)
  })
})
