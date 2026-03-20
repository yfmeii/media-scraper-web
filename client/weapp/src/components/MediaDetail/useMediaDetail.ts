import { getSeasonMissingEpisodes, getShowMissingEpisodes } from '@media-scraper/shared'
import type { MediaFile, MovieInfo, SeasonInfo, SeasonMissingInfo, ShowInfo } from '@media-scraper/shared'
import { computed, watch } from 'wevu'
import { useDialog } from '@/hooks/useDialog'
import { useToast } from '@/hooks/useToast'
import { moveToInbox, refreshMetadata } from '@/utils/api'
import { normalizeText } from '@/utils/display'
import { getPosterUrl } from '@/utils/request'
import { createMediaDetailState, resetMediaDetailState } from './detail-state'

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
  const state = createMediaDetailState()
  const { expandedSeasons, operationLoading, localVisible, scrollTop } = state

  const expandedMap = computed<Record<number, boolean>>(() => {
    const map: Record<number, boolean> = {}
    for (const season of expandedSeasons.value) {
      map[season] = true
    }
    return map
  })

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
  const episodePathMap = computed<Record<string, MediaFile>>(() => {
    const map: Record<string, MediaFile> = {}
    for (const season of seasons.value) {
      for (const ep of season.episodes) {
        map[ep.path] = ep
      }
    }
    return map
  })

  const missingEpisodes = computed<SeasonMissingInfo[]>(() => {
    if (!options.props.show) return []
    return getShowMissingEpisodes(options.props.show)
  })

  const totalMissingCount = computed(() =>
    missingEpisodes.value.reduce((sum, season) => sum + season.missing.length, 0),
  )

  const flatMissingEpisodes = computed(() => {
    const result: Array<{ season: number, ep: number }> = []
    for (const item of missingEpisodes.value) {
      for (const ep of item.missing) {
        result.push({ season: item.season, ep })
      }
    }
    return result
  })

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
      resetMediaDetailState(state)
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
    const exists = expandedSeasons.value.includes(season)
    expandedSeasons.value = exists
      ? expandedSeasons.value.filter(item => item !== season)
      : [...expandedSeasons.value, season]
  }

  function onSeasonTap(e: WechatMiniprogram.CustomEvent) {
    const season = Number((e.currentTarget as { dataset?: { season?: number | string } })?.dataset?.season)
    if (!Number.isInteger(season)) return
    toggleSeason(season)
  }

  async function runRefresh(params?: { season?: number, episode?: number }, successMessage?: string, closeAfterSuccess = false) {
    if (!tmdbId.value) {
      showToast('无 TMDB ID，请先匹配', 'warning')
      return
    }

    operationLoading.value = true
    try {
      const result = await refreshMetadata(kind.value, path.value, tmdbId.value, params)
      if (!result.success) {
        showToast(result.message || '刷新失败', 'error')
        return
      }

      showToast(successMessage || '刷新成功')
      if (closeAfterSuccess) {
        emitClosedRefresh()
      }
      else {
        options.emitRefresh()
      }
    }
    catch {
      showToast('刷新失败', 'error')
    }
    finally {
      operationLoading.value = false
    }
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
    const seasonNo = Number((e.currentTarget as { dataset?: { season?: number | string } })?.dataset?.season)
    if (!Number.isInteger(seasonNo)) return
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
    const label = isMovie ? '电影' : '集'
    const confirmed = await confirm({
      title: '移回收件箱',
      content: `将该${label}及关联字幕移回收件箱，并删除对应的 NFO 文件。确定继续？`,
      confirmBtn: '移回',
    })
    if (!confirmed) return

    operationLoading.value = true
    try {
      const result = await moveToInbox(sourcePath)
      if (!result.success) {
        showToast(result.message || '操作失败', 'error')
        return
      }

      showToast('已移回收件箱')
      if (isMovie) {
        closeDetail()
      }
      options.emitRefresh()
    }
    catch {
      showToast('操作失败', 'error')
    }
    finally {
      operationLoading.value = false
    }
  }

  async function onEpisodeTap(ep: MediaFile) {
    const items: string[] = []
    const actions: Array<() => void> = []

    if (options.props.show?.tmdbId && ep.parsed) {
      items.push('刷新元数据')
      actions.push(() => handleRefreshEpisode(ep.parsed.season || 0, ep.parsed.episode || 0))
    }

    items.push('移回收件箱')
    actions.push(() => handleMoveToInbox(ep.path))

    try {
      const res = await new Promise<WechatMiniprogram.ShowActionSheetSuccessCallbackResult>((resolve, reject) => {
        wx.showActionSheet({ itemList: items, success: resolve, fail: reject })
      })
      actions[res.tapIndex]?.()
    }
    catch {
      // user cancelled
    }
  }

  function onEpisodeItemTap(e: WechatMiniprogram.CustomEvent) {
    const episodePath = (e.currentTarget as { dataset?: { path?: string } })?.dataset?.path
    if (!episodePath) return
    const episode = episodePathMap.value[episodePath]
    if (!episode) return
    onEpisodeTap(episode)
  }

  function onMoveMovieTap() {
    if (!options.props.movie?.file) return
    handleMoveToInbox(options.props.movie.file.path, true)
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
