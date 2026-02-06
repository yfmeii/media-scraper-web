<script setup lang="ts">
import type { MediaFile } from '@media-scraper/shared'
import { ref } from 'wevu'
import { recognizePath, searchTMDB } from '@/utils/api'
import { useToast } from '@/hooks/useToast'
import { useMediaMatch } from '@/hooks/useMediaMatch'
import { processMedia } from '@/hooks/useMediaProcess'
import { normalizeMediaKind } from '@/utils/format'
import MediaPoster from '@/components/MediaPoster/index.vue'

defineComponentJson({ styleIsolation: 'apply-shared' })

const props = defineProps<{
  visible: boolean
  file: MediaFile | null
}>()

const emit = defineEmits<{
  close: []
  processed: []
}>()

const { showToast } = useToast()
const { matchLoading, searching, candidates, selectedCandidate, doAutoMatch, doSearch, selectCandidate, reset: resetMatch } = useMediaMatch()

// ── Local State ──
const processing = ref(false)
const aiLoading = ref(false)
const searchQuery = ref('')
const searchType = ref<'tv' | 'movie'>('movie')
const season = ref(1)
const episode = ref(1)
const aiResult = ref<{ title: string, confidencePercent: number } | null>(null)

function initForFile(file: MediaFile) {
  searchQuery.value = file.parsed.title || file.name.replace(/\.[^.]+$/, '')
  searchType.value = file.kind === 'tv' ? 'tv' : 'movie'
  season.value = file.parsed.season || 1
  episode.value = file.parsed.episode || 1
  aiResult.value = null
  processing.value = false
  aiLoading.value = false
  resetMatch()
}

defineExpose({ initForFile })

// ── WXML-safe event handlers ──
function onVisibleChange(e: WechatMiniprogram.CustomEvent) {
  if (!e.detail.visible) emit('close')
}

function onSearchInput(e: WechatMiniprogram.CustomEvent) {
  searchQuery.value = e.detail.value
}

function onSeasonChange(e: WechatMiniprogram.CustomEvent) {
  season.value = e.detail.value
}

function onEpisodeChange(e: WechatMiniprogram.CustomEvent) {
  episode.value = e.detail.value
}

function closePopup() {
  emit('close')
}

function setSearchTypeMovie() {
  searchType.value = 'movie'
}

function setSearchTypeTV() {
  searchType.value = 'tv'
}

function onSelectCandidate(e: WechatMiniprogram.CustomEvent) {
  const id = Number((e.currentTarget as { dataset?: { id?: number | string } })?.dataset?.id)
  if (!Number.isInteger(id)) return
  const candidate = candidates.value.find(c => c.id === id)
  if (!candidate) return
  selectCandidate(candidate)
}

// ── Actions ──
async function handleAutoMatch() {
  if (!props.file) return
  await doAutoMatch(props.file, normalizeMediaKind(props.file.kind))
}

async function handleManualSearch() {
  const ok = await doSearch(searchQuery.value, searchType.value)
  if (!ok) showToast('搜索失败', 'error')
}

async function handleAIRecognize() {
  if (!props.file) return
  aiLoading.value = true
  aiResult.value = null
  try {
    const kind = normalizeMediaKind(props.file.kind)
    const result = await recognizePath(props.file.path, kind)
    if (result && result.tmdb_id) {
      aiResult.value = {
        title: result.tmdb_name || result.title,
        confidencePercent: Math.round(result.confidence * 100),
      }
      if (result.media_type) searchType.value = result.media_type
      if (result.season) season.value = result.season
      if (result.episode) episode.value = result.episode
      // Search TMDB with AI result to populate candidates
      const results = await searchTMDB(
        result.media_type || searchType.value,
        result.tmdb_name || result.title,
      )
      candidates.value = results
      const matched = results.find(r => r.id === result.tmdb_id)
      selectedCandidate.value = matched || results[0] || null
    }
    else {
      showToast('AI 识别失败', 'warning')
    }
  }
  catch {
    showToast('AI 识别失败', 'error')
  }
  finally {
    aiLoading.value = false
  }
}

async function handleProcess() {
  if (!props.file || !selectedCandidate.value) return
  processing.value = true
  try {
    const result = await processMedia({
      file: props.file,
      candidate: selectedCandidate.value,
      type: searchType.value,
      season: season.value,
      episode: episode.value,
    })
    if (result.success) {
      showToast('入库成功', 'success')
      emit('close')
      emit('processed')
    }
    else {
      showToast(result.message || '入库失败', 'error')
    }
  }
  catch {
    showToast('入库失败', 'error')
  }
  finally {
    processing.value = false
  }
}

function goToMatchPage() {
  if (!props.file) return
  const file = props.file
  emit('close')
  wx.navigateTo({
    url: `/pages/match/index?path=${encodeURIComponent(file.path)}&kind=${file.kind}&name=${encodeURIComponent(file.name)}`,
  })
}
</script>

<template>
  <wxs module="fmt" src="../../utils/format.wxs" />
  <t-popup
    :visible="visible"
    placement="bottom"
    style="--td-popup-bg-color: var(--color-background);"
    @visible-change="onVisibleChange"
  >
    <view v-if="file" style="height: 85vh; display: flex; flex-direction: column; border-top-left-radius: 24rpx; border-top-right-radius: 24rpx;">
      <!-- Header -->
      <view class="flex items-center justify-between px-4" style="height: 88rpx; border-bottom: 1rpx solid var(--color-border);">
        <text class="text-base font-semibold text-foreground">文件详情</text>
        <view
          class="flex items-center justify-center rounded-full bg-card"
          style="min-width: 60rpx; min-height: 60rpx;"
          hover-class="opacity-60"
          @tap="closePopup"
        >
          <t-icon name="close" size="32rpx" color="var(--color-foreground)" />
        </view>
      </view>

      <!-- Scrollable Content -->
      <scroll-view scroll-y style="flex: 1; min-height: 0;">
        <view class="px-4 pt-3 pb-4">
          <!-- File Info Card -->
          <view class="rounded-xl bg-card p-3">
            <text class="text-sm font-medium text-foreground" style="word-break: break-all;">{{ file.name }}</text>
            <view class="mt-2 flex items-center gap-1.5 flex-wrap">
              <text class="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{{ fmt.formatFileSize(file.size) }}</text>
              <text
                class="text-xs px-1.5 py-0.5 rounded"
                :class="file.kind === 'tv' ? 'bg-muted text-blue-600' : file.kind === 'movie' ? 'bg-muted text-purple-600' : 'bg-muted text-muted-foreground'"
              >{{ file.kind === 'tv' ? (file.isProcessed || file.hasNfo ? '剧集' : '疑似剧集') : file.kind === 'movie' ? (file.isProcessed || file.hasNfo ? '电影' : '疑似电影') : '未知' }}</text>
              <text v-if="file.parsed.resolution" class="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{{ file.parsed.resolution }}</text>
              <text v-if="file.parsed.codec" class="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{{ file.parsed.codec }}</text>
            </view>
            <view v-if="file.parsed.title" class="mt-2 text-xs text-muted-foreground">
              解析标题: {{ file.parsed.title }}<text v-if="file.parsed.year"> ({{ file.parsed.year }})</text>
              <text v-if="file.parsed.season"> · S{{ fmt.padStart(file.parsed.season, 2, '0') }}</text>
              <text v-if="file.parsed.episode">E{{ fmt.padStart(file.parsed.episode, 2, '0') }}</text>
            </view>
          </view>

          <!-- AI Result Banner -->
          <view v-if="aiResult" class="mt-3 rounded-xl bg-muted p-3 flex items-center gap-2">
            <t-icon name="check-circle" size="36rpx" color="var(--color-primary)" />
            <view class="flex-1 min-w-0">
              <text class="text-sm font-medium text-foreground">AI 识别: {{ aiResult.title }}</text>
              <text class="text-xs text-muted-foreground ml-2">置信度 {{ aiResult.confidencePercent }}%</text>
            </view>
          </view>

          <!-- Search Section -->
          <view class="mt-3">
            <view class="flex items-center gap-2">
              <view class="flex-1 flex items-center gap-2 rounded-xl bg-card px-3" style="height: 72rpx;">
                <t-icon name="search" size="32rpx" color="var(--color-muted-foreground)" />
                <input
                  :value="searchQuery"
                  class="flex-1 text-sm text-foreground"
                  placeholder="搜索 TMDB..."
                  @input="onSearchInput"
                  @confirm="handleManualSearch"
                />
              </view>
              <view
                class="shrink-0 rounded-xl bg-primary flex items-center justify-center"
                style="height: 72rpx; width: 120rpx;"
                hover-class="opacity-80"
                @tap="handleManualSearch"
              >
                <t-loading v-if="searching" theme="circular" size="32rpx" />
                <text v-else class="text-sm font-medium text-primary-foreground">搜索</text>
              </view>
            </view>

            <!-- Type Toggle + Season/Episode -->
            <view class="mt-2 flex items-center gap-2">
              <view class="flex items-center gap-1 rounded-lg bg-muted p-0.5">
                <view
                  class="px-2.5 py-1 text-xs rounded-md"
                  :class="searchType === 'movie' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'"
                  @tap="setSearchTypeMovie"
                >电影</view>
                <view
                  class="px-2.5 py-1 text-xs rounded-md"
                  :class="searchType === 'tv' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'"
                  @tap="setSearchTypeTV"
                >剧集</view>
              </view>
              <view v-if="searchType === 'tv'" class="flex items-center gap-2 ml-auto">
                <view class="flex items-center gap-1">
                  <text class="text-xs text-muted-foreground">S</text>
                  <t-stepper :value="season" :min="1" :max="99" theme="filled" size="small"
                    @change="onSeasonChange" />
                </view>
                <view class="flex items-center gap-1">
                  <text class="text-xs text-muted-foreground">E</text>
                  <t-stepper :value="episode" :min="1" :max="999" theme="filled" size="small"
                    @change="onEpisodeChange" />
                </view>
              </view>
            </view>

            <!-- Quick Actions -->
            <view class="mt-2 flex gap-2">
              <view
                class="flex-1 flex items-center justify-center gap-1 rounded-xl py-2 bg-primary"
                :class="{ 'opacity-50': matchLoading }"
                hover-class="opacity-80"
                @tap="handleAutoMatch"
              >
                <t-loading v-if="matchLoading" theme="circular" size="28rpx" />
                <t-icon v-else name="search" size="28rpx" color="#fff" />
                <text class="text-sm font-medium text-primary-foreground">自动匹配</text>
              </view>
              <view
                class="flex-1 flex items-center justify-center gap-1 rounded-xl py-2"
                style="background: rgba(147, 51, 234, 0.1);"
                :class="{ 'opacity-50': aiLoading }"
                hover-class="opacity-80"
                @tap="handleAIRecognize"
              >
                <t-loading v-if="aiLoading" theme="circular" size="28rpx" />
                <t-icon v-else name="root-list" size="28rpx" color="rgb(147, 51, 234)" />
                <text class="text-sm font-medium" style="color: rgb(147, 51, 234);">AI 识别</text>
              </view>
            </view>
          </view>

          <!-- Candidates -->
          <view class="mt-3">
            <text class="text-xs font-medium text-muted-foreground">匹配结果</text>

            <view v-if="matchLoading || searching" class="mt-2 flex items-center justify-center py-6">
              <t-loading theme="circular" size="48rpx" />
              <text class="ml-2 text-sm text-muted-foreground">匹配中...</text>
            </view>

            <view v-else-if="candidates.length === 0" class="mt-2 py-6 text-center">
              <text class="text-sm text-muted-foreground">点击「自动匹配」或「AI 识别」开始</text>
            </view>

            <view v-else class="mt-2 flex flex-wrap gap-2">
              <view
                v-for="c in candidates"
                :key="c.id"
                class="rounded-xl overflow-hidden border-2"
                style="width: calc(33.33% - 8rpx);"
                :class="selectedCandidate && selectedCandidate.id === c.id ? 'border-primary' : 'border-transparent'"
                :data-id="c.id"
                @tap="onSelectCandidate"
              >
                <MediaPoster
                  :src="c.posterPath ? 'https://image.tmdb.org/t/p/w185' + c.posterPath : ''"
                  height="220rpx"
                  rounded="rounded-none"
                />
                <view class="p-1.5 bg-card">
                  <text class="text-xs text-foreground" style="overflow: hidden; white-space: nowrap; text-overflow: ellipsis; display: block;">
                    {{ c.name || c.title }}
                  </text>
                  <text class="text-xs text-muted-foreground">
                    {{ fmt.getYear(c.releaseDate || c.firstAirDate) }}
                  </text>
                </view>
                <view v-if="selectedCandidate && selectedCandidate.id === c.id" class="absolute top-1 right-1">
                  <t-icon name="check-circle-filled" size="36rpx" color="var(--color-primary)" />
                </view>
              </view>
            </view>
          </view>

          <!-- Go to full match page -->
          <view class="mt-3 text-center" @tap="goToMatchPage">
            <text class="text-sm text-primary">前往完整匹配页面 →</text>
          </view>
        </view>
      </scroll-view>

      <!-- Bottom Action -->
      <view class="px-4 pt-2 border-t border-border">
        <view
          class="flex items-center justify-center gap-1 py-3 rounded-xl"
          :class="selectedCandidate && !processing ? 'bg-primary' : 'bg-muted'"
          hover-class="opacity-80"
          @tap="handleProcess"
        >
          <t-loading v-if="processing" theme="circular" size="32rpx" />
          <t-icon v-else name="check" size="32rpx" :color="selectedCandidate ? '#fff' : 'var(--color-muted-foreground)'" />
          <text class="text-sm font-medium" :class="selectedCandidate ? 'text-primary-foreground' : 'text-muted-foreground'">
            {{ processing ? '入库中...' : '确认入库' }}
          </text>
        </view>
        <view class="h-[calc(12rpx+env(safe-area-inset-bottom))]"></view>
      </view>
    </view>
  </t-popup>
</template>
