<script setup lang="ts">
import type { MovieInfo, ShowInfo } from '@media-scraper/shared'
import { computed, onShow, ref } from 'wevu'
import { fetchMovies, fetchTVShows } from '@/utils/api'
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

const activeTab = ref<'movie' | 'tv'>('movie')
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
}

interface DisplayShow extends ShowInfo {
  posterUrl: string
  supplementBadge: string
}

const filteredMovies = computed<DisplayMovie[]>(() => {
  const list = searchKeyword.value
    ? movies.value.filter(m => m.name.toLowerCase().includes(searchKeyword.value.toLowerCase()))
    : movies.value
  return list.map(m => ({
    ...m,
    posterUrl: getPosterUrl(m.posterPath),
  }))
})

const filteredShows = computed<DisplayShow[]>(() => {
  const list = searchKeyword.value
    ? tvShows.value.filter(s => s.name.toLowerCase().includes(searchKeyword.value.toLowerCase()))
    : tvShows.value
  return list.map(s => ({
    ...s,
    posterUrl: getPosterUrl(s.posterPath),
    supplementBadge: (s.groupStatus === 'supplement' && s.supplementCount) ? `缺${s.supplementCount}` : '',
  }))
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
  await loadLibrary()
  refreshing.value = false
}

function switchTab(tab: 'movie' | 'tv') {
  activeTab.value = tab
}

function onSwitchTabTap(e: WechatMiniprogram.CustomEvent) {
  const tab = (e.currentTarget as { dataset?: { tab?: string } })?.dataset?.tab
  if (tab === 'movie' || tab === 'tv') {
    switchTab(tab)
  }
}

function toggleView() {
  viewMode.value = viewMode.value === 'grid' ? 'list' : 'grid'
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
}

async function onDetailRefresh() {
  await loadLibrary()
  // Update the detail data if still open
  if (detailMovie.value) {
    const updated = movies.value.find(m => m.path === detailMovie.value?.path)
    if (updated) detailMovie.value = updated
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
  <wxs module="fmt" src="../../utils/format.wxs" />
  <view style="height: 100vh; display: flex; flex-direction: column; overflow: hidden;">
    <t-navbar title="媒体库" :fixed="false" />

    <!-- Search Bar -->
    <view class="bg-background px-4 pt-2 pb-2">
      <view class="flex items-center gap-2">
        <view class="flex-1">
          <t-search :value="searchKeyword" placeholder="搜索媒体..." shape="round" @change="onSearch" />
        </view>
        <view
          class="flex items-center justify-center rounded-full bg-card"
          style="width: var(--td-search-height, 80rpx); height: var(--td-search-height, 80rpx);"
          hover-class="opacity-70"
          @tap="toggleView"
        >
          <t-icon :name="viewMode === 'grid' ? 'view-list' : 'view-module'" size="40rpx" />
        </view>
      </view>
    </view>

    <!-- Tab Switcher -->
    <view class="bg-background px-4 py-1">
      <view class="flex gap-2">
        <view
          class="flex-1 py-2 text-center text-sm font-medium rounded-xl"
          :class="activeTab === 'movie' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'"
          data-tab="movie"
          @tap="onSwitchTabTap"
        >电影 ({{ movies.length }})</view>
        <view
          class="flex-1 py-2 text-center text-sm font-medium rounded-xl"
          :class="activeTab === 'tv' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'"
          data-tab="tv"
          @tap="onSwitchTabTap"
        >剧集 ({{ tvShows.length }})</view>
      </view>
    </view>

    <!-- Content (scrollable) -->
    <scroll-view
      scroll-y
      style="flex: 1; min-height: 0;"
      :refresher-enabled="true"
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
    >
      <!-- Loading Skeleton -->
      <view v-if="loading" class="px-4 pt-2 pb-4">
        <view v-if="viewMode === 'grid'" class="grid grid-cols-3 gap-2">
          <view v-for="i in 9" :key="i" class="overflow-hidden rounded-xl">
            <view class="h-[300rpx] w-full bg-muted skeleton-pulse" />
            <view class="bg-card p-1.5">
              <view class="h-3 w-4/5 rounded bg-muted skeleton-pulse" />
              <view class="mt-1 h-2.5 w-1/2 rounded bg-muted skeleton-pulse" />
            </view>
          </view>
        </view>
        <view v-else class="rounded-xl bg-card">
          <view v-for="i in 6" :key="i">
            <view class="p-2.5 flex gap-2.5">
              <view class="h-[160rpx] w-[110rpx] shrink-0 rounded-lg bg-muted skeleton-pulse" />
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

      <!-- Movies Tab -->
      <view v-else-if="activeTab === 'movie'" class="px-4 pt-2 pb-4">
        <EmptyState v-if="filteredMovies.length === 0" title="暂无电影" />

        <view v-else-if="viewMode === 'grid'" class="grid grid-cols-3 gap-2">
          <view
            v-for="(movie, movieIndex) in filteredMovies"
            :key="movie.path"
            class="overflow-hidden rounded-xl bg-card"
            hover-class="opacity-70"
            :data-index="movieIndex"
            @tap="onOpenMovieDetailTap"
          >
            <MediaPoster :src="movie.posterUrl" />
            <view class="p-1.5">
              <view class="truncate text-xs font-medium text-foreground">{{ movie.name }}</view>
              <view v-if="movie.year" class="text-xs text-muted-foreground">{{ movie.year }}</view>
            </view>
          </view>
        </view>

        <view v-else class="rounded-xl bg-card">
          <view v-for="(movie, idx) in filteredMovies" :key="movie.path">
            <view
              class="p-2.5 flex items-center gap-2.5"
              hover-class="opacity-70"
              :data-index="idx"
              @tap="onOpenMovieDetailTap"
            >
              <MediaPoster :src="movie.posterUrl" width="110rpx" height="160rpx" rounded="rounded-lg" class="shrink-0" />
              <view class="flex-1 min-w-0">
                <view class="text-sm font-medium text-foreground">{{ movie.name }}</view>
                <view v-if="movie.year" class="mt-0.5 text-xs text-muted-foreground">{{ movie.year }}</view>
                <view v-if="movie.voteAverage" class="mt-1 flex items-center gap-1">
                  <t-icon name="star-filled" size="24rpx" color="var(--color-warning)" />
                  <text class="text-xs text-foreground">{{ fmt.formatRating(movie.voteAverage) }}</text>
                </view>
              </view>
              <t-icon name="chevron-right" size="36rpx" color="var(--color-muted-foreground)" />
            </view>
            <view v-if="idx < filteredMovies.length - 1" class="h-px bg-border mx-2.5" />
          </view>
        </view>
      </view>

      <!-- TV Shows Tab -->
      <view v-else class="px-4 pt-2 pb-4">
        <EmptyState v-if="filteredShows.length === 0" title="暂无剧集" />

        <view v-else-if="viewMode === 'grid'" class="grid grid-cols-3 gap-2">
          <view
            v-for="(show, showIndex) in filteredShows"
            :key="show.path"
            class="overflow-hidden rounded-xl bg-card"
            hover-class="opacity-70"
            :data-index="showIndex"
            @tap="onOpenShowDetailTap"
          >
            <MediaPoster :src="show.posterUrl" :badge="show.supplementBadge" />
            <view class="p-1.5">
              <view class="truncate text-xs font-medium text-foreground">{{ show.name }}</view>
              <view class="text-xs text-muted-foreground">{{ show.seasons.length }} 季</view>
            </view>
          </view>
        </view>

        <view v-else class="rounded-xl bg-card">
          <view v-for="(show, idx) in filteredShows" :key="show.path">
            <view
              class="p-2.5 flex items-center gap-2.5"
              hover-class="opacity-70"
              :data-index="idx"
              @tap="onOpenShowDetailTap"
            >
              <MediaPoster :src="show.posterUrl" :badge="show.supplementBadge" width="110rpx" height="160rpx" rounded="rounded-lg" class="shrink-0" />
              <view class="flex-1 min-w-0">
                <view class="text-sm font-medium text-foreground">{{ show.name }}</view>
                <view class="mt-0.5 text-xs text-muted-foreground">
                  {{ show.seasons.length }} 季{{ show.year ? ` · ${show.year}` : '' }}
                </view>
                <view v-if="show.voteAverage" class="mt-1 flex items-center gap-1">
                  <t-icon name="star-filled" size="24rpx" color="var(--color-warning)" />
                  <text class="text-xs text-foreground">{{ fmt.formatRating(show.voteAverage) }}</text>
                </view>
              </view>
              <t-icon name="chevron-right" size="36rpx" color="var(--color-muted-foreground)" />
            </view>
            <view v-if="idx < filteredShows.length - 1" class="h-px bg-border mx-2.5" />
          </view>
        </view>
      </view>
    </scroll-view>

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
