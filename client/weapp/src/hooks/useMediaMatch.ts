import type { MatchResult, MediaFile, SearchResult } from '@media-scraper/shared'
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

  function mapToSearchResult(
    item: {
      id: number
      name?: string
      title?: string
      date?: string
      releaseDate?: string
      firstAirDate?: string
      posterPath?: string
      overview?: string
    },
  ): SearchResult {
    const name = item.name || item.title || ''
    const date = item.releaseDate || item.firstAirDate || item.date
    return {
      id: item.id,
      name,
      title: name,
      posterPath: item.posterPath,
      overview: item.overview,
      releaseDate: date,
      firstAirDate: date,
    }
  }

  function pickMatchedResult(result: MatchResult, list: SearchResult[]): SearchResult | null {
    if (!result.matched || !result.result) return null
    const matched = list.find(item => item.id === result.result?.id)
    if (matched) return matched
    return mapToSearchResult({
      id: result.result.id,
      name: result.result.name,
      date: result.result.date,
      posterPath: result.result.posterPath,
    })
  }

  async function doAutoMatch(
    file: MediaFile,
    kind: 'tv' | 'movie',
    title?: string,
    year?: number,
  ): Promise<boolean> {
    matchLoading.value = true
    try {
      const result = await autoMatch(
        file.path,
        kind,
        title || file.parsed.title,
        year || file.parsed.year,
      )

      const mappedCandidates = (result?.candidates || []).map(item => mapToSearchResult({
        id: item.id,
        name: item.name,
        date: item.date,
        posterPath: item.posterPath,
        overview: item.overview,
      }))

      candidates.value = mappedCandidates
      selectedCandidate.value = pickMatchedResult(result, mappedCandidates) || mappedCandidates[0] || null
      return mappedCandidates.length > 0
    }
    catch {
      candidates.value = []
      selectedCandidate.value = null
      return false
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
