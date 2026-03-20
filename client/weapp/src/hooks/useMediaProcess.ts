import type { MediaFile, SearchResult } from '@media-scraper/shared'
import { processMovie, processTV } from '@/utils/api'

export interface ProcessOptions {
  file: MediaFile
  candidate: SearchResult
  type: 'tv' | 'movie'
  season?: number
  episode?: number
}

export interface ProcessResult {
  success: boolean
  message?: string
}

/**
 * Unified media processing: handles both TV and movie processing via API.
 */
export async function processMedia(options: ProcessOptions): Promise<ProcessResult> {
  const { file, candidate, type, season = 1, episode = 1 } = options

  if (type === 'tv') {
    return processTV({
      sourcePath: file.path,
      tmdbId: candidate.id,
      showName: candidate.name || candidate.title || file.name,
      season,
      episodes: [{
        source: file.path,
        episode,
        episodeEnd: file.parsed.episodeEnd,
      }],
    })
  }
  else {
    return processMovie({
      sourcePath: file.path,
      tmdbId: candidate.id,
    })
  }
}
