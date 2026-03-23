import {
  mapMatchResultToSelection,
} from '@media-scraper/shared'
import type { MediaFile, SearchResult } from '@media-scraper/shared'
import { ref } from 'wevu'
import { autoMatch, searchTMDB } from '@/utils/api'

/**
 * Composable for TMDB matching: auto-match and manual search.
 */
export function useMediaMatch() {
  const matchLoading = ref(false)
  const searching = ref(false)
  const candidates = ref<SearchResult[]>([])
  const selectedCandidate = ref<SearchResult | null>(null)
  const lastError = ref('')
  let requestSeq = 0

  async function doAutoMatch(
    file: MediaFile,
    title?: string,
    year?: number,
  ): Promise<boolean> {
    const seq = ++requestSeq
    matchLoading.value = true
    lastError.value = ''
    try {
      const result = await autoMatch(
        file.path,
        title || file.parsed.title,
        year || file.parsed.year,
      )
      if (seq !== requestSeq) return false

      const mapped = mapMatchResultToSelection(result)
      candidates.value = mapped.candidates
      selectedCandidate.value = mapped.selectedCandidate
      return mapped.candidates.length > 0
    }
    catch (error) {
      if (seq !== requestSeq) return false
      lastError.value = error instanceof Error ? error.message : '匹配失败'
      candidates.value = []
      selectedCandidate.value = null
      return false
    }
    finally {
      if (seq === requestSeq) {
        matchLoading.value = false
      }
    }
  }

  async function doSearch(query: string, type: 'tv' | 'movie' | 'multi' = 'multi'): Promise<boolean> {
    if (!query.trim()) return false
    const seq = ++requestSeq
    searching.value = true
    lastError.value = ''
    try {
      const results = type === 'multi'
        ? await searchTMDB(query.trim())
        : await searchTMDB(type, query.trim())
      if (seq !== requestSeq) return false
      candidates.value = results
      selectedCandidate.value = null
      return true
    }
    catch (error) {
      if (seq !== requestSeq) return false
      lastError.value = error instanceof Error ? error.message : '搜索失败'
      return false
    }
    finally {
      if (seq === requestSeq) {
        searching.value = false
      }
    }
  }

  function selectCandidate(candidate: SearchResult) {
    selectedCandidate.value = candidate
  }

  function reset() {
    requestSeq++
    candidates.value = []
    selectedCandidate.value = null
    matchLoading.value = false
    searching.value = false
    lastError.value = ''
  }

  function cancelPending() {
    requestSeq++
    matchLoading.value = false
    searching.value = false
    lastError.value = ''
  }

  return {
    matchLoading,
    searching,
    candidates,
    selectedCandidate,
    lastError,
    doAutoMatch,
    doSearch,
    selectCandidate,
    cancelPending,
    reset,
  }
}
