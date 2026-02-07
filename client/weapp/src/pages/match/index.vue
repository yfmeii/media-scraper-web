<script setup lang="ts">
import type { MatchResult, SearchResult } from '@media-scraper/shared'
import { computed, onLoad, ref } from 'wevu'
import { autoMatch, processMovie, processTV, refreshMetadata, searchTMDB } from '@/utils/api'
import { getPosterUrl } from '@/utils/request'
import { useToast } from '@/hooks/useToast'
import { useDialog } from '@/hooks/useDialog'
import MediaPoster from '@/components/MediaPoster/index.vue'

definePageJson({ disableScroll: true })

const { showToast } = useToast()
const { alert } = useDialog()

const filePath = ref('')
const fileName = ref('')
const fileKind = ref<'tv' | 'movie' | 'unknown'>('unknown')
/** mode=rematch 时不走入库流程，而是调用 refreshMetadata */
const pageMode = ref<'process' | 'rematch'>('process')

const matchResult = ref<MatchResult | null>(null)
const matchLoading = ref(false)

const searchQuery = ref('')
const searchType = ref<'movie' | 'tv'>('movie')
const searchResults = ref<SearchResult[]>([])
const searching = ref(false)

const selectedResult = ref<SearchResult | null>(null)

const season = ref(1)
const episode = ref(1)

const processing = ref(false)
const selectedResultPoster = computed(() => getPosterUrl(selectedResult.value?.posterPath))
const selectedResultName = computed(() => selectedResult.value?.title || selectedResult.value?.name || '未知')
const selectedResultDate = computed(() => selectedResult.value?.releaseDate || selectedResult.value?.firstAirDate || '')
const processButtonText = computed(() =>
  processing.value
    ? (pageMode.value === 'rematch' ? '匹配中...' : '入库中...')
    : (pageMode.value === 'rematch' ? '确认匹配' : '确认入库'),
)

interface SearchResultCard extends SearchResult {
  posterUrl: string
  displayName: string
  displayDate: string
  selected: boolean
  index: number
  isLast: boolean
}

const searchResultCards = computed<SearchResultCard[]>(() =>
  searchResults.value.map((result, index) => ({
    ...result,
    posterUrl: getPosterUrl(result.posterPath),
    displayName: result.title || result.name || '未知',
    displayDate: result.releaseDate || result.firstAirDate || '',
    selected: selectedResult.value?.id === result.id,
    index,
    isLast: index === searchResults.value.length - 1,
  })),
)

onLoad((query: Record<string, string | undefined>) => {
  filePath.value = decodeURIComponent(query.path || '')
  fileName.value = decodeURIComponent(query.name || '')
  const kind = query.kind || 'unknown'
  fileKind.value = kind as 'tv' | 'movie' | 'unknown'
  if (kind === 'tv') searchType.value = 'tv'
  else searchType.value = 'movie'
  if (query.mode === 'rematch') pageMode.value = 'rematch'
  doAutoMatch()
})

async function doAutoMatch() {
  if (!filePath.value) return
  matchLoading.value = true
  try {
    const result = await autoMatch(filePath.value, fileName.value || undefined)
    matchResult.value = result
    if (result.matched && result.result) {
      selectedResult.value = {
        id: result.result.id,
        title: result.result.name,
        name: result.result.name,
        posterPath: result.result.posterPath,
        releaseDate: result.result.date,
        firstAirDate: result.result.date,
      }
    }
  }
  catch {
    showToast('匹配失败', 'error')
  }
  finally {
    matchLoading.value = false
  }
}

async function onSearch() {
  const q = searchQuery.value.trim()
  if (!q) return
  searching.value = true
  try {
    searchResults.value = await searchTMDB(searchType.value, q)
  }
  catch {
    showToast('搜索失败', 'error')
  }
  finally {
    searching.value = false
  }
}

function onSelectResult(result: SearchResult) {
  selectedResult.value = result
  showToast('已选择')
}

function onSelectResultTap(e: WechatMiniprogram.CustomEvent) {
  const index = Number((e.currentTarget as { dataset?: { index?: number | string } })?.dataset?.index)
  if (!Number.isInteger(index) || index < 0 || index >= searchResults.value.length) return
  onSelectResult(searchResults.value[index])
}

function setSearchTypeMovie() {
  searchType.value = 'movie'
}

function setSearchTypeTV() {
  searchType.value = 'tv'
}

function onSearchInput(e: WechatMiniprogram.CustomEvent) {
  searchQuery.value = e.detail.value
}

function onSeasonInput(e: WechatMiniprogram.CustomEvent) {
  season.value = Number(e.detail.value) || 1
}

function onEpisodeInput(e: WechatMiniprogram.CustomEvent) {
  episode.value = Number(e.detail.value) || 1
}

async function onProcess() {
  if (!selectedResult.value || processing.value) return
  processing.value = true
  try {
    let result

    if (pageMode.value === 'rematch') {
      // Rematch mode: call refreshMetadata with new TMDB ID
      result = await refreshMetadata(
        searchType.value,
        filePath.value,
        selectedResult.value.id,
      )
    }
    else if (searchType.value === 'tv') {
      result = await processTV({
        sourcePath: filePath.value,
        showName: selectedResult.value.name || selectedResult.value.title || '',
        tmdbId: selectedResult.value.id,
        season: season.value,
        episodes: [{ source: filePath.value, episode: episode.value }],
      })
    }
    else {
      result = await processMovie({
        sourcePath: filePath.value,
        tmdbId: selectedResult.value.id,
      })
    }

    if (result.success) {
      showToast(pageMode.value === 'rematch' ? '匹配成功' : '入库成功')
      wx.vibrateShort({ type: 'medium' })
      setTimeout(() => wx.navigateBack(), 800)
    }
    else {
      alert({
        title: pageMode.value === 'rematch' ? '匹配失败' : '入库失败',
        content: result.message || '未知错误',
      })
    }
  }
  catch {
    showToast('处理失败', 'error')
  }
  finally {
    processing.value = false
  }
}

</script>

<template>
  <view style="height: 100vh; display: flex; flex-direction: column; overflow: hidden;">
    <t-navbar :title="pageMode === 'rematch' ? '重新匹配' : '文件入库'" :left-arrow="true" :fixed="false" />

    <scroll-view scroll-y style="flex: 1; min-height: 0;">
      <!-- File Info -->
      <view class="px-4 pt-3">
        <view class="pl-1 text-xs font-medium text-muted-foreground mb-1">📄 文件信息</view>
        <view class="mt-2 rounded-xl bg-card p-3">
          <view class="text-xs text-muted-foreground">文件名</view>
          <view class="mt-1 text-sm font-medium text-foreground">{{ fileName }}</view>
        </view>
      </view>

      <!-- Match Result -->
      <view class="px-4">
        <view class="pl-1 text-xs font-medium text-muted-foreground mt-6 mb-1">🎯 匹配结果</view>
        <view v-if="matchLoading" class="mt-2 rounded-xl bg-card p-3">
          <t-skeleton theme="paragraph" :loading="true" />
        </view>
        <view v-else-if="selectedResult" class="mt-2 rounded-xl bg-card p-3">
          <view class="flex gap-3">
            <MediaPoster
              v-if="selectedResultPoster"
              :src="selectedResultPoster"
              width="140rpx"
              height="200rpx"
              rounded="rounded-lg"
              class="shrink-0"
            />
            <view class="flex-1">
              <view class="text-sm font-semibold text-foreground">{{ selectedResultName }}</view>
              <view v-if="selectedResultDate" class="mt-0.5 text-xs text-muted-foreground">{{ selectedResultDate }}</view>
              <view class="mt-0.5 text-xs text-muted-foreground">TMDB ID: {{ selectedResult.id }}</view>
              <view v-if="matchResult && matchResult.candidates && matchResult.candidates.length" class="mt-1">
                <view class="inline-block text-xs px-1.5 py-0.5 rounded bg-muted text-warning">
                  {{ matchResult.candidates.length }} 个候选
                </view>
              </view>
            </view>
          </view>
        </view>
        <view v-else class="mt-2 rounded-xl bg-card p-3">
          <view class="text-sm text-muted-foreground">未找到匹配，请手动搜索</view>
        </view>
      </view>

      <!-- Manual Search -->
      <view class="px-4">
        <view class="pl-1 text-xs font-medium text-muted-foreground mt-6 mb-1">🔍 手动搜索</view>
        <view class="mt-2 flex gap-2">
          <view class="flex-1">
            <t-input :value="searchQuery" placeholder="输入标题搜索 TMDB" clearable @change="onSearchInput" />
          </view>
          <t-button theme="primary" size="medium" :loading="searching" @tap="onSearch">搜索</t-button>
        </view>
        <view class="mt-2 flex gap-2">
          <view
            class="px-2.5 py-1 text-xs rounded"
            :class="searchType === 'movie' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
            @tap="setSearchTypeMovie"
          >电影</view>
          <view
            class="px-2.5 py-1 text-xs rounded"
            :class="searchType === 'tv' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
            @tap="setSearchTypeTV"
          >剧集</view>
        </view>
      </view>

      <!-- Search Results -->
      <view v-if="searchResults.length > 0" class="px-4">
        <view class="pl-1 text-xs font-medium text-muted-foreground mt-4 mb-1">搜索结果</view>
        <view class="mt-2 rounded-xl bg-card">
          <view
            v-for="result in searchResultCards"
            :key="result.id"
            hover-class="opacity-70"
            :data-index="result.index"
            @tap="onSelectResultTap"
          >
            <view
              class="p-3 flex gap-2"
              :class="{ 'bg-accent rounded-xl': result.selected }"
            >
              <MediaPoster
                v-if="result.posterUrl"
                :src="result.posterUrl"
                width="84rpx"
                height="120rpx"
                rounded="rounded-lg"
                class="shrink-0"
              />
              <view class="flex-1 min-w-0">
                <view class="text-sm font-medium text-foreground">{{ result.displayName }}</view>
                <view class="mt-0.5 text-xs text-muted-foreground">{{ result.displayDate }}</view>
                <view
                  v-if="result.overview"
                  class="mt-0.5 text-xs text-muted-foreground line-clamp-2"
                >{{ result.overview }}</view>
              </view>
            </view>
            <view v-if="!result.isLast" class="h-px bg-border mx-3"></view>
          </view>
        </view>
      </view>

      <!-- TV Episode Info (only in process mode) -->
      <view v-if="searchType === 'tv' && pageMode !== 'rematch'" class="px-4 pb-4">
        <view class="pl-1 text-xs font-medium text-muted-foreground mt-6 mb-1">📺 剧集信息</view>
        <view class="mt-2 rounded-xl bg-card p-3">
          <view class="flex items-center">
            <view class="w-12 text-sm text-foreground">季</view>
            <view class="flex-1">
              <t-stepper :value="season" :min="0" :max="99" @change="onSeasonInput" />
            </view>
          </view>
          <view class="h-px bg-border my-3"></view>
          <view class="flex items-center">
            <view class="w-12 text-sm text-foreground">集</view>
            <view class="flex-1">
              <t-stepper :value="episode" :min="0" :max="999" @change="onEpisodeInput" />
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- Bottom Action (part of flex layout, not fixed) -->
    <view class="bg-card px-4 pt-2">
      <view class="flex">
        <view
          class="flex-1 rounded-xl bg-background px-3 py-3 flex items-center justify-center gap-2 text-sm font-semibold"
          :class="selectedResult && !processing ? 'text-primary' : 'text-muted-foreground'"
          hover-class="opacity-70"
          @tap="onProcess"
        >
          <t-icon name="check-circle" size="36rpx" :color="selectedResult && !processing ? 'var(--color-primary)' : 'var(--color-muted-foreground)'" />
          <text>{{ processButtonText }}</text>
        </view>
      </view>
      <view class="h-[calc(20rpx+env(safe-area-inset-bottom))]"></view>
    </view>

    <t-dialog id="t-dialog" />
  </view>
</template>
