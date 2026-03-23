import {
  buildAiRecognizeMessage,
  getPreferredRecognizeCandidate,
  getInboxRecognizeInput,
  resolveRecognizeCandidates,
} from '@media-scraper/shared'
import type { MediaFile, PathRecognizeResult, RecognizeCandidate, SearchResult } from '@media-scraper/shared'
import { recognizePath, searchTMDB, searchTMDBByImdb } from '@/utils/api'

export function getRecognizeCandidateId(candidate: RecognizeCandidate, fallbackIndex?: number) {
  return candidate.preferred_tmdb_id ?? candidate.tmdb_id ?? fallbackIndex ?? null
}

export function resolveSelectedRecognizeCandidate(candidates: RecognizeCandidate[], selectedId: number | null) {
  if (!candidates.length) return null
  if (selectedId === null) return candidates[0] || null
  return candidates.find(candidate => getRecognizeCandidateId(candidate) === selectedId || candidate.tmdb_id === selectedId) || candidates[0] || null
}

function getRecognizeQuery(result: PathRecognizeResult, candidate: RecognizeCandidate | null) {
  return candidate?.tmdb_name || candidate?.title || result.tmdb_name || result.title || ''
}

function applyRecognizeCandidateDefaults(options: {
  result: PathRecognizeResult
  candidate: RecognizeCandidate | null
  searchQuery: { value: string }
  season: { value: number }
  episode: { value: number }
}) {
  options.searchQuery.value = getRecognizeQuery(options.result, options.candidate) || options.searchQuery.value

  const season = options.candidate?.season ?? options.result.season
  const episode = options.candidate?.episode ?? options.result.episode
  if (season !== null && season && season > 0) options.season.value = season
  if (episode !== null && episode && episode > 0) options.episode.value = episode
}

export async function resolveInboxAiRecognizeSelection(options: {
  result: PathRecognizeResult
  selectedAiCandidate: RecognizeCandidate | null
  candidates: { value: SearchResult[] }
  selectedCandidate: { value: SearchResult | null }
  searchQuery: { value: string }
  season: { value: number }
  episode: { value: number }
  syncTvEpisodeByCandidate: (candidate: SearchResult | null, preferAI?: boolean) => void
  autoMatchTried: { value: boolean }
}) {
  applyRecognizeCandidateDefaults(options)

  const backendCandidates = options.selectedAiCandidate?.candidates || options.result.candidates || []
  let imdbResults: SearchResult[] = []
  let nameResults: SearchResult[] = []
  if (!backendCandidates.length) {
    imdbResults = options.result.imdb_id ? await searchTMDBByImdb(options.result.imdb_id) : []
    const recognizeQuery = getRecognizeQuery(options.result, options.selectedAiCandidate)
    nameResults = recognizeQuery ? await searchTMDB(recognizeQuery) : []
  }

  const resolved = resolveRecognizeCandidates(options.result, {
    backendCandidates,
    imdbResults,
    nameResults,
    preferredId: options.selectedAiCandidate?.preferred_tmdb_id ?? options.selectedAiCandidate?.tmdb_id ?? undefined,
  })
  options.candidates.value = resolved.candidates
  options.selectedCandidate.value = resolved.selectedCandidate
  options.syncTvEpisodeByCandidate(resolved.selectedCandidate, true)
  options.autoMatchTried.value = true
  return resolved
}

export async function selectInboxAiRecognizeCandidate(options: {
  result: PathRecognizeResult
  selectedId: number
  candidates: { value: SearchResult[] }
  selectedCandidate: { value: SearchResult | null }
  searchQuery: { value: string }
  season: { value: number }
  episode: { value: number }
  syncTvEpisodeByCandidate: (candidate: SearchResult | null, preferAI?: boolean) => void
  autoMatchTried: { value: boolean }
}) {
  const selectedAiCandidate = resolveSelectedRecognizeCandidate(options.result.recognize_candidates || [], options.selectedId)
  if (!selectedAiCandidate) return null
  await resolveInboxAiRecognizeSelection({
    result: options.result,
    selectedAiCandidate,
    candidates: options.candidates,
    selectedCandidate: options.selectedCandidate,
    searchQuery: options.searchQuery,
    season: options.season,
    episode: options.episode,
    syncTvEpisodeByCandidate: options.syncTvEpisodeByCandidate,
    autoMatchTried: options.autoMatchTried,
  })
  return selectedAiCandidate
}

export async function runInboxAiRecognize(options: {
  file: MediaFile
  searchQuery: { value: string }
  aiResult: { value: any }
  selectedAiCandidateId: { value: number | null }
  aiHint: { value: string }
  aiLoading: { value: boolean }
  candidates: { value: SearchResult[] }
  selectedCandidate: { value: SearchResult | null }
  autoMatchTried: { value: boolean }
  syncTvEpisodeByCandidate: (candidate: SearchResult | null, preferAI?: boolean) => void
  showToast: (message: string, theme?: 'success' | 'warning' | 'error' | 'default' | 'loading') => void
  cancelPending: () => void
  season: { value: number }
  episode: { value: number }
  searching: { value: boolean }
  matchLoading: { value: boolean }
}) {
  if (options.aiLoading.value || options.searching.value || options.matchLoading.value) return

  options.cancelPending()
  options.aiLoading.value = true
  options.aiResult.value = null
  options.aiHint.value = ''

  try {
    const recognizeInput = getInboxRecognizeInput(options.file)
    const result = await recognizePath(recognizeInput)
    if (!result || (!result.tmdb_id && !result.imdb_id)) {
      options.showToast('AI 识别失败', 'warning')
      return
    }

    options.aiResult.value = result
    const preferredRecognizeCandidate = getPreferredRecognizeCandidate(result)
    options.selectedAiCandidateId.value = preferredRecognizeCandidate
      ? getRecognizeCandidateId(preferredRecognizeCandidate)
      : null
    options.aiHint.value = buildAiRecognizeMessage(result)

    const resolved = await resolveInboxAiRecognizeSelection({
      result,
      selectedAiCandidate: preferredRecognizeCandidate,
      candidates: options.candidates,
      selectedCandidate: options.selectedCandidate,
      searchQuery: options.searchQuery,
      season: options.season,
      episode: options.episode,
      syncTvEpisodeByCandidate: options.syncTvEpisodeByCandidate,
      autoMatchTried: options.autoMatchTried,
    })

    if (!resolved.candidates.length) options.showToast('未找到匹配结果', 'warning')
  }
  catch {
    options.showToast('AI 识别失败', 'error')
  }
  finally {
    options.aiLoading.value = false
  }
}
