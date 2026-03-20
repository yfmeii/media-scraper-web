<script setup lang="ts">
import type { MediaFile, PathRecognizeResult, SearchResult } from '@media-scraper/shared/types'
import MediaPoster from '@/components/MediaPoster/index.vue'

interface CandidateCard {
  id: number
  displayName: string
  displayYear: string
  posterUrl: string
  mediaType: 'tv' | 'movie'
}

defineProps<{
  file: MediaFile
  selectedCandidate: SearchResult | null
  targetPreviewPath: string
  targetPreviewLoading: boolean
  aiResult: PathRecognizeResult | null
  aiHint: string
  searchQuery: string
  selectedMediaType: 'tv' | 'movie'
  season: number
  episode: number
  matchLoading: boolean
  searching: boolean
  aiLoading: boolean
  autoMatchTried: boolean
  candidateCards: CandidateCard[]
  candidateCount: number
  processing: boolean
  previewLoading: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'search-input', value: string): void
  (e: 'season-input', value: string): void
  (e: 'episode-input', value: string): void
  (e: 'manual-search'): void
  (e: 'auto-match'): void
  (e: 'ai-recognize'): void
  (e: 'select-candidate', id: number): void
  (e: 'preview'): void
  (e: 'process'): void
}>()

function onSearchInput(e: WechatMiniprogram.CustomEvent) {
  emit('search-input', e.detail.value)
}

function onSeasonInput(e: WechatMiniprogram.CustomEvent) {
  emit('season-input', String(e.detail.value || ''))
}

function onEpisodeInput(e: WechatMiniprogram.CustomEvent) {
  emit('episode-input', String(e.detail.value || ''))
}

function onSelectCandidate(e: WechatMiniprogram.CustomEvent) {
  const id = Number((e.currentTarget as { dataset?: { id?: number | string } })?.dataset?.id)
  if (!Number.isInteger(id)) return
  emit('select-candidate', id)
}
</script>

<template>
  <wxs module="fmt" src="../../utils/format.wxs" />

  <view class="relative bg-background" style="border-top-left-radius: 24rpx; border-top-right-radius: 24rpx;">
    <view class="absolute top-0 left-0 right-0" style="z-index: 10; height: 88rpx; border-top-left-radius: 24rpx; border-top-right-radius: 24rpx;">
      <view class="absolute inset-0 bg-background" style="border-top-left-radius: 24rpx; border-top-right-radius: 24rpx;" />
      <view class="relative flex items-center justify-between px-3" style="height: 88rpx;">
        <text class="text-sm font-semibold text-foreground truncate flex-1 pl-1">文件入库详情</text>
        <view class="flex items-center justify-center rounded-full bg-card shrink-0" style="min-width: 60rpx; min-height: 60rpx;" hover-class="opacity-60" @tap="emit('close')">
          <t-icon name="close" size="32rpx" color="var(--color-foreground)" />
        </view>
      </view>
    </view>

    <scroll-view scroll-y style="max-height: calc(85vh - 120rpx - env(safe-area-inset-bottom));">
      <view style="height: 88rpx;" />
      <view class="px-4 pt-3 pb-4 animate-fade-in-up">
        <view class="rounded-xl bg-card p-3">
          <text class="text-sm font-medium text-foreground" style="word-break: break-all;">{{ file.name }}</text>
          <view class="mt-2 flex items-center gap-1.5 flex-wrap">
            <text class="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{{ fmt.formatFileSize(file.size) }}</text>
            <text v-if="file.parsed.resolution" class="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{{ file.parsed.resolution }}</text>
            <text v-if="file.parsed.codec" class="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{{ file.parsed.codec }}</text>
          </view>
          <view v-if="file.parsed.title" class="mt-2 text-xs text-muted-foreground">
            解析标题: {{ file.parsed.title }}<text v-if="file.parsed.year"> ({{ file.parsed.year }})</text>
            <text v-if="file.parsed.season"> · S{{ fmt.padStart(file.parsed.season, 2, '0') }}</text>
            <text v-if="file.parsed.episode">E{{ fmt.padStart(file.parsed.episode, 2, '0') }}</text>
          </view>
        </view>

        <view class="mt-3 rounded-xl bg-card p-3">
          <view class="flex items-center justify-between">
            <text class="text-xs font-medium text-muted-foreground">入库预览</text>
            <text class="text-xs" :class="selectedCandidate ? 'text-green-600' : 'text-muted-foreground'">{{ selectedCandidate ? '已匹配' : '未匹配' }}</text>
          </view>
          <view class="mt-2 rounded-lg bg-muted p-2">
            <text v-if="targetPreviewPath" class="text-xs text-foreground" style="word-break: break-all; font-family: Menlo, Monaco, Consolas, monospace;">{{ targetPreviewPath }}</text>
            <text v-else-if="targetPreviewLoading" class="text-xs text-muted-foreground">计算中...</text>
            <text v-else class="text-xs text-muted-foreground">请选择匹配结果</text>
          </view>
        </view>

        <view v-if="aiResult" class="mt-3 rounded-xl bg-muted p-3 flex items-center gap-2">
          <t-icon name="check-circle" size="36rpx" color="var(--color-primary)" />
          <view class="flex-1 min-w-0">
            <text class="text-sm font-medium text-foreground">AI 识别: {{ aiResult.tmdb_name || aiResult.title }}</text>
            <text class="text-xs text-muted-foreground ml-2">置信度 {{ fmt.toPercent(aiResult.confidence) }}%</text>
          </view>
        </view>

        <view v-if="aiHint" class="mt-2 rounded-lg px-2.5 py-2 text-xs" :class="fmt.isWarningHint(aiHint) ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'">
          {{ aiHint }}
        </view>

        <view class="mt-3">
          <view class="flex items-center gap-2">
            <view class="flex-1 flex items-center gap-2 rounded-xl bg-card px-3" style="height: 72rpx;">
              <t-icon name="search" size="32rpx" color="var(--color-muted-foreground)" />
              <input :value="searchQuery" class="flex-1 text-sm" style="color: var(--color-foreground);" placeholder="搜索 TMDB..." placeholder-style="color: var(--color-muted-foreground);" @input="onSearchInput" @confirm="emit('manual-search')" />
            </view>
            <view class="shrink-0 rounded-xl bg-primary flex items-center justify-center" style="height: 72rpx; width: 120rpx;" hover-class="opacity-80 active-scale" @tap="emit('manual-search')">
              <t-loading v-if="searching" theme="circular" size="32rpx" />
              <text v-else class="text-sm font-medium text-primary-foreground">搜索</text>
            </view>
          </view>

          <view class="mt-2 flex items-center gap-2">
            <view class="text-xs text-muted-foreground">类型由候选结果自动判断</view>

            <view v-if="selectedMediaType === 'tv'" class="flex items-center gap-2 ml-auto">
              <view class="flex items-center gap-1">
                <text class="text-xs text-muted-foreground">S</text>
                <input :value="String(season)" type="number" class="text-xs text-center rounded-md px-1" style="width: 92rpx; height: 52rpx; border: 1rpx solid var(--color-border); color: var(--color-foreground);" placeholder="1" placeholder-style="color: var(--color-muted-foreground);" @input="onSeasonInput" />
              </view>
              <view class="flex items-center gap-1">
                <text class="text-xs text-muted-foreground">E</text>
                <input :value="String(episode)" type="number" class="text-xs text-center rounded-md px-1" style="width: 110rpx; height: 52rpx; border: 1rpx solid var(--color-border); color: var(--color-foreground);" placeholder="1" placeholder-style="color: var(--color-muted-foreground);" @input="onEpisodeInput" />
              </view>
            </view>
          </view>

          <view class="mt-2 grid grid-cols-2 gap-2">
            <view class="flex items-center justify-center gap-1 rounded-xl py-2 bg-primary" :class="{ 'opacity-50': matchLoading }" hover-class="opacity-80 active-scale" @tap="emit('auto-match')">
              <t-loading v-if="matchLoading" theme="circular" size="28rpx" />
              <t-icon v-else name="search" size="28rpx" color="#fff" />
              <text class="text-sm font-medium text-primary-foreground">自动匹配</text>
            </view>

            <view class="flex items-center justify-center gap-1 rounded-xl py-2 bg-accent" :class="{ 'opacity-50': aiLoading }" hover-class="opacity-80 active-scale" @tap="emit('ai-recognize')">
              <t-loading v-if="aiLoading" theme="circular" size="28rpx" />
              <t-icon v-else name="root-list" size="28rpx" color="var(--color-accent-foreground)" />
              <text class="text-sm font-medium text-accent-foreground">AI 识别</text>
            </view>
          </view>
        </view>

        <view class="mt-3">
          <view class="flex items-center justify-between">
            <text class="text-xs font-medium text-muted-foreground">匹配结果</text>
            <text v-if="candidateCount > 0" class="text-xs text-muted-foreground">{{ candidateCount }} 条</text>
          </view>

          <view v-if="matchLoading || searching" class="mt-2 flex items-center justify-center py-6">
            <t-loading theme="circular" size="48rpx" />
            <text class="ml-2 text-sm text-muted-foreground">匹配中...</text>
          </view>

          <view v-else-if="candidateCards.length === 0" class="mt-2 py-6 text-center">
            <text class="text-sm text-muted-foreground">{{ autoMatchTried ? '没有找到候选结果，请尝试修改关键词' : '点击「自动匹配」或「AI 识别」开始' }}</text>
          </view>

          <view v-else class="mt-2 grid grid-cols-3 gap-1.5">
            <view v-for="(c, idx) in candidateCards" :key="c.id" class="relative rounded-xl overflow-hidden border-2 bg-card animate-scale-in" :style="{ animationDelay: (idx * 50) + 'ms' }" :class="selectedCandidate && selectedCandidate.id === c.id ? 'border-primary' : 'border-transparent'" :data-id="c.id" hover-class="opacity-80" @tap="onSelectCandidate">
              <MediaPoster :src="c.posterUrl" width="100%" height="300rpx" mode="aspectFill" rounded="rounded-none" />
              <view class="absolute top-1 left-1 rounded px-1.5 py-0.5 text-[20rpx] text-white" :class="c.mediaType === 'movie' ? 'bg-purple-500/90' : 'bg-blue-500/90'">{{ c.mediaType === 'movie' ? '电影' : '剧集' }}</view>
              <view class="p-1.5 bg-card">
                <text class="text-xs text-foreground" style="overflow: hidden; white-space: nowrap; text-overflow: ellipsis; display: block;">{{ c.displayName }}</text>
                <text class="text-xs text-muted-foreground">{{ c.displayYear }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="bg-background px-4 pt-2 pb-2">
      <view class="flex gap-2">
        <view class="w-1/3 flex items-center justify-center gap-1 py-3 rounded-xl bg-muted" :class="selectedCandidate && !previewLoading && !processing ? 'text-foreground' : 'text-muted-foreground'" hover-class="opacity-80 active-scale" @tap="emit('preview')">
          <t-loading v-if="previewLoading" theme="circular" size="30rpx" />
          <t-icon v-else name="search" size="30rpx" color="var(--color-muted-foreground)" />
          <text class="text-sm font-medium">预览</text>
        </view>

        <view class="flex-1 flex items-center justify-center gap-1 py-3 rounded-xl" :class="selectedCandidate && !processing ? 'bg-primary' : 'bg-muted'" hover-class="opacity-80 active-scale" @tap="emit('process')">
          <t-loading v-if="processing" theme="circular" size="32rpx" />
          <t-icon v-else name="check" size="32rpx" :color="selectedCandidate ? '#fff' : 'var(--color-muted-foreground)'" />
          <text class="text-sm font-medium" :class="selectedCandidate ? 'text-primary-foreground' : 'text-muted-foreground'">{{ processing ? '入库中...' : '确认入库' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>
