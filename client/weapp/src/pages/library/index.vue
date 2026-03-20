<script setup lang="ts">
import { getShowMissingEpisodes } from '@media-scraper/shared'
import type { MovieInfo, ShowInfo } from '@media-scraper/shared'
import { computed, onShow, ref } from 'wevu'
import { fetchMovies, fetchTVShows } from '@/utils/api'
import { formatVoteRating, getMovieDisplayName, getShowDisplayName } from '@/utils/display'
import { getPosterUrl } from '@/utils/request'
import { useTabStore } from '@/stores/tab'
import { useToast } from '@/hooks/useToast'
import EmptyState from '@/components/EmptyState/index.vue'
import TabBar from '@/components/TabBar/index.vue'
import MediaPoster from '@/components/MediaPoster/index.vue'
import MediaDetail from '@/components/MediaDetail/index.vue'

definePageJson({ disableScroll: true })

const tabStore = useTabStore()
const { showToast } = useToast()
const refreshing = ref(false)

const swiperCurrent = ref(0)
const movies = ref<MovieInfo[]>([])
const tvShows = ref<ShowInfo[]>([])
const loading = ref(true)
const viewMode = ref<'grid' | 'list'>('grid')
const searchKeyword = ref('')

// ── Detail State ──
const detailVisible = ref(false)
const detailMovie = ref<MovieInfo | null>(null)
const detailShow = ref<ShowInfo | null>(null)

interface DisplayMovie extends MovieInfo {
  posterUrl: string
  displayName: string
  displayRating: string
}

interface DisplayShow extends ShowInfo {
  posterUrl: string
  supplementBadge: string
  displayName: string
  displayRating: string
}

const filteredMovies = computed<DisplayMovie[]>(() => {
  const list = searchKeyword.value
    ? movies.value.filter(m => getMovieDisplayName(m).toLowerCase().includes(searchKeyword.value.toLowerCase()))
    : movies.value
  return list.map(m => ({
    ...m,
    posterUrl: getPosterUrl(m.posterPath),
    displayName: getMovieDisplayName(m),
    displayRating: formatVoteRating(m.voteAverage),
  }))
})

const filteredShows = computed<DisplayShow[]>(() => {
  const list = searchKeyword.value
    ? tvShows.value.filter(s => getShowDisplayName(s).toLowerCase().includes(searchKeyword.value.toLowerCase()))
    : tvShows.value
  return list.map(s => {
    const missingInfo = getShowMissingEpisodes(s)
    const missingCount = missingInfo.reduce((sum, item) => sum + item.missing.length, 0)
    return {
      ...s,
      posterUrl: getPosterUrl(s.posterPath),
      supplementBadge: missingCount > 0 ? `缺${missingCount}集` : '',
      displayName: getShowDisplayName(s),
      displayRating: formatVoteRating(s.voteAverage),
    }
  })
})

async function loadLibrary() {
  loading.value = true
  try {
    const [m, t] = await Promise.all([fetchMovies(), fetchTVShows()])
    movies.value = m
    tvShows.value = t
  }
  catch {
    showToast('加载失败', 'error')
  }
  finally {
    loading.value = false
  }
}

// Initial data load (runs once during setup)
loadLibrary()

onShow(() => {
  tabStore.setActive(2)
})

async function onRefresh() {
  refreshing.value = true
  try {
    await loadLibrary()
  }
  finally {
    refreshing.value = false
  }
}

function switchTab(tab: 'movie' | 'tv') {
  swiperCurrent.value = tab === 'movie' ? 0 : 1
}

const activeTabIndex = computed(() => swiperCurrent.value)

const movieTabStyle = computed(() =>
  swiperCurrent.value === 0
    ? 'background: var(--color-primary); color: var(--color-primary-foreground); box-shadow: 0 6rpx 20rpx rgba(124,58,237,0.22); border: 1rpx solid var(--color-primary);'
    : 'background: var(--color-card); color: var(--color-muted-foreground); border: 1rpx solid var(--color-border);',
)

const tvTabStyle = computed(() =>
  swiperCurrent.value === 1
    ? 'background: var(--color-primary); color: var(--color-primary-foreground); box-shadow: 0 6rpx 20rpx rgba(124,58,237,0.22); border: 1rpx solid var(--color-primary);'
    : 'background: var(--color-card); color: var(--color-muted-foreground); border: 1rpx solid var(--color-border);',
)

function onSwitchTabTap(e: WechatMiniprogram.CustomEvent) {
  const tab = (e.currentTarget as { dataset?: { tab?: string } })?.dataset?.tab
  if (tab === 'movie' || tab === 'tv') {
    switchTab(tab)
  }
}

function onSwiperChange(e: WechatMiniprogram.CustomEvent<{ current?: number }>) {
  const current = Number(e.detail?.current)
  if (!Number.isInteger(current)) return
  if (current !== 0 && current !== 1) return
  swiperCurrent.value = current
}

function onSwiperAnimationFinish(e: WechatMiniprogram.CustomEvent<{ current?: number }>) {
  const current = Number(e.detail?.current)
  if (!Number.isInteger(current)) return
  if (current !== 0 && current !== 1) return
  swiperCurrent.value = current
}

function toggleView() {
  viewMode.value = viewMode.value === 'grid' ? 'list' : 'grid'
  showToast(viewMode.value === 'grid' ? '已切换为海报模式' : '已切换为列表模式')
}

function onSearch(e: WechatMiniprogram.CustomEvent) {
  searchKeyword.value = e.detail.value || ''
}

// ── Detail Popup ──
function openMovieDetail(movie: MovieInfo) {
  detailMovie.value = movie
  detailShow.value = null
  detailVisible.value = true
}

function onOpenMovieDetailTap(e: WechatMiniprogram.CustomEvent) {
  const index = Number((e.currentTarget as { dataset?: { index?: number | string } })?.dataset?.index)
  if (!Number.isInteger(index) || index < 0 || index >= filteredMovies.value.length) return
  openMovieDetail(filteredMovies.value[index])
}

function openShowDetail(show: ShowInfo) {
  detailShow.value = show
  detailMovie.value = null
  detailVisible.value = true
}

function onOpenShowDetailTap(e: WechatMiniprogram.CustomEvent) {
  const index = Number((e.currentTarget as { dataset?: { index?: number | string } })?.dataset?.index)
  if (!Number.isInteger(index) || index < 0 || index >= filteredShows.value.length) return
  openShowDetail(filteredShows.value[index])
}

function closeDetail() {
  detailVisible.value = false
  detailMovie.value = null
  detailShow.value = null
}

async function onDetailRefresh() {
  await loadLibrary()
  // Update the detail data if still open
  if (detailMovie.value) {
    const updated = movies.value.find(m => m.path === detailMovie.value?.path)
    if (updated) detailMovie.value = updated
    else closeDetail()
  }
  if (detailShow.value) {
    const updated = tvShows.value.find(s => s.path === detailShow.value?.path)
    if (updated) detailShow.value = updated
    else closeDetail()
  }
}

function onRematch(e: WechatMiniprogram.CustomEvent<{ path: string, kind: 'movie' | 'tv', name: string }>) {
  const detail = e.detail
  if (!detail || !detail.path || !detail.kind) return
  wx.navigateTo({
    url: `/pages/match/index?path=${encodeURIComponent(detail.path)}&kind=${detail.kind}&name=${encodeURIComponent(detail.name || '')}&mode=rematch`,
  })
}


</script>

<template>
  <view style="height: 100vh; display: flex; flex-direction: column; overflow: hidden;">
    <t-navbar title="媒体库" :fixed="false" />

    <!-- Search Bar -->
    <view class="bg-background px-4 pt-2 pb-2">
      <view class="flex items-center gap-2">
        <view class="flex-1">
          <t-search :value="searchKeyword" placeholder="搜索媒体..." shape="square" @change="onSearch" />
        </view>
        <view
          class="shrink-0 flex items-center gap-1.5 rounded-xl bg-card px-3"
          style="height: var(--td-search-height, 80rpx);"
          hover-class="opacity-70"
          @tap="toggleView"
        >
          <t-icon :name="viewMode === 'grid' ? 'view-list' : 'view-module'" size="40rpx" />
          <text class="text-xs text-muted-foreground">{{ viewMode === 'grid' ? '列表' : '海报' }}</text>
        </view>
      </view>
    </view>

    <!-- Tab Switcher -->
    <view class="bg-background px-4 py-1">
      <view class="flex gap-2">
        <view
          class="flex-1 py-2 text-center text-sm font-medium rounded-xl"
          :style="movieTabStyle"
          hover-class="opacity-80 active-scale"
          data-tab="movie"
          @tap="onSwitchTabTap"
        >电影 ({{ movies.length }})</view>
        <view
          class="flex-1 py-2 text-center text-sm font-medium rounded-xl"
          :style="tvTabStyle"
          hover-class="opacity-80 active-scale"
          data-tab="tv"
          @tap="onSwitchTabTap"
        >剧集 ({{ tvShows.length }})</view>
      </view>
    </view>

    <!-- Content (swiper + scrollable) -->
    <swiper
      style="flex: 1; min-height: 0;"
      :current="activeTabIndex"
      :duration="260"
      :skip-hidden-item-layout="true"
      @change="onSwiperChange"
      @animationfinish="onSwiperAnimationFinish"
    >
      <swiper-item>
        <scroll-view
          scroll-y
          style="height: 100%;"
          :refresher-enabled="true"
          :refresher-triggered="refreshing"
          @refresherrefresh="onRefresh"
        >
          <view v-if="loading" class="px-4 pt-2 pb-4">
            <view v-if="viewMode === 'grid'" class="grid grid-cols-3 gap-2">
              <view v-for="i in 9" :key="i" class="overflow-hidden rounded-md">
                <view class="w-full bg-muted skeleton-pulse" style="height: 300rpx;" />
                <view class="bg-card p-1.5">
                  <view class="h-3 w-4/5 rounded bg-muted skeleton-pulse" />
                  <view class="mt-1 h-2.5 w-1/2 rounded bg-muted skeleton-pulse" />
                </view>
              </view>
            </view>
            <view v-else class="rounded-md bg-card">
              <view v-for="i in 6" :key="i">
                <view class="p-2.5 flex gap-2.5">
                  <view class="shrink-0 rounded bg-muted skeleton-pulse" style="height: 160rpx; width: 110rpx;" />
                  <view class="flex-1 py-1">
                    <view class="h-3.5 w-3/5 rounded bg-muted skeleton-pulse" />
                    <view class="mt-2 h-2.5 w-2/5 rounded bg-muted skeleton-pulse" />
                    <view class="mt-2 h-2.5 w-1/4 rounded bg-muted skeleton-pulse" />
                  </view>
                </view>
                <view v-if="i < 6" class="h-px bg-border mx-2.5" />
              </view>
            </view>
          </view>

          <view v-else class="px-4 pt-2 pb-4 animate-fade-in">
            <EmptyState v-if="filteredMovies.length === 0" title="暂无电影" />

            <view v-else-if="viewMode === 'grid'" class="grid grid-cols-3 gap-2">
              <view
                v-for="(movie, movieIndex) in filteredMovies"
                :key="movie.path"
                class="overflow-hidden rounded-md bg-card animate-scale-in"
                hover-class="opacity-70"
                :data-index="movieIndex"
                @tap="onOpenMovieDetailTap"
              >
                <view style="height: 300rpx;">
                  <MediaPoster :src="movie.posterUrl" width="100%" height="100%" mode="aspectFill" />
                </view>
                <view class="p-1.5">
                  <view class="truncate text-xs font-medium text-foreground">{{ movie.displayName }}</view>
                  <view v-if="movie.year" class="text-xs text-muted-foreground">{{ movie.year }}</view>
                </view>
              </view>
            </view>

            <view v-else class="rounded-md bg-card">
              <view v-for="(movie, idx) in filteredMovies" :key="movie.path">
                <view
                  class="p-2.5 flex items-center gap-2.5"
                  hover-class="opacity-70 active-scale"
                  :data-index="idx"
                  @tap="onOpenMovieDetailTap"
                >
                  <MediaPoster :src="movie.posterUrl" width="110rpx" height="160rpx" rounded="rounded" class="shrink-0" />
                  <view class="flex-1 min-w-0">
                    <view class="text-sm font-medium text-foreground">{{ movie.displayName }}</view>
                    <view v-if="movie.year" class="mt-0.5 text-xs text-muted-foreground">{{ movie.year }}</view>
                    <view v-if="movie.displayRating" class="mt-1 flex items-center gap-1">
                      <t-icon name="star-filled" size="24rpx" color="var(--color-warning)" />
                      <text class="text-xs text-foreground">{{ movie.displayRating }}</text>
                    </view>
                  </view>
                  <t-icon name="chevron-right" size="36rpx" color="var(--color-muted-foreground)" />
                </view>
                <view v-if="idx < filteredMovies.length - 1" class="h-px bg-border mx-2.5" />
              </view>
            </view>
          </view>
        </scroll-view>
      </swiper-item>

      <swiper-item>
        <scroll-view
          scroll-y
          style="height: 100%;"
          :refresher-enabled="true"
          :refresher-triggered="refreshing"
          @refresherrefresh="onRefresh"
        >
          <view v-if="loading" class="px-4 pt-2 pb-4">
            <view v-if="viewMode === 'grid'" class="grid grid-cols-3 gap-2">
              <view v-for="i in 9" :key="i" class="overflow-hidden rounded-md">
                <view class="w-full bg-muted skeleton-pulse" style="height: 300rpx;" />
                <view class="bg-card p-1.5">
                  <view class="h-3 w-4/5 rounded bg-muted skeleton-pulse" />
                  <view class="mt-1 h-2.5 w-1/2 rounded bg-muted skeleton-pulse" />
                </view>
              </view>
            </view>
            <view v-else class="rounded-md bg-card">
              <view v-for="i in 6" :key="i">
                <view class="p-2.5 flex gap-2.5">
                  <view class="shrink-0 rounded bg-muted skeleton-pulse" style="height: 160rpx; width: 110rpx;" />
                  <view class="flex-1 py-1">
                    <view class="h-3.5 w-3/5 rounded bg-muted skeleton-pulse" />
                    <view class="mt-2 h-2.5 w-2/5 rounded bg-muted skeleton-pulse" />
                    <view class="mt-2 h-2.5 w-1/4 rounded bg-muted skeleton-pulse" />
                  </view>
                </view>
                <view v-if="i < 6" class="h-px bg-border mx-2.5" />
              </view>
            </view>
          </view>

          <view v-else class="px-4 pt-2 pb-4 animate-fade-in">
            <EmptyState v-if="filteredShows.length === 0" title="暂无剧集" />

            <view v-else-if="viewMode === 'grid'" class="grid grid-cols-3 gap-2">
              <view
                v-for="(show, showIndex) in filteredShows"
                :key="show.path"
                class="overflow-hidden rounded-md bg-card animate-scale-in"
                hover-class="opacity-70"
                :data-index="showIndex"
                @tap="onOpenShowDetailTap"
              >
                <view style="height: 300rpx;">
                  <MediaPoster :src="show.posterUrl" :badge="show.supplementBadge" width="100%" height="100%" mode="aspectFill" />
                </view>
                <view class="p-1.5">
                  <view class="truncate text-xs font-medium text-foreground">{{ show.displayName }}</view>
                  <view class="text-xs text-muted-foreground">{{ show.seasons.length }} 季</view>
                </view>
              </view>
            </view>

            <view v-else class="rounded-md bg-card">
              <view v-for="(show, idx) in filteredShows" :key="show.path">
                <view
                  class="p-2.5 flex items-center gap-2.5"
                  hover-class="opacity-70 active-scale"
                  :data-index="idx"
                  @tap="onOpenShowDetailTap"
                >
                  <MediaPoster :src="show.posterUrl" :badge="show.supplementBadge" width="110rpx" height="160rpx" rounded="rounded" class="shrink-0" />
                  <view class="flex-1 min-w-0">
                    <view class="text-sm font-medium text-foreground">{{ show.displayName }}</view>
                    <view class="mt-0.5 text-xs text-muted-foreground">
                      {{ show.seasons.length }} 季{{ show.year ? ` · ${show.year}` : '' }}
                    </view>
                    <view v-if="show.displayRating" class="mt-1 flex items-center gap-1">
                      <t-icon name="star-filled" size="24rpx" color="var(--color-warning)" />
                      <text class="text-xs text-foreground">{{ show.displayRating }}</text>
                    </view>
                  </view>
                  <t-icon name="chevron-right" size="36rpx" color="var(--color-muted-foreground)" />
                </view>
                <view v-if="idx < filteredShows.length - 1" class="h-px bg-border mx-2.5" />
              </view>
            </view>
          </view>
        </scroll-view>
      </swiper-item>
    </swiper>

    <!-- Detail Bottom Sheet -->
    <MediaDetail
      :visible="detailVisible"
      :movie="detailMovie"
      :show="detailShow"
      @close="closeDetail"
      @refresh="onDetailRefresh"
      @rematch="onRematch"
    />

    <TabBar />
  </view>
</template>
