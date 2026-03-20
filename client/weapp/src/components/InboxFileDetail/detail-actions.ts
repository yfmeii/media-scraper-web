import {
  buildAiRecognizeMessage,
  getInboxRecognizeInput,
  resolveRecognizeCandidates,
} from '@media-scraper/shared'
import type { MediaFile, SearchResult } from '@media-scraper/shared'
import { recognizePath, searchTMDB, searchTMDBByImdb } from '@/utils/api'

export async function runInboxAiRecognize(options: {
  file: MediaFile
  searchQuery: { value: string }
  aiResult: { value: any }
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
    options.searchQuery.value = result.tmdb_name || result.title || options.searchQuery.value
    options.aiHint.value = buildAiRecognizeMessage(result)

    if (result.season !== null && result.season > 0) options.season.value = result.season
    if (result.episode !== null && result.episode > 0) options.episode.value = result.episode

    const backendCandidates = result.candidates || []
    let imdbResults: SearchResult[] = []
    let nameResults: SearchResult[] = []
    if (!backendCandidates.length) {
      imdbResults = result.imdb_id ? await searchTMDBByImdb(result.imdb_id) : []
      nameResults = (result.tmdb_name || result.title) ? await searchTMDB(result.tmdb_name || result.title) : []
    }

    const resolved = resolveRecognizeCandidates(result, {
      backendCandidates,
      imdbResults,
      nameResults,
    })
    options.candidates.value = resolved.candidates
    options.selectedCandidate.value = resolved.selectedCandidate
    options.syncTvEpisodeByCandidate(resolved.selectedCandidate, true)
    options.autoMatchTried.value = true

    if (!resolved.candidates.length) options.showToast('未找到匹配结果', 'warning')
  }
  catch {
    options.showToast('AI 识别失败', 'error')
  }
  finally {
    options.aiLoading.value = false
  }
}
