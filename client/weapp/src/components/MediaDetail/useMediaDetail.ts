import { getSeasonMissingEpisodes, getShowMissingEpisodes } from '@media-scraper/shared'
import type { MediaFile, MovieInfo, SeasonInfo, SeasonMissingInfo, ShowInfo } from '@media-scraper/shared'
import { computed, ref, watch } from 'wevu'
import { useDialog } from '@/hooks/useDialog'
import { useToast } from '@/hooks/useToast'
import { moveToInbox, refreshMetadata } from '@/utils/api'
import { normalizeText } from '@/utils/display'
import { getPosterUrl } from '@/utils/request'
import {
  buildEpisodePathMap,
  buildExpandedMap,
  buildFlatMissingEpisodes,
  getDatasetNumber,
  getDatasetPath,
  openEpisodeActionSheet,
  runMediaDetailRefresh,
  runMoveToInbox,
  toggleExpandedSeason,
} from './mediaDetailActions'

interface MediaDetailProps {
  visible: boolean
  movie?: MovieInfo | null
  show?: ShowInfo | null
}

export function useMediaDetail(options: {
  props: MediaDetailProps
  emitClose: () => void
  emitRefresh: () => void
  emitRematch: (payload: { path: string, kind: 'movie' | 'tv', name: string }) => void
}) {
  const { showToast } = useToast()
  const { confirm } = useDialog()
  const expandedSeasons = ref<number[]>([])
  const operationLoading = ref(false)
  const localVisible = ref(false)
  const scrollTop = ref(0)

  function resetDetailState() {
    expandedSeasons.value = []
    operationLoading.value = false
    scrollTop.value = 0
  }

  const expandedMap = computed<Record<number, boolean>>(() => buildExpandedMap(expandedSeasons.value))

  const topBarOpacity = computed(() => Math.min(scrollTop.value / 60, 1))
  const titleOpacity = computed(() => Math.max(0, Math.min((scrollTop.value - 30) / 50, 1)))

  const posterUrl = computed(() => {
    if (options.props.movie) return getPosterUrl(options.props.movie.posterPath)
    if (options.props.show) return getPosterUrl(options.props.show.posterPath)
    return ''
  })

  const name = computed(() =>
    normalizeText(options.props.movie?.name)
    || normalizeText(options.props.show?.name)
    || normalizeText(options.props.movie?.file?.name)
    || normalizeText(options.props.movie?.path?.split('/').pop())
    || normalizeText(options.props.show?.path?.split('/').pop())
    || '未命名媒体',
  )

  const year = computed(() => options.props.movie?.year || options.props.show?.year)
  const rating = computed(() => options.props.movie?.voteAverage || options.props.show?.voteAverage)
  const overview = computed(() => options.props.movie?.overview || options.props.show?.overview || '')
  const tmdbId = computed(() => options.props.movie?.tmdbId || options.props.show?.tmdbId)
  const kind = computed<'movie' | 'tv'>(() => options.props.movie ? 'movie' : 'tv')
  const path = computed(() => options.props.movie?.path || options.props.show?.path || '')
  const hasNfo = computed(() => options.props.movie?.hasNfo || options.props.show?.hasNfo || false)
  const assets = computed(() => options.props.movie?.assets || options.props.show?.assets)
  const seasons = computed<SeasonInfo[]>(() => options.props.show?.seasons || [])
  const totalEpisodes = computed(() => seasons.value.reduce((sum, season) => sum + season.episodes.length, 0))
  const episodePathMap = computed<Record<string, MediaFile>>(() => buildEpisodePathMap(seasons.value))

  const missingEpisodes = computed<SeasonMissingInfo[]>(() => {
    if (!options.props.show) return []
    return getShowMissingEpisodes(options.props.show)
  })

  const totalMissingCount = computed(() =>
    missingEpisodes.value.reduce((sum, season) => sum + season.missing.length, 0),
  )

  const flatMissingEpisodes = computed(() => buildFlatMissingEpisodes(missingEpisodes.value))

  const seasonMissingMap = computed<Record<number, number[]>>(() => {
    if (!options.props.show) return {}
    const map: Record<number, number[]> = {}
    for (const season of options.props.show.seasons) {
      const missing = getSeasonMissingEpisodes(season.episodes)
      if (missing.length > 0) map[season.season] = missing
    }
    return map
  })

  watch(() => options.props.visible, (visible) => {
    localVisible.value = visible
    if (visible) {
      resetDetailState()
    }
  }, { immediate: true })

  function closeDetail() {
    localVisible.value = false
    operationLoading.value = false
    options.emitClose()
  }

  function emitClosedRefresh() {
    closeDetail()
    options.emitRefresh()
  }

  function onScroll(e: { detail: { scrollTop: number } }) {
    scrollTop.value = e.detail.scrollTop
  }

  function toggleSeason(season: number) {
    expandedSeasons.value = toggleExpandedSeason(expandedSeasons.value, season)
  }

  function onSeasonTap(e: WechatMiniprogram.CustomEvent) {
    const season = getDatasetNumber(e, 'season')
    if (season === null) return
    toggleSeason(season)
  }

  async function runRefresh(params?: { season?: number, episode?: number }, successMessage?: string, closeAfterSuccess = false) {
    await runMediaDetailRefresh({
      tmdbId: tmdbId.value,
      kind: kind.value,
      path: path.value,
      params,
      successMessage,
      closeAfterSuccess,
      setLoading: value => (operationLoading.value = value),
      showToast,
      refreshMetadata,
      emitRefresh: options.emitRefresh,
      emitClosedRefresh,
    })
  }

  async function handleRefreshMetadata() {
    await runRefresh(undefined, '刷新成功', true)
  }

  function handleRematch() {
    localVisible.value = false
    options.emitClose()
    options.emitRematch({
      path: path.value,
      kind: kind.value,
      name: name.value,
    })
  }

  async function handleRefreshSeason(season: SeasonInfo) {
    await runRefresh({ season: season.season }, `第 ${season.season} 季刷新成功`)
  }

  function onRefreshSeasonTap(e: WechatMiniprogram.CustomEvent) {
    const seasonNo = getDatasetNumber(e, 'season')
    if (seasonNo === null) return
    const season = seasons.value.find(item => item.season === seasonNo)
    if (!season) return
    handleRefreshSeason(season)
  }

  async function handleRefreshEpisode(season: number, episode: number) {
    await runRefresh(
      { season, episode },
      `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')} 刷新成功`,
    )
  }

  async function handleMoveToInbox(sourcePath: string, isMovie = false) {
    await runMoveToInbox({
      sourcePath,
      isMovie,
      setLoading: value => (operationLoading.value = value),
      showToast,
      confirm,
      moveToInbox,
      closeDetail,
      emitRefresh: options.emitRefresh,
    })
  }

  async function onEpisodeTap(ep: MediaFile) {
    await openEpisodeActionSheet({
      episode: ep,
      showTmdbId: options.props.show?.tmdbId,
      onRefreshEpisode: (season, episode) => {
        void handleRefreshEpisode(season, episode)
      },
      onMoveToInbox: (sourcePath) => {
        void handleMoveToInbox(sourcePath)
      },
    })
  }

  function onEpisodeItemTap(e: WechatMiniprogram.CustomEvent) {
    const episodePath = getDatasetPath(e, 'path')
    if (!episodePath) return
    const episode = episodePathMap.value[episodePath]
    if (!episode) return
    void onEpisodeTap(episode)
  }

  function onMoveMovieTap() {
    if (!options.props.movie?.file) return
    void handleMoveToInbox(options.props.movie.file.path, true)
  }

  function onVisibleChange(e: WechatMiniprogram.CustomEvent) {
    if (e?.detail?.visible === false && localVisible.value) {
      localVisible.value = false
      options.emitClose()
    }
  }

  return {
    assets,
    expandedMap,
    flatMissingEpisodes,
    handleRefreshMetadata,
    handleRematch,
    hasNfo,
    localVisible,
    missingEpisodes,
    name,
    onClose: closeDetail,
    onEpisodeItemTap,
    onMoveMovieTap,
    onRefreshSeasonTap,
    onScroll,
    onSeasonTap,
    onVisibleChange,
    operationLoading,
    overview,
    path,
    posterUrl,
    rating,
    seasonMissingMap,
    seasons,
    titleOpacity,
    tmdbId,
    topBarOpacity,
    totalEpisodes,
    totalMissingCount,
    year,
  }
}
