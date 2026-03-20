import { buildPreviewItemFromSelection, extractPreviewTargetPath, inferCandidateMediaType } from '@media-scraper/shared'
import type { MediaFile, PreviewItem, SearchResult } from '@media-scraper/shared'
import { computed, watch } from 'wevu'
import { previewPlan } from '@/utils/api'

function toPositiveInt(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return null
  return Math.floor(parsed)
}

export function useInboxTargetPreview(options: {
  currentFile: ReturnType<typeof computed<MediaFile | null>>
  selectedCandidate: { value: SearchResult | null }
  aiResult: { value: { media_type?: 'tv' | 'movie', season?: number | null, episode?: number | null } | null }
  localVisible: { value: boolean }
  season: { value: number }
  episode: { value: number }
  targetPreviewPath: { value: string }
  targetPreviewLoading: { value: boolean }
}) {
  const selectedMediaType = computed<'tv' | 'movie'>(() => {
    const mediaType = options.selectedCandidate.value?.mediaType
    if (mediaType === 'tv' || mediaType === 'movie') return mediaType
    const aiType = options.aiResult.value?.media_type
    if (aiType === 'tv' || aiType === 'movie') return aiType
    if (options.currentFile.value?.parsed.season || options.currentFile.value?.parsed.episode) return 'tv'
    return 'movie'
  })

  function buildPreviewItem(): PreviewItem | null {
    const file = options.currentFile.value
    if (!file || !options.selectedCandidate.value) return null
    return buildPreviewItemFromSelection({
      file,
      candidate: options.selectedCandidate.value,
      season: options.season.value,
      episode: options.episode.value,
      fallbackKind: selectedMediaType.value,
    })
  }

  let targetPreviewSeq = 0

  async function refreshTargetPreviewPath() {
    const item = buildPreviewItem()
    if (!item || !options.localVisible.value) {
      options.targetPreviewPath.value = ''
      options.targetPreviewLoading.value = false
      return
    }

    const currentSeq = ++targetPreviewSeq
    options.targetPreviewLoading.value = true
    try {
      const plan = await previewPlan([item])
      if (currentSeq !== targetPreviewSeq) return
      options.targetPreviewPath.value = extractPreviewTargetPath(plan, item.sourcePath)
    }
    catch {
      if (currentSeq !== targetPreviewSeq) return
      options.targetPreviewPath.value = ''
    }
    finally {
      if (currentSeq === targetPreviewSeq) options.targetPreviewLoading.value = false
    }
  }

  function resetTargetPreview() {
    options.targetPreviewPath.value = ''
    options.targetPreviewLoading.value = false
    targetPreviewSeq++
  }

  function syncTvEpisodeByCandidate(
    candidate: { mediaType?: 'tv' | 'movie' } | null,
    preferAI = false,
  ) {
    if (!candidate || inferCandidateMediaType(candidate) !== 'tv') return

    const file = options.currentFile.value
    const aiSeason = toPositiveInt(options.aiResult.value?.season)
    const aiEpisode = toPositiveInt(options.aiResult.value?.episode)
    const parsedSeason = toPositiveInt(file?.parsed.season)
    const parsedEpisode = toPositiveInt(file?.parsed.episode)

    options.season.value = preferAI
      ? (aiSeason || parsedSeason || options.season.value || 1)
      : (parsedSeason || aiSeason || options.season.value || 1)
    options.episode.value = preferAI
      ? (aiEpisode || parsedEpisode || options.episode.value || 1)
      : (parsedEpisode || aiEpisode || options.episode.value || 1)
  }

  watch(
    () => `${options.localVisible.value ? 1 : 0}|${options.currentFile.value?.path || ''}|${options.selectedCandidate.value?.id || ''}|${selectedMediaType.value}|${options.season.value}|${options.episode.value}`,
    () => {
      if (!options.localVisible.value) return
      void refreshTargetPreviewPath()
    },
  )

  return {
    selectedMediaType,
    buildPreviewItem,
    refreshTargetPreviewPath,
    resetTargetPreview,
    syncTvEpisodeByCandidate,
  }
}
