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

  async function doAutoMatch(file: MediaFile, kind: 'tv' | 'movie') {
    matchLoading.value = true
    try {
      const result = await autoMatch(file.path, kind, file.parsed.title, file.parsed.year)
      if (result?.candidates?.length) {
        candidates.value = result.candidates
        selectedCandidate.value = result.matched && result.result
          ? result.result
          : result.candidates[0] || null
      }
    }
    catch {
      // silent fail, user can manually search
    }
    finally {
      matchLoading.value = false
    }
  }

  async function doSearch(query: string, type: 'tv' | 'movie'): Promise<boolean> {
    if (!query.trim()) return false
    searching.value = true
    try {
      const results = await searchTMDB(type, query.trim())
      candidates.value = results
      selectedCandidate.value = results[0] || null
      return true
    }
    catch {
      return false
    }
    finally {
      searching.value = false
    }
  }

  function selectCandidate(candidate: SearchResult) {
    selectedCandidate.value = candidate
  }

  function reset() {
    candidates.value = []
    selectedCandidate.value = null
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
    reset,
  }
}
