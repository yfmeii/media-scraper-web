<script setup lang="ts">
import type { MediaFile, MovieInfo, SeasonInfo, SeasonMissingInfo, ShowInfo } from '@media-scraper/shared'
import { getSeasonMissingEpisodes, getShowMissingEpisodes } from '@media-scraper/shared'
import { computed, ref, watch } from 'wevu'
import { moveToInbox, refreshMetadata } from '@/utils/api'
import { getPosterUrl } from '@/utils/request'
import { useToast } from '@/hooks/useToast'
import { useDialog } from '@/hooks/useDialog'
import MediaPoster from '@/components/MediaPoster/index.vue'

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

/** 缺集信息，用于模板绑定 */
const missingEpisodes = computed<SeasonMissingInfo[]>(() => {
  if (!props.show) return []
  return getShowMissingEpisodes(props.show)
})

const totalMissingCount = computed(() =>
  missingEpisodes.value.reduce((sum, s) => sum + s.missing.length, 0),
)

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
      if (isMovie) emit('close')
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

function onVisibleChange(e: WechatMiniprogram.CustomEvent) {
  if (e && e.detail && !e.detail.visible) {
    localVisible.value = false
    emit('close')
  }
}

function onClose() {
  localVisible.value = false
  emit('close')
}
</script>

<template>
  <wxs module="fmt" src="../../utils/format.wxs" />

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
        <!-- Spacer for floating top bar -->
        <view style="height: 88rpx;" />
        <!-- Header: Poster + Info -->
        <view class="px-4 pb-3 flex gap-3">
          <MediaPoster
            :src="posterUrl"
            width="200rpx"
            height="280rpx"
            class="shrink-0"
          />
          <view class="flex-1 py-1">
            <view class="text-base font-semibold text-foreground">{{ name }}</view>
            <!-- Meta info line -->
            <view class="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <text v-if="year">{{ year }}</text>
              <text v-if="year && (movie || show)"> · </text>
              <text v-if="movie && movie.runtime">{{ movie.runtime }} 分钟</text>
              <text v-if="show">{{ seasons.length }} 季 · {{ totalEpisodes }} 集</text>
            </view>
            <view v-if="rating" class="mt-1.5 flex items-center gap-1">
              <t-icon name="star-filled" size="28rpx" color="var(--color-warning)" />
              <text class="text-sm font-medium text-foreground">{{ fmt.formatRating(rating) }}</text>
            </view>
            <!-- Status badges -->
            <view class="mt-2 flex flex-wrap gap-1.5">
              <view
                class="rounded-lg px-1.5 py-0.5 text-xs"
                :class="hasNfo ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'"
              >{{ hasNfo ? '已刮削' : '未刮削' }}</view>
              <view v-if="assets" class="flex gap-1">
                <view
                  class="rounded-lg px-1.5 py-0.5 text-xs"
                  :class="assets.hasPoster ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'"
                >海报</view>
                <view
                  class="rounded-lg px-1.5 py-0.5 text-xs"
                  :class="assets.hasFanart ? 'bg-purple-100 text-purple-700' : 'bg-muted text-muted-foreground'"
                >背景</view>
              </view>
            </view>
            <view v-if="tmdbId" class="mt-1.5 text-xs text-muted-foreground">
              TMDB: {{ tmdbId }}
            </view>
          </view>
        </view>

        <!-- Overview -->
        <view v-if="overview" class="px-4 pb-3">
          <view class="text-xs text-muted-foreground leading-relaxed">{{ overview }}</view>
        </view>

        <!-- Movie file info -->
        <view v-if="movie" class="px-4 pb-3">
          <view class="rounded-xl bg-card p-3">
            <view class="text-xs font-medium text-foreground mb-1.5">文件信息</view>
            <view class="text-xs text-muted-foreground">{{ movie.file.name }}</view>
            <view v-if="movie.file.parsed.resolution" class="mt-1 flex flex-wrap gap-1.5">
              <view v-if="movie.file.parsed.resolution" class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {{ movie.file.parsed.resolution }}
              </view>
              <view v-if="movie.file.parsed.codec" class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {{ movie.file.parsed.codec }}
              </view>
              <view v-if="movie.file.parsed.source" class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {{ movie.file.parsed.source }}
              </view>
            </view>
            <view class="mt-1 text-xs text-muted-foreground">{{ fmt.formatFileSize(movie.file.size) }}</view>
          </view>
        </view>

        <!-- Missing Episodes -->
        <view v-if="show && missingEpisodes.length > 0" class="px-4 pb-3">
          <view class="rounded-xl border border-warning/40 bg-warning/5 p-3">
            <view class="flex items-center gap-1.5 mb-2">
              <t-icon name="error-circle" size="28rpx" color="var(--color-warning)" />
              <text class="text-xs font-medium text-warning">共缺 {{ totalMissingCount }} 集</text>
            </view>
            <view class="flex flex-wrap gap-1">
              <view
                v-for="item in missingEpisodes"
                :key="item.season"
              >
                <view
                  v-for="ep in item.missing"
                  :key="ep"
                  class="rounded bg-warning/10 px-1.5 py-0.5 text-xs text-warning"
                >{{ fmt.formatEpisodeCode(item.season, ep) }}</view>
              </view>
            </view>
          </view>
        </view>

        <!-- TV Seasons/Episodes -->
        <view v-if="show && seasons.length > 0" class="px-4 pb-3">
          <view class="rounded-xl bg-card overflow-hidden">
            <view v-for="(season, sIdx) in seasons" :key="season.season">
              <!-- Season Header -->
              <view
                class="flex items-center justify-between px-3 py-2.5"
                hover-class="opacity-70"
                @tap="() => toggleSeason(season.season)"
              >
                <view class="flex items-center gap-2">
                  <t-icon
                    :name="expandedMap[season.season] ? 'chevron-down' : 'chevron-right'"
                    size="32rpx"
                    color="var(--color-muted-foreground)"
                  />
                  <text class="text-sm font-medium text-foreground">第 {{ season.season }} 季</text>
                  <text class="text-xs text-muted-foreground">{{ season.episodes.length }} 集</text>
                  <view
                    v-if="seasonMissingMap[season.season]"
                    class="rounded bg-warning/10 px-1 py-0.5 text-xs text-warning"
                  >缺 {{ seasonMissingMap[season.season].length }}</view>
                </view>
                <view class="flex items-center gap-2">
                  <view
                    v-if="show.tmdbId"
                    class="flex items-center justify-center"
                    hover-class="opacity-50"
                    @tap.stop="() => handleRefreshSeason(season)"
                  >
                    <t-icon name="refresh" size="32rpx" color="var(--color-muted-foreground)" />
                  </view>
                </view>
              </view>

              <!-- Episodes (expanded) -->
              <view v-if="expandedMap[season.season]">
                <view v-for="ep in season.episodes" :key="ep.path">
                  <view class="h-px bg-border mx-3" />
                  <view
                    class="flex items-center justify-between px-3 py-2"
                    hover-class="bg-muted/50"
                    @tap.stop="() => onEpisodeTap(ep)"
                  >
                    <view class="flex-1 min-w-0">
                      <view class="flex items-center gap-1.5">
                        <text class="text-xs font-medium text-foreground">{{ fmt.getEpisodeLabel(ep) }}</text>
                        <view
                          v-if="ep.hasNfo"
                          class="h-1.5 w-1.5 rounded-full bg-green-500"
                        />
                        <view v-else class="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                      </view>
                      <view class="mt-0.5 text-xs text-muted-foreground truncate">{{ ep.name }}</view>
                      <view v-if="ep.parsed && (ep.parsed.resolution || ep.size)" class="mt-0.5 flex items-center gap-1">
                        <text v-if="ep.parsed.resolution" class="text-xs text-muted-foreground/60">{{ ep.parsed.resolution }}</text>
                        <text v-if="ep.size" class="text-xs text-muted-foreground/60">{{ fmt.formatFileSize(ep.size) }}</text>
                      </view>
                    </view>
                    <t-icon name="chevron-right" size="28rpx" color="var(--color-muted-foreground)" class="ml-2 shrink-0" />
                  </view>
                </view>
              </view>

              <view v-if="sIdx < seasons.length - 1" class="h-px bg-border" />
            </view>
          </view>
        </view>

      </scroll-view>

      <!-- Action Buttons (always visible below scroll-view) -->
      <view class="bg-background px-4 pt-2 pb-2">
        <view class="flex gap-2">
          <view
            v-if="tmdbId"
            class="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-primary"
            hover-class="opacity-80"
            @tap="handleRefreshMetadata"
          >
            <t-icon name="refresh" size="32rpx" color="#fff" />
            <text class="text-sm font-medium text-primary-foreground">刷新元数据</text>
          </view>
          <view
            class="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-card"
            hover-class="opacity-70"
            @tap="handleRematch"
          >
            <t-icon name="search" size="32rpx" color="var(--color-foreground)" />
            <text class="text-sm font-medium text-foreground">{{ tmdbId ? '重新匹配' : '匹配' }}</text>
          </view>
        </view>
        <!-- Movie: move to inbox -->
        <view
          v-if="movie"
          class="mt-2 flex items-center justify-center gap-1 py-2.5 rounded-xl border border-destructive/30"
          hover-class="bg-destructive/5"
          @tap="() => { if (movie) handleMoveToInbox(movie.file.path, true) }"
        >
          <t-icon name="inbox" size="32rpx" color="var(--color-destructive)" />
          <text class="text-sm font-medium text-destructive">移回收件箱</text>
        </view>
      </view>

      <!-- Loading overlay -->
      <view v-if="operationLoading" class="absolute inset-0 flex items-center justify-center bg-background/60" style="border-top-left-radius: 24rpx; border-top-right-radius: 24rpx;">
        <t-loading theme="circular" size="48rpx" />
      </view>
    </view>
  </t-popup>

  <t-toast id="t-toast" />
</template>
