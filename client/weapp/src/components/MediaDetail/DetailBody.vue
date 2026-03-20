<script setup lang="ts">
import type { MovieInfo, SeasonMissingInfo, ShowInfo } from '@media-scraper/shared'
import MediaPoster from '@/components/MediaPoster/index.vue'
import { formatFileSizeLabel, formatVoteRatingWithScale, getMediaFileDisplayName } from '@/utils/display'
import SeasonList from './SeasonList.vue'

function getMovieFileName(file?: MovieInfo['file']): string {
  if (!file) return '未知文件'
  return getMediaFileDisplayName(file)
}

defineProps<{
  movie?: MovieInfo | null
  show?: ShowInfo | null
  posterUrl: string
  name: string
  year?: number
  rating?: number
  overview: string
  tmdbId?: number
  hasNfo: boolean
  assets?: MovieInfo['assets'] | ShowInfo['assets']
  seasons: ShowInfo['seasons']
  totalEpisodes: number
  missingEpisodes: SeasonMissingInfo[]
  totalMissingCount: number
  flatMissingEpisodes: Array<{ season: number, ep: number }>
  seasonMissingMap: Record<number, number[]>
  expandedMap: Record<number, boolean>
}>()

const emit = defineEmits<{
  (e: 'season-tap', payload: WechatMiniprogram.CustomEvent): void
  (e: 'refresh-season-tap', payload: WechatMiniprogram.CustomEvent): void
  (e: 'episode-item-tap', payload: WechatMiniprogram.CustomEvent): void
}>()
</script>

<template>
  <wxs module="fmt" src="../../utils/format.wxs" />

  <view class="animate-fade-in-up">
    <view style="height: 88rpx;" />

    <view class="px-4 pb-3 flex gap-3">
      <MediaPoster :src="posterUrl" width="200rpx" height="280rpx" class="shrink-0" />
      <view class="flex-1 py-1">
        <view class="text-base font-semibold text-foreground">{{ name }}</view>
        <view class="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <text v-if="year">{{ year }}</text>
          <text v-if="year && (movie || show)"> · </text>
          <text v-if="movie && movie.runtime">{{ movie.runtime }} 分钟</text>
          <text v-if="show">{{ seasons.length }} 季 · {{ totalEpisodes }} 集</text>
        </view>
        <view v-if="rating" class="mt-1.5 flex items-center gap-1">
          <t-icon name="star-filled" size="28rpx" color="var(--color-warning)" />
          <text class="text-xs font-medium" style="color: var(--color-foreground); line-height: 1;">{{ formatVoteRatingWithScale(rating) }}</text>
        </view>
        <view class="mt-2 flex flex-wrap gap-1.5">
          <view class="rounded px-1.5 py-0.5 text-xs" :class="hasNfo ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'">{{ hasNfo ? '已刮削' : '未刮削' }}</view>
          <view v-if="assets" class="flex gap-1">
            <view class="rounded px-1.5 py-0.5 text-xs" :class="assets.hasPoster ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'">海报</view>
            <view class="rounded px-1.5 py-0.5 text-xs" :class="assets.hasFanart ? 'bg-purple-100 text-purple-700' : 'bg-muted text-muted-foreground'">背景</view>
          </view>
        </view>
        <view v-if="tmdbId" class="mt-1.5 text-xs text-muted-foreground">TMDB: {{ tmdbId }}</view>
      </view>
    </view>

    <view v-if="overview" class="px-4 pb-3">
      <view class="text-xs text-muted-foreground leading-relaxed">{{ overview }}</view>
    </view>

    <view v-if="movie && movie.file" class="px-4 pb-3">
      <view class="rounded-xl bg-card p-3">
        <view class="text-xs font-medium text-foreground mb-1.5">文件信息</view>
        <view class="text-xs text-muted-foreground">{{ getMovieFileName(movie.file) }}</view>
        <view v-if="movie.file.parsed.resolution || movie.file.parsed.codec || movie.file.parsed.source" class="mt-1 flex flex-wrap gap-1.5">
          <view v-if="movie.file.parsed.resolution" class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{{ movie.file.parsed.resolution }}</view>
          <view v-if="movie.file.parsed.codec" class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{{ movie.file.parsed.codec }}</view>
          <view v-if="movie.file.parsed.source" class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{{ movie.file.parsed.source }}</view>
        </view>
        <view v-if="formatFileSizeLabel(movie.file.size)" class="mt-1 text-xs text-muted-foreground">{{ formatFileSizeLabel(movie.file.size) }}</view>
      </view>
    </view>

    <view v-if="show && missingEpisodes.length > 0" class="px-4 pb-3">
      <view class="rounded-xl p-3" style="border: 1rpx solid rgba(245, 158, 11, 0.4); background: rgba(245, 158, 11, 0.05);">
        <view class="flex items-center gap-1.5 mb-2">
          <t-icon name="error-circle" size="28rpx" color="var(--color-warning)" />
          <text class="text-xs font-medium text-warning">共缺 {{ totalMissingCount }} 集</text>
        </view>
        <view class="flex flex-wrap gap-1">
          <view v-for="item in flatMissingEpisodes" :key="`${item.season}-${item.ep}`" class="rounded px-1.5 py-0.5 text-xs text-warning" style="background: rgba(245, 158, 11, 0.1);">{{ fmt.formatEpisodeCode(item.season, item.ep) }}</view>
        </view>
      </view>
    </view>
    <SeasonList
      :show="show"
      :seasons="seasons"
      :season-missing-map="seasonMissingMap"
      :expanded-map="expandedMap"
      @season-tap="emit('season-tap', $event)"
      @refresh-season-tap="emit('refresh-season-tap', $event)"
      @episode-item-tap="emit('episode-item-tap', $event)"
    />
  </view>
</template>
