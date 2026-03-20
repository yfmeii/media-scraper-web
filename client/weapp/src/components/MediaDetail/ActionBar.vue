<script setup lang="ts">
import type { MovieInfo } from '@media-scraper/shared'

defineProps<{
  tmdbId?: number
  movie?: MovieInfo | null
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'rematch'): void
  (e: 'move-movie'): void
}>()
</script>

<template>
  <view class="bg-background px-4 pt-2 pb-2">
    <view class="flex gap-2">
      <view v-if="tmdbId" class="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-primary" hover-class="opacity-80 active-scale" @tap="emit('refresh')">
        <t-icon name="refresh" size="32rpx" color="#fff" />
        <text class="text-sm font-medium text-primary-foreground">刷新元数据</text>
      </view>
      <view class="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-card" hover-class="opacity-70 active-scale" @tap="emit('rematch')">
        <t-icon name="search" size="32rpx" color="var(--color-foreground)" />
        <text class="text-sm font-medium text-foreground">{{ tmdbId ? '重新匹配' : '匹配' }}</text>
      </view>
    </view>

    <view v-if="movie" class="mt-2 flex items-center justify-center gap-1 py-2.5 rounded-xl border" style="border-color: rgba(220, 38, 38, 0.3);" hover-class="opacity-80 active-scale" @tap="emit('move-movie')">
      <t-icon name="inbox" size="32rpx" color="var(--color-destructive)" />
      <text class="text-sm font-medium text-destructive">移回收件箱</text>
    </view>
  </view>
</template>
