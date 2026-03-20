<script setup lang="ts">
import type { MediaFile, SeasonInfo, ShowInfo } from '@media-scraper/shared'
import { formatFileSizeLabel, getEpisodeCode, getEpisodeTitle } from '@/utils/display'

defineProps<{
  show?: ShowInfo | null
  seasons: SeasonInfo[]
  seasonMissingMap: Record<number, number[]>
  expandedMap: Record<number, boolean>
}>()

const emit = defineEmits<{
  (e: 'season-tap', payload: WechatMiniprogram.CustomEvent): void
  (e: 'refresh-season-tap', payload: WechatMiniprogram.CustomEvent): void
  (e: 'episode-item-tap', payload: WechatMiniprogram.CustomEvent): void
}>()

function getEpisodeMetaVisible(ep: MediaFile) {
  return !!(ep.parsed && (ep.parsed.resolution || formatFileSizeLabel(ep.size)))
}
</script>

<template>
  <view v-if="show && seasons.length > 0" class="px-4 pb-3">
    <view class="rounded-xl bg-card overflow-hidden">
      <view v-for="(season, sIdx) in seasons" :key="season.season">
        <view class="flex items-center justify-between px-3 py-2.5" hover-class="opacity-70" :data-season="season.season" @tap="emit('season-tap', $event)">
          <view class="flex items-center gap-2">
            <t-icon :name="expandedMap[season.season] ? 'chevron-down' : 'chevron-right'" size="32rpx" color="var(--color-muted-foreground)" />
            <text class="text-sm font-medium text-foreground">第 {{ season.season }} 季</text>
            <text class="text-xs text-muted-foreground">{{ season.episodes.length }} 集</text>
            <view v-if="seasonMissingMap[season.season]" class="rounded px-1 py-0.5 text-xs text-warning" style="background: rgba(245, 158, 11, 0.1);">缺 {{ seasonMissingMap[season.season].length }}</view>
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
            <view class="flex items-center justify-between px-3 py-2" hover-class="opacity-70" :data-path="ep.path" @tap.stop="emit('episode-item-tap', $event)">
              <view class="flex-1 min-w-0">
                <view class="flex items-center gap-1.5">
                  <text class="text-xs font-medium text-foreground">{{ getEpisodeCode(ep) }}</text>
                  <view v-if="ep.hasNfo" class="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <view v-else class="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                </view>
                <view class="mt-0.5 text-xs text-muted-foreground truncate">{{ getEpisodeTitle(ep) }}</view>
                <view v-if="getEpisodeMetaVisible(ep)" class="mt-0.5 flex items-center gap-1">
                  <text v-if="ep.parsed?.resolution" class="text-xs text-muted-foreground" style="opacity: 0.6;">{{ ep.parsed.resolution }}</text>
                  <text v-if="formatFileSizeLabel(ep.size)" class="text-xs text-muted-foreground" style="opacity: 0.6;">{{ formatFileSizeLabel(ep.size) }}</text>
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
</template>
