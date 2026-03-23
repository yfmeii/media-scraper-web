import type {
  MediaFile,
  PathRecognizeResult,
  PreviewAction,
  PreviewPlan,
  RecognizeCandidate,
} from '@media-scraper/shared'
import * as wevu from 'wevu'
import { useToast } from '@/hooks/useToast'
import { useMediaMatch } from '@/hooks/useMediaMatch'
import { runInboxAiRecognize } from './detail-actions'
import {
  type AiRecognizeCandidateCard,
  applyAutoMatchResult,
  type CandidateCard,
  handleAiCandidateSelection,
  handlePreviewPlanRequest,
  handleProcessRequest,
  initializeInboxDetail,
  resetInboxDetailState,
  sanitizeStepperValue,
  toAiCandidateCard,
  toCandidateCard,
} from './detail-controller'
import { useInboxTargetPreview } from './detail-preview'

export function useInboxFileDetail(options: {
  getVisible: () => boolean
  getFile: () => MediaFile | null
  emitClose: () => void
  emitProcessed: () => void
}) {
  type WatchFn = <T>(
    source: () => T,
    callback: (value: T) => void,
    options?: { immediate?: boolean },
  ) => void

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

  const computed = wevu.computed
  const ref = wevu.ref
  const watch: WatchFn = typeof wevu.watch === 'function'
    ? wevu.watch as WatchFn
    : (source, callback, options) => {
        if (options?.immediate) {
          callback(source())
        }
      }

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
    candidates.value.map(toCandidateCard),
  )

  const aiRecognizeCandidates = computed<RecognizeCandidate[]>(() => aiResult.value?.recognize_candidates || [])

  const aiCandidateCards = computed<AiRecognizeCandidateCard[]>(() =>
    aiRecognizeCandidates.value.map((candidate, index) => toAiCandidateCard(candidate, index, aiResult.value)),
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
    resetInboxDetailState({
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
      selectedAiCandidateId,
      aiHint,
      autoMatchTried,
      targetPreviewPath,
      targetPreviewLoading,
      resetTargetPreview,
      resetMatch,
    })
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
    applyAutoMatchResult({ ok, candidates, selectedCandidate, syncTvEpisodeByCandidate })
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
    await handlePreviewPlanRequest({
      previewLoading,
      processing,
      previewVisible,
      previewActions,
      previewSummary,
      buildPreviewItem,
      showToast,
    })
  }

  async function handleProcess() {
    await handleProcessRequest({
      file: currentFile.value,
      selectedCandidate,
      processing,
      selectedMediaType,
      season,
      episode,
      showToast,
      closePopup,
      emitProcessed: options.emitProcessed,
    })
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
    await handleAiCandidateSelection({
      aiResult,
      aiLoading,
      selectedAiCandidateId,
      candidates,
      selectedCandidate,
      searchQuery,
      season,
      episode,
      syncTvEpisodeByCandidate,
      autoMatchTried,
      showToast,
      id,
    })
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
    await initializeInboxDetail({
      file,
      searchQuery,
      season,
      episode,
      resetPopupState,
      handleAutoMatch,
    })
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
