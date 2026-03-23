import {
  getInboxSearchKeyword,
  inferCandidateMediaType,
} from '@media-scraper/shared'
import type {
  MediaFile,
  PathRecognizeResult,
  PreviewAction,
  PreviewPlan,
  RecognizeCandidate,
} from '@media-scraper/shared'
import { computed, ref, watch } from 'wevu'
import { previewPlan } from '@/utils/api'
import { normalizeText } from '@/utils/display'
import { getPosterUrl } from '@/utils/request'
import { useToast } from '@/hooks/useToast'
import { useMediaMatch } from '@/hooks/useMediaMatch'
import { processMedia } from '@/hooks/useMediaProcess'
import {
  getRecognizeCandidateId,
  resolveSelectedRecognizeCandidate,
  runInboxAiRecognize,
  selectInboxAiRecognizeCandidate,
} from './detail-actions'
import { useInboxTargetPreview } from './detail-preview'

export interface CandidateCard {
  id: number
  displayName: string
  displayYear: string
  posterUrl: string
  mediaType: 'tv' | 'movie'
}

export interface AiRecognizeCandidateCard {
  id: number
  tmdbId: number | null
  displayName: string
  mediaType: 'tv' | 'movie'
  yearText: string
  seasonEpisodeText: string
  confidenceText: string
  reason: string
  isPreferred: boolean
}

function sanitizeStepperValue(value: unknown, fallback: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.min(Math.floor(parsed), max)
}

export function useInboxFileDetail(options: {
  getVisible: () => boolean
  getFile: () => MediaFile | null
  emitClose: () => void
  emitProcessed: () => void
}) {
  const { showToast } = useToast()
  const {
    matchLoading,
    searching,
    candidates,
    selectedCandidate,
    lastError,
    doAutoMatch,
    doSearch,
    selectCandidate,
    cancelPending,
    reset: resetMatch,
  } = useMediaMatch()

  const currentFile = computed(() => options.getFile())
  const localVisible = ref(false)
  const processing = ref(false)
  const aiLoading = ref(false)
  const previewVisible = ref(false)
  const previewLoading = ref(false)
  const previewActions = ref<PreviewAction[]>([])
  const previewSummary = ref<PreviewPlan['impactSummary'] | null>(null)
  const searchQuery = ref('')
  const season = ref(1)
  const episode = ref(1)
  const aiResult = ref<PathRecognizeResult | null>(null)
  const selectedAiCandidateId = ref<number | null>(null)
  const aiHint = ref('')
  const autoMatchTried = ref(false)
  const targetPreviewPath = ref('')
  const targetPreviewLoading = ref(false)

  const candidateCards = computed<CandidateCard[]>(() =>
    candidates.value.map(candidate => ({
      id: candidate.id,
      displayName: normalizeText(candidate.name) || normalizeText(candidate.title) || '未知',
      displayYear: (candidate.releaseDate || candidate.firstAirDate || '').slice(0, 4),
      posterUrl: getPosterUrl(candidate.posterPath),
      mediaType: inferCandidateMediaType(candidate),
    })),
  )

  const aiRecognizeCandidates = computed<RecognizeCandidate[]>(() => aiResult.value?.recognize_candidates || [])

  const selectedAiRecognizeCandidate = computed<RecognizeCandidate | null>(() => {
    return resolveSelectedRecognizeCandidate(aiRecognizeCandidates.value, selectedAiCandidateId.value)
  })

  const aiCandidateCards = computed<AiRecognizeCandidateCard[]>(() =>
    aiRecognizeCandidates.value.map((candidate, index) => {
      const id = getRecognizeCandidateId(candidate, index + 1) || index + 1
      const seasonEpisodeText = candidate.media_type === 'tv' && (candidate.season || candidate.episode)
        ? `S${String(candidate.season || 1).padStart(2, '0')}E${String(candidate.episode || 1).padStart(2, '0')}`
        : ''
      return {
        id,
        tmdbId: candidate.tmdb_id,
        displayName: normalizeText(candidate.tmdb_name) || normalizeText(candidate.title) || '未知',
        mediaType: candidate.media_type === 'movie' ? 'movie' : 'tv',
        yearText: candidate.year ? String(candidate.year) : '',
        seasonEpisodeText,
        confidenceText: `${Math.round((candidate.confidence || 0) * 100)}%`,
        reason: normalizeText(candidate.reason),
        isPreferred: getRecognizeCandidateId(candidate) === (aiResult.value?.preferred_tmdb_id ?? aiResult.value?.tmdb_id ?? null),
      }
    }),
  )

  const {
    selectedMediaType,
    buildPreviewItem,
    resetTargetPreview,
    syncTvEpisodeByCandidate,
  } = useInboxTargetPreview({
    currentFile,
    selectedCandidate,
    aiResult,
    localVisible,
    season,
    episode,
    targetPreviewPath,
    targetPreviewLoading,
  })

  function resetPopupState() {
    processing.value = false
    aiLoading.value = false
    previewVisible.value = false
    previewLoading.value = false
    previewActions.value = []
    previewSummary.value = null
    searchQuery.value = ''
    season.value = 1
    episode.value = 1
    aiResult.value = null
    selectedAiCandidateId.value = null
    aiHint.value = ''
    autoMatchTried.value = false
    targetPreviewPath.value = ''
    targetPreviewLoading.value = false
    resetTargetPreview()
    resetMatch()
  }

  watch(() => options.getVisible(), (value) => {
    localVisible.value = value
  }, { immediate: true })

  async function handleAutoMatch(silent = false) {
    const file = currentFile.value
    if (matchLoading.value || searching.value || aiLoading.value || !file) return

    const ok = await doAutoMatch(
      file,
      searchQuery.value.trim() || undefined,
      file.parsed.year,
    )
    if (ok) {
      const currentId = selectedCandidate.value?.id
      const resolved = (currentId
        ? candidates.value.find(item => item.id === currentId)
        : null) || candidates.value[0] || null
      selectedCandidate.value = resolved
      syncTvEpisodeByCandidate(resolved, false)
    }
    autoMatchTried.value = true
    if (!ok && !silent) {
      showToast('未找到匹配结果', 'warning')
    }
  }

  async function handleManualSearch() {
    if (searching.value || matchLoading.value || aiLoading.value) return
    const query = searchQuery.value.trim()
    if (!query) {
      showToast('请输入搜索关键词', 'warning')
      return
    }

    const fileYear = currentFile.value?.parsed?.year
    const normalizedYear = typeof fileYear === 'number' && fileYear > 0 ? fileYear : undefined
    const ok = await doSearch(normalizedYear ? `${query} ${normalizedYear}` : query)
    if (!ok) {
      showToast(lastError.value || '搜索失败', 'error')
      return
    }

    const first = candidates.value[0] || null
    selectedCandidate.value = first
    syncTvEpisodeByCandidate(first, true)
    autoMatchTried.value = true
    if (!candidates.value.length) {
      showToast('未找到匹配结果', 'warning')
    }
  }

  async function handleAIRecognize() {
    const file = currentFile.value
    if (!file || aiLoading.value || searching.value || matchLoading.value) return
    await runInboxAiRecognize({
      file,
      searchQuery,
      aiResult,
      selectedAiCandidateId,
      aiHint,
      aiLoading,
      candidates,
      selectedCandidate,
      autoMatchTried,
      syncTvEpisodeByCandidate,
      showToast,
      cancelPending,
      season,
      episode,
      searching,
      matchLoading,
    })
  }

  async function handlePreviewPlan() {
    if (previewLoading.value || processing.value) return
    const item = buildPreviewItem()
    if (!item) {
      showToast('请先选择匹配结果', 'warning')
      return
    }

    previewVisible.value = true
    previewLoading.value = true
    previewActions.value = []
    previewSummary.value = null
    try {
      const plan = await previewPlan([item])
      previewActions.value = plan.actions || []
      previewSummary.value = plan.impactSummary || null
    }
    catch {
      showToast('预览失败', 'error')
    }
    finally {
      previewLoading.value = false
    }
  }

  async function handleProcess() {
    const file = currentFile.value
    if (!file || !selectedCandidate.value || processing.value) return

    processing.value = true
    try {
      const result = await processMedia({
        file,
        candidate: selectedCandidate.value,
        type: selectedMediaType.value,
        season: season.value,
        episode: episode.value,
      })
      if (result.success) {
        showToast('入库成功', 'success')
        wx.vibrateShort({ type: 'medium' })
        closePopup()
        options.emitProcessed()
      }
      else {
        showToast(result.message || '入库失败', 'error')
      }
    }
    catch {
      showToast('入库失败', 'error')
    }
    finally {
      processing.value = false
    }
  }

  function onVisibleChange(e: WechatMiniprogram.CustomEvent) {
    if (e?.detail?.visible === false && localVisible.value) {
      localVisible.value = false
      resetPopupState()
      options.emitClose()
    }
  }

  function onPreviewVisibleChange(visible: boolean) {
    previewVisible.value = visible
  }

  function onSearchInput(value: string) {
    searchQuery.value = value
  }

  function onSeasonChange(value: string) {
    season.value = sanitizeStepperValue(value, season.value, 99)
  }

  function onEpisodeChange(value: string) {
    episode.value = sanitizeStepperValue(value, episode.value, 999)
  }

  function closePopup() {
    localVisible.value = false
    resetPopupState()
    options.emitClose()
  }

  function onSelectCandidate(id: number) {
    const candidate = candidates.value.find(item => item.id === id)
    if (!candidate) return
    selectCandidate(candidate)
    syncTvEpisodeByCandidate(candidate, true)
  }

  async function onSelectAiCandidate(id: number) {
    if (!aiResult.value || aiLoading.value) return
    selectedAiCandidateId.value = id
    try {
      const candidate = await selectInboxAiRecognizeCandidate({
        result: aiResult.value,
        selectedId: id,
        candidates,
        selectedCandidate,
        searchQuery,
        season,
        episode,
        syncTvEpisodeByCandidate,
        autoMatchTried,
      })
      if (!candidate) selectedAiCandidateId.value = null
    }
    catch {
      showToast('切换 AI 候选失败', 'error')
    }
  }

  async function executeFromPreview() {
    if (previewLoading.value || !previewActions.value.length) return
    previewVisible.value = false
    await handleProcess()
  }

  function closePreview() {
    previewVisible.value = false
  }

  async function initForFile(file: MediaFile) {
    resetPopupState()
    searchQuery.value = getInboxSearchKeyword(file)
    season.value = file.parsed.season || 1
    episode.value = file.parsed.episode || 1
    await handleAutoMatch(true)
  }

  return {
    localVisible,
    processing,
    aiLoading,
    previewVisible,
    previewLoading,
    previewActions,
    previewSummary,
    searchQuery,
    season,
    episode,
    aiResult,
    aiHint,
    autoMatchTried,
    targetPreviewPath,
    targetPreviewLoading,
    matchLoading,
    searching,
    candidates,
    selectedCandidate,
    candidateCards,
    aiCandidateCards,
    selectedAiCandidateId,
    selectedMediaType,
    onVisibleChange,
    onPreviewVisibleChange,
    onSearchInput,
    onSeasonChange,
    onEpisodeChange,
    closePopup,
    onSelectCandidate,
    onSelectAiCandidate,
    handleAutoMatch,
    handleManualSearch,
    handleAIRecognize,
    handlePreviewPlan,
    handleProcess,
    executeFromPreview,
    closePreview,
    initForFile,
  }
}
