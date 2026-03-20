<script setup lang="ts">
import type { MovieInfo, SeasonInfo, SeasonMissingInfo, ShowInfo } from '@media-scraper/shared/types'
import MediaPoster from '@/components/MediaPoster/index.vue'

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
  seasons: SeasonInfo[]
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
          <text class="text-sm font-medium text-foreground">{{ fmt.formatRating(rating) }}</text>
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

    <view v-if="movie" class="px-4 pb-3">
      <view class="rounded-xl bg-card p-3">
        <view class="text-xs font-medium text-foreground mb-1.5">文件信息</view>
        <view class="text-xs text-muted-foreground">{{ movie.file.name }}</view>
        <view v-if="movie.file.parsed.resolution" class="mt-1 flex flex-wrap gap-1.5">
          <view v-if="movie.file.parsed.resolution" class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{{ movie.file.parsed.resolution }}</view>
          <view v-if="movie.file.parsed.codec" class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{{ movie.file.parsed.codec }}</view>
          <view v-if="movie.file.parsed.source" class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{{ movie.file.parsed.source }}</view>
        </view>
        <view class="mt-1 text-xs text-muted-foreground">{{ fmt.formatFileSize(movie.file.size) }}</view>
      </view>
    </view>

    <view v-if="show && missingEpisodes.length > 0" class="px-4 pb-3">
      <view class="rounded-xl border border-warning/40 bg-warning/5 p-3">
        <view class="flex items-center gap-1.5 mb-2">
          <t-icon name="error-circle" size="28rpx" color="var(--color-warning)" />
          <text class="text-xs font-medium text-warning">共缺 {{ totalMissingCount }} 集</text>
        </view>
        <view class="flex flex-wrap gap-1">
          <view v-for="item in flatMissingEpisodes" :key="`${item.season}-${item.ep}`" class="rounded bg-warning/10 px-1.5 py-0.5 text-xs text-warning">{{ fmt.formatEpisodeCode(item.season, item.ep) }}</view>
        </view>
      </view>
    </view>

    <view v-if="show && seasons.length > 0" class="px-4 pb-3">
      <view class="rounded-xl bg-card overflow-hidden">
        <view v-for="(season, sIdx) in seasons" :key="season.season">
          <view class="flex items-center justify-between px-3 py-2.5" hover-class="opacity-70" :data-season="season.season" @tap="emit('season-tap', $event)">
            <view class="flex items-center gap-2">
              <t-icon :name="expandedMap[season.season] ? 'chevron-down' : 'chevron-right'" size="32rpx" color="var(--color-muted-foreground)" />
              <text class="text-sm font-medium text-foreground">第 {{ season.season }} 季</text>
              <text class="text-xs text-muted-foreground">{{ season.episodes.length }} 集</text>
              <view v-if="seasonMissingMap[season.season]" class="rounded bg-warning/10 px-1 py-0.5 text-xs text-warning">缺 {{ seasonMissingMap[season.season].length }}</view>
            </view>
            <view class="flex items-center gap-2">
              <view v-if="show.tmdbId" class="flex items-center justify-center" hover-class="opacity-50" :data-season="season.season" @tap.stop="emit('refresh-season-tap', $event)">
                <t-icon name="refresh" size="32rpx" color="var(--color-muted-foreground)" />
              </view>
            </view>
          </view>

          <view v-if="expandedMap[season.season]" class="animate-fade-in">
            <view v-for="ep in season.episodes" :key="ep.path">
              <view class="h-px bg-border mx-3" />
              <view class="flex items-center justify-between px-3 py-2" hover-class="bg-muted/50" :data-path="ep.path" @tap.stop="emit('episode-item-tap', $event)">
                <view class="flex-1 min-w-0">
                  <view class="flex items-center gap-1.5">
                    <text class="text-xs font-medium text-foreground">{{ fmt.getEpisodeLabel(ep) }}</text>
                    <view v-if="ep.hasNfo" class="h-1.5 w-1.5 rounded-full bg-green-500" />
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
  </view>
</template>
