import type { MediaFile, SeasonInfo } from '@media-scraper/shared'

interface RefreshArgs {
  tmdbId?: number | null
  kind: 'movie' | 'tv'
  path: string
  params?: { season?: number, episode?: number }
  successMessage?: string
  closeAfterSuccess?: boolean
  setLoading: (value: boolean) => void
  showToast: (message: string, theme?: 'success' | 'warning' | 'error') => void
  refreshMetadata: typeof import('@/utils/api').refreshMetadata
  emitRefresh: () => void
  emitClosedRefresh: () => void
}

interface MoveToInboxArgs {
  sourcePath: string
  isMovie?: boolean
  setLoading: (value: boolean) => void
  showToast: (message: string, theme?: 'success' | 'warning' | 'error') => void
  confirm: typeof import('@/hooks/useDialog').useDialog extends () => infer T
    ? T extends { confirm: infer F } ? F : never
    : never
  moveToInbox: typeof import('@/utils/api').moveToInbox
  closeDetail: () => void
  emitRefresh: () => void
}

interface EpisodeActionArgs {
  episode: MediaFile
  showTmdbId?: number | null
  onRefreshEpisode: (season: number, episode: number) => void
  onMoveToInbox: (sourcePath: string) => void
}

export function buildExpandedMap(expandedSeasons: number[]): Record<number, boolean> {
  const map: Record<number, boolean> = {}
  for (const season of expandedSeasons) {
    map[season] = true
  }
  return map
}

export function buildEpisodePathMap(seasons: SeasonInfo[]): Record<string, MediaFile> {
  const map: Record<string, MediaFile> = {}
  for (const season of seasons) {
    for (const episode of season.episodes) {
      map[episode.path] = episode
    }
  }
  return map
}

export function buildFlatMissingEpisodes(items: Array<{ season: number, missing: number[] }>) {
  const result: Array<{ season: number, ep: number }> = []
  for (const item of items) {
    for (const episode of item.missing) {
      result.push({ season: item.season, ep: episode })
    }
  }
  return result
}

export function toggleExpandedSeason(expandedSeasons: number[], season: number) {
  return expandedSeasons.includes(season)
    ? expandedSeasons.filter(item => item !== season)
    : [...expandedSeasons, season]
}

export function getDatasetNumber(e: WechatMiniprogram.CustomEvent, key: string) {
  const value = (e.currentTarget as { dataset?: Record<string, number | string | undefined> })?.dataset?.[key]
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

export function getDatasetPath(e: WechatMiniprogram.CustomEvent, key: string) {
  const value = (e.currentTarget as { dataset?: Record<string, string | undefined> })?.dataset?.[key]
  return typeof value === 'string' && value ? value : null
}

export async function runMediaDetailRefresh(args: RefreshArgs) {
  if (!args.tmdbId) {
    args.showToast('无 TMDB ID，请先匹配', 'warning')
    return
  }

  args.setLoading(true)
  try {
    const result = await args.refreshMetadata(args.kind, args.path, args.tmdbId, args.params)
    if (!result.success) {
      args.showToast(result.message || '刷新失败', 'error')
      return
    }

    args.showToast(args.successMessage || '刷新成功')
    if (args.closeAfterSuccess) {
      args.emitClosedRefresh()
      return
    }

    args.emitRefresh()
  }
  catch {
    args.showToast('刷新失败', 'error')
  }
  finally {
    args.setLoading(false)
  }
}

export async function runMoveToInbox(args: MoveToInboxArgs) {
  const label = args.isMovie ? '电影' : '集'
  const confirmed = await args.confirm({
    title: '移回收件箱',
    content: `将该${label}及关联字幕移回收件箱，并删除对应的 NFO 文件。确定继续？`,
    confirmBtn: '移回',
  })
  if (!confirmed) return

  args.setLoading(true)
  try {
    const result = await args.moveToInbox(args.sourcePath)
    if (!result.success) {
      args.showToast(result.message || '操作失败', 'error')
      return
    }

    args.showToast('已移回收件箱')
    if (args.isMovie) {
      args.closeDetail()
    }
    args.emitRefresh()
  }
  catch {
    args.showToast('操作失败', 'error')
  }
  finally {
    args.setLoading(false)
  }
}

export async function openEpisodeActionSheet(args: EpisodeActionArgs) {
  const items: string[] = []
  const actions: Array<() => void> = []

  if (args.showTmdbId && args.episode.parsed) {
    items.push('刷新元数据')
    actions.push(() => args.onRefreshEpisode(args.episode.parsed?.season || 0, args.episode.parsed?.episode || 0))
  }

  items.push('移回收件箱')
  actions.push(() => args.onMoveToInbox(args.episode.path))

  try {
    const res = await new Promise<WechatMiniprogram.ShowActionSheetSuccessCallbackResult>((resolve, reject) => {
      wx.showActionSheet({ itemList: items, success: resolve, fail: reject })
    })
    actions[res.tapIndex]?.()
  }
  catch {
    return
  }
}
