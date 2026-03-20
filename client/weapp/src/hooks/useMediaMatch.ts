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
  let requestSeq = 0

  async function doAutoMatch(
    file: MediaFile,
    title?: string,
    year?: number,
  ): Promise<boolean> {
    const seq = ++requestSeq
    matchLoading.value = true
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
    catch {
      if (seq !== requestSeq) return false
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

  async function doSearch(query: string): Promise<boolean> {
    if (!query.trim()) return false
    const seq = ++requestSeq
    searching.value = true
    try {
      const results = await searchTMDB(query.trim())
      if (seq !== requestSeq) return false
      candidates.value = results
      selectedCandidate.value = null
      return true
    }
    catch {
      if (seq !== requestSeq) return false
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
  }

  function cancelPending() {
    requestSeq++
    matchLoading.value = false
    searching.value = false
  }

  return {
    matchLoading,
    searching,
    candidates,
    selectedCandidate,
    doAutoMatch,
    doSearch,
    selectCandidate,
    cancelPending,
    reset,
  }
}
