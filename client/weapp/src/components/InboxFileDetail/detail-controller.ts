import type {
  MediaFile,
  PreviewItem,
  PathRecognizeResult,
  PreviewAction,
  PreviewPlan,
  RecognizeCandidate,
  SearchResult,
} from '@media-scraper/shared'
import { getInboxSearchKeyword, inferCandidateMediaType } from '@media-scraper/shared'
import { previewPlan } from '@/utils/api'
import { normalizeText } from '@/utils/display'
import { getPosterUrl } from '@/utils/request'
import { processMedia } from '@/hooks/useMediaProcess'
import {
  getRecognizeCandidateId,
  selectInboxAiRecognizeCandidate,
} from './detail-actions'

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

export function sanitizeStepperValue(value: unknown, fallback: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.min(Math.floor(parsed), max)
}

export function toCandidateCard(candidate: SearchResult): CandidateCard {
  return {
    id: candidate.id,
    displayName: normalizeText(candidate.name) || normalizeText(candidate.title) || '未知',
    displayYear: (candidate.releaseDate || candidate.firstAirDate || '').slice(0, 4),
    posterUrl: getPosterUrl(candidate.posterPath),
    mediaType: inferCandidateMediaType(candidate),
  }
}

export function toAiCandidateCard(
  candidate: RecognizeCandidate,
  index: number,
  aiResult: PathRecognizeResult | null,
): AiRecognizeCandidateCard {
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
    isPreferred: getRecognizeCandidateId(candidate) === (aiResult?.preferred_tmdb_id ?? aiResult?.tmdb_id ?? null),
  }
}

export function resetInboxDetailState(options: {
  processing: { value: boolean }
  aiLoading: { value: boolean }
  previewVisible: { value: boolean }
  previewLoading: { value: boolean }
  previewActions: { value: PreviewAction[] }
  previewSummary: { value: PreviewPlan['impactSummary'] | null }
  searchQuery: { value: string }
  season: { value: number }
  episode: { value: number }
  aiResult: { value: PathRecognizeResult | null }
  selectedAiCandidateId: { value: number | null }
  aiHint: { value: string }
  autoMatchTried: { value: boolean }
  targetPreviewPath: { value: string }
  targetPreviewLoading: { value: boolean }
  resetTargetPreview: () => void
  resetMatch: () => void
}) {
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
}

export function applyAutoMatchResult(options: {
  ok: boolean
  candidates: { value: SearchResult[] }
  selectedCandidate: { value: SearchResult | null }
  syncTvEpisodeByCandidate: (candidate: SearchResult | null, preferAI?: boolean) => void
}) {
  if (!options.ok) return false
  const currentId = options.selectedCandidate.value?.id
  const resolved = (currentId
    ? options.candidates.value.find(item => item.id === currentId)
    : null) || options.candidates.value[0] || null
  options.selectedCandidate.value = resolved
  options.syncTvEpisodeByCandidate(resolved, false)
  return true
}

export async function handlePreviewPlanRequest(options: {
  previewLoading: { value: boolean }
  processing: { value: boolean }
  previewVisible: { value: boolean }
  previewActions: { value: PreviewAction[] }
  previewSummary: { value: PreviewPlan['impactSummary'] | null }
  buildPreviewItem: () => PreviewItem | null
  showToast: (message: string, theme?: 'success' | 'warning' | 'error' | 'default' | 'loading') => void
}) {
  if (options.previewLoading.value || options.processing.value) return

  const item = options.buildPreviewItem()
  if (!item) {
    options.showToast('请先选择匹配结果', 'warning')
    return
  }

  options.previewVisible.value = true
  options.previewLoading.value = true
  options.previewActions.value = []
  options.previewSummary.value = null

  try {
    const plan = await previewPlan([item])
    options.previewActions.value = plan.actions || []
    options.previewSummary.value = plan.impactSummary || null
  }
  catch {
    options.showToast('预览失败', 'error')
  }
  finally {
    options.previewLoading.value = false
  }
}

export async function handleProcessRequest(options: {
  file: MediaFile | null
  selectedCandidate: { value: SearchResult | null }
  processing: { value: boolean }
  selectedMediaType: { value: 'tv' | 'movie' }
  season: { value: number }
  episode: { value: number }
  showToast: (message: string, theme?: 'success' | 'warning' | 'error' | 'default' | 'loading') => void
  closePopup: () => void
  emitProcessed: () => void
}) {
  if (!options.file || !options.selectedCandidate.value || options.processing.value) return

  options.processing.value = true
  try {
    const result = await processMedia({
      file: options.file,
      candidate: options.selectedCandidate.value,
      type: options.selectedMediaType.value,
      season: options.season.value,
      episode: options.episode.value,
    })

    if (!result.success) {
      options.showToast(result.message || '入库失败', 'error')
      return
    }

    options.showToast('入库成功', 'success')
    wx.vibrateShort({ type: 'medium' })
    options.closePopup()
    options.emitProcessed()
  }
  catch {
    options.showToast('入库失败', 'error')
  }
  finally {
    options.processing.value = false
  }
}

export async function handleAiCandidateSelection(options: {
  aiResult: { value: PathRecognizeResult | null }
  aiLoading: { value: boolean }
  selectedAiCandidateId: { value: number | null }
  candidates: { value: SearchResult[] }
  selectedCandidate: { value: SearchResult | null }
  searchQuery: { value: string }
  season: { value: number }
  episode: { value: number }
  syncTvEpisodeByCandidate: (candidate: SearchResult | null, preferAI?: boolean) => void
  autoMatchTried: { value: boolean }
  showToast: (message: string, theme?: 'success' | 'warning' | 'error' | 'default' | 'loading') => void
  id: number
}) {
  if (!options.aiResult.value || options.aiLoading.value) return

  options.selectedAiCandidateId.value = options.id
  try {
    const candidate = await selectInboxAiRecognizeCandidate({
      result: options.aiResult.value,
      selectedId: options.id,
      candidates: options.candidates,
      selectedCandidate: options.selectedCandidate,
      searchQuery: options.searchQuery,
      season: options.season,
      episode: options.episode,
      syncTvEpisodeByCandidate: options.syncTvEpisodeByCandidate,
      autoMatchTried: options.autoMatchTried,
    })
    if (!candidate) options.selectedAiCandidateId.value = null
  }
  catch {
    options.showToast('切换 AI 候选失败', 'error')
  }
}

export function initializeInboxDetail(options: {
  file: MediaFile
  searchQuery: { value: string }
  season: { value: number }
  episode: { value: number }
  resetPopupState: () => void
  handleAutoMatch: (silent?: boolean) => Promise<void>
}) {
  options.resetPopupState()
  options.searchQuery.value = getInboxSearchKeyword(options.file)
  options.season.value = options.file.parsed.season || 1
  options.episode.value = options.file.parsed.episode || 1
  return options.handleAutoMatch(true)
}
