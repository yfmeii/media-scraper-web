import type { PathRecognizeResult, PreviewAction, PreviewPlan } from '@media-scraper/shared'
import { ref } from 'wevu'

export function createInboxDetailState() {
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
  const aiHint = ref('')
  const autoMatchTried = ref(false)
  const targetPreviewPath = ref('')
  const targetPreviewLoading = ref(false)

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
  }
}

export function resetInboxDetailState(state: ReturnType<typeof createInboxDetailState>) {
  state.processing.value = false
  state.aiLoading.value = false
  state.previewVisible.value = false
  state.previewLoading.value = false
  state.previewActions.value = []
  state.previewSummary.value = null
  state.searchQuery.value = ''
  state.season.value = 1
  state.episode.value = 1
  state.aiResult.value = null
  state.aiHint.value = ''
  state.autoMatchTried.value = false
  state.targetPreviewPath.value = ''
  state.targetPreviewLoading.value = false
}
