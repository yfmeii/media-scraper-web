<script setup lang="ts">
import { getSeasonMissingEpisodes, getShowMissingEpisodes } from '@media-scraper/shared/format'
import type { MediaFile, MovieInfo, SeasonInfo, SeasonMissingInfo, ShowInfo } from '@media-scraper/shared/types'
import { computed, ref, watch } from 'wevu'
import { moveToInbox, refreshMetadata } from '@/utils/api'
import { getPosterUrl } from '@/utils/request'
import { useToast } from '@/hooks/useToast'
import { useDialog } from '@/hooks/useDialog'
import DetailBody from './DetailBody.vue'
import ActionBar from './ActionBar.vue'

defineComponentJson({ styleIsolation: 'apply-shared' })

const props = defineProps<{
  visible: boolean
  movie?: MovieInfo | null
  show?: ShowInfo | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'refresh'): void
  (e: 'rematch', payload: { path: string, kind: 'movie' | 'tv', name: string }): void
}>()

const { showToast } = useToast()
const { confirm } = useDialog()

const expandedSeasons = ref<number[]>([])
const operationLoading = ref(false)
/** 本地可见状态，同步 prop 但可立即操作 */
const localVisible = ref(false)
/** 滚动距离，用于浮动顶栏效果 */
const scrollTop = ref(0)

/** 用于模板绑定：将展开的季号转为 Record 方便 v-if 使用 */
const expandedMap = computed<Record<number, boolean>>(() => {
  const map: Record<number, boolean> = {}
  for (const s of expandedSeasons.value) {
    map[s] = true
  }
  return map
})

/** 浮动顶栏透明度：滚动 120rpx 后完全不透明 */
const topBarOpacity = computed(() => Math.min(scrollTop.value / 60, 1))
/** 标题透明度：滚动 30px 后开始出现，80px 后完全显示 */
const titleOpacity = computed(() => Math.max(0, Math.min((scrollTop.value - 30) / 50, 1)))

function onScroll(e: { detail: { scrollTop: number } }) {
  scrollTop.value = e.detail.scrollTop
}

// Sync local visible with prop
watch(() => props.visible, (val) => {
  localVisible.value = val
  if (val) {
    expandedSeasons.value = []
    operationLoading.value = false
    scrollTop.value = 0
  }
})

// ── Computed ──
const posterUrl = computed(() => {
  if (props.movie) return getPosterUrl(props.movie.posterPath)
  if (props.show) return getPosterUrl(props.show.posterPath)
  return ''
})

const name = computed(() => props.movie?.name || props.show?.name || '')
const year = computed(() => props.movie?.year || props.show?.year)
const rating = computed(() => props.movie?.voteAverage || props.show?.voteAverage)
const overview = computed(() => props.movie?.overview || props.show?.overview || '')
const tmdbId = computed(() => props.movie?.tmdbId || props.show?.tmdbId)
const kind = computed<'movie' | 'tv'>(() => props.movie ? 'movie' : 'tv')
const path = computed(() => props.movie?.path || props.show?.path || '')
const hasNfo = computed(() => props.movie?.hasNfo || props.show?.hasNfo || false)
const assets = computed(() => props.movie?.assets || props.show?.assets)
const seasons = computed<SeasonInfo[]>(() => props.show?.seasons || [])
const totalEpisodes = computed(() => seasons.value.reduce((sum, s) => sum + s.episodes.length, 0))
const episodePathMap = computed<Record<string, MediaFile>>(() => {
  const map: Record<string, MediaFile> = {}
  for (const season of seasons.value) {
    for (const ep of season.episodes) {
      map[ep.path] = ep
    }
  }
  return map
})

/** 缺集信息，用于模板绑定 */
const missingEpisodes = computed<SeasonMissingInfo[]>(() => {
  if (!props.show) return []
  return getShowMissingEpisodes(props.show)
})

const totalMissingCount = computed(() =>
  missingEpisodes.value.reduce((sum, s) => sum + s.missing.length, 0),
)

/** 扁平化缺集列表，用于模板单层 v-for 水平排列 */
const flatMissingEpisodes = computed(() => {
  const result: Array<{ season: number; ep: number }> = []
  for (const item of missingEpisodes.value) {
    for (const ep of item.missing) {
      result.push({ season: item.season, ep })
    }
  }
  return result
})

/** 每季的缺集数量 Record，模板中用 seasonMissingMap[season.season] 访问 */
const seasonMissingMap = computed<Record<number, number[]>>(() => {
  if (!props.show) return {}
  const map: Record<number, number[]> = {}
  for (const season of props.show.seasons) {
    const missing = getSeasonMissingEpisodes(season.episodes)
    if (missing.length > 0) map[season.season] = missing
  }
  return map
})

// ── Season Toggle ──
function toggleSeason(season: number) {
  const idx = expandedSeasons.value.indexOf(season)
  if (idx >= 0) {
    expandedSeasons.value = expandedSeasons.value.filter(s => s !== season)
  }
  else {
    expandedSeasons.value = [...expandedSeasons.value, season]
  }
}

function onSeasonTap(e: WechatMiniprogram.CustomEvent) {
  const season = Number((e.currentTarget as { dataset?: { season?: number | string } })?.dataset?.season)
  if (!Number.isInteger(season)) return
  toggleSeason(season)
}

// getEpisodeLabel moved to format.wxs

// ── Actions ──
async function handleRefreshMetadata() {
  if (!tmdbId.value) {
    showToast('无 TMDB ID，请先匹配', 'warning')
    return
  }
  operationLoading.value = true
  try {
    const result = await refreshMetadata(kind.value, path.value, tmdbId.value)
    if (result.success) {
      showToast('刷新成功')
      localVisible.value = false
      emit('close')
      emit('refresh')
    }
    else {
      showToast(result.message || '刷新失败', 'error')
    }
  }
  catch {
    showToast('刷新失败', 'error')
  }
  finally {
    operationLoading.value = false
  }
}

function handleRematch() {
  localVisible.value = false
  emit('close')
  emit('rematch', {
    path: path.value,
    kind: kind.value,
    name: name.value,
  })
}

async function handleRefreshSeason(season: SeasonInfo) {
  const showTmdbId = props.show?.tmdbId
  if (!showTmdbId) {
    showToast('无 TMDB ID，请先匹配', 'warning')
    return
  }
  operationLoading.value = true
  try {
    const result = await refreshMetadata('tv', path.value, showTmdbId, { season: season.season })
    if (result.success) {
      showToast(`第 ${season.season} 季刷新成功`)
      emit('refresh')
    }
    else {
      showToast(result.message || '刷新失败', 'error')
    }
  }
  catch {
    showToast('刷新失败', 'error')
  }
  finally {
    operationLoading.value = false
  }
}

function onRefreshSeasonTap(e: WechatMiniprogram.CustomEvent) {
  const seasonNo = Number((e.currentTarget as { dataset?: { season?: number | string } })?.dataset?.season)
  if (!Number.isInteger(seasonNo)) return
  const season = seasons.value.find(item => item.season === seasonNo)
  if (!season) return
  handleRefreshSeason(season)
}

async function handleRefreshEpisode(season: number, episode: number) {
  const showTmdbId = props.show?.tmdbId
  if (!showTmdbId) {
    showToast('无 TMDB ID，请先匹配', 'warning')
    return
  }
  operationLoading.value = true
  try {
    const result = await refreshMetadata('tv', path.value, showTmdbId, { season, episode })
    if (result.success) {
      showToast(`S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')} 刷新成功`)
      emit('refresh')
    }
    else {
      showToast(result.message || '刷新失败', 'error')
    }
  }
  catch {
    showToast('刷新失败', 'error')
  }
  finally {
    operationLoading.value = false
  }
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
    if (result.success) {
      showToast('已移回收件箱')
      if (isMovie) {
        localVisible.value = false
        emit('close')
      }
      emit('refresh')
    }
    else {
      showToast(result.message || '操作失败', 'error')
    }
  }
  catch {
    showToast('操作失败', 'error')
  }
  finally {
    operationLoading.value = false
  }
}

async function onEpisodeTap(ep: MediaFile) {
  const hasTmdbId = !!props.show?.tmdbId
  const items: string[] = []
  const actions: (() => void)[] = []

  if (hasTmdbId && ep.parsed) {
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
  const path = (e.currentTarget as { dataset?: { path?: string } })?.dataset?.path
  if (!path) return
  const ep = episodePathMap.value[path]
  if (!ep) return
  onEpisodeTap(ep)
}

function onMoveMovieTap() {
  if (!props.movie) return
  handleMoveToInbox(props.movie.file.path, true)
}

function onVisibleChange(e: WechatMiniprogram.CustomEvent) {
  // Only handle overlay/gesture dismiss (localVisible still true).
  // Programmatic close (onClose/action handlers) already set localVisible=false, skip to avoid double emit.
  if (e?.detail?.visible === false && localVisible.value) {
    localVisible.value = false
    emit('close')
  }
}

function onClose() {
  localVisible.value = false
  operationLoading.value = false
  emit('close')
}
</script>

<template>
  <t-popup
    :visible="localVisible"
    placement="bottom"
    :close-on-overlay-click="true"
    @visible-change="onVisibleChange"
    style="--td-popup-bg-color: var(--color-background);"
  >
    <view class="bg-background relative" style="border-top-left-radius: 24rpx; border-top-right-radius: 24rpx;">
      <!-- Floating top bar: fades in on scroll -->
      <view
        class="absolute top-0 left-0 right-0"
        style="z-index: 10; height: 88rpx; border-top-left-radius: 24rpx; border-top-right-radius: 24rpx;"
      >
        <!-- Background layer with dynamic opacity -->
        <view
          class="absolute inset-0 bg-background"
          style="border-top-left-radius: 24rpx; border-top-right-radius: 24rpx;"
          :style="{ opacity: topBarOpacity }"
        />
        <!-- Content layer -->
        <view class="relative flex items-center justify-between px-3" style="height: 88rpx;">
          <text
            class="text-sm font-semibold text-foreground truncate flex-1 pl-1"
            :style="{ opacity: titleOpacity }"
          >{{ name }}</text>
          <view
            class="flex items-center justify-center rounded-full bg-card shrink-0"
            style="min-width: 60rpx; min-height: 60rpx;"
            hover-class="opacity-60"
            @tap="onClose"
          >
            <t-icon name="close" size="32rpx" color="var(--color-foreground)" />
          </view>
        </view>
      </view>

      <!-- Scrollable content -->
      <scroll-view scroll-y style="max-height: calc(85vh - 120rpx - env(safe-area-inset-bottom));" @scroll="onScroll">
        <DetailBody
          :movie="movie"
          :show="show"
          :poster-url="posterUrl"
          :name="name"
          :year="year"
          :rating="rating"
          :overview="overview"
          :tmdb-id="tmdbId"
          :has-nfo="hasNfo"
          :assets="assets"
          :seasons="seasons"
          :total-episodes="totalEpisodes"
          :missing-episodes="missingEpisodes"
          :total-missing-count="totalMissingCount"
          :flat-missing-episodes="flatMissingEpisodes"
          :season-missing-map="seasonMissingMap"
          :expanded-map="expandedMap"
          @season-tap="onSeasonTap"
          @refresh-season-tap="onRefreshSeasonTap"
          @episode-item-tap="onEpisodeItemTap"
        />
      </scroll-view>

      <!-- Action Buttons (always visible below scroll-view) -->
      <ActionBar :tmdb-id="tmdbId" :movie="movie" @refresh="handleRefreshMetadata" @rematch="handleRematch" @move-movie="onMoveMovieTap" />

      <!-- Loading overlay -->
      <view v-if="operationLoading" class="absolute inset-0 flex items-center justify-center bg-background/60" style="border-top-left-radius: 24rpx; border-top-right-radius: 24rpx;">
        <t-loading theme="circular" size="48rpx" />
      </view>
    </view>
  </t-popup>
</template>
