<script setup lang="ts">
import type { MovieInfo, ShowInfo } from '@media-scraper/shared'
import DetailBody from './DetailBody.vue'
import ActionBar from './ActionBar.vue'
import MediaHeaderBar from './MediaHeaderBar.vue'
import { useMediaDetail } from './useMediaDetail'

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

const {
  assets,
  expandedMap,
  flatMissingEpisodes,
  handleRefreshMetadata,
  handleRematch,
  hasNfo,
  localVisible,
  missingEpisodes,
  name,
  onClose,
  onEpisodeItemTap,
  onMoveMovieTap,
  onRefreshSeasonTap,
  onScroll,
  onSeasonTap,
  onVisibleChange,
  operationLoading,
  overview,
  posterUrl,
  rating,
  seasonMissingMap,
  seasons,
  titleOpacity,
  tmdbId,
  topBarOpacity,
  totalEpisodes,
  totalMissingCount,
  year,
} = useMediaDetail({
  props,
  emitClose: () => emit('close'),
  emitRefresh: () => emit('refresh'),
  emitRematch: payload => emit('rematch', payload),
})
</script>

<template>
  <t-popup
    :visible="localVisible"
    placement="bottom"
    :close-on-overlay-click="true"
    @visible-change="onVisibleChange"
    style="--td-popup-bg-color: var(--color-background);"
  >
    <view class="bg-background relative" style="border-top-left-radius: 24rpx; border-top-right-radius: 24rpx;">
      <MediaHeaderBar :name="name" :top-bar-opacity="topBarOpacity" :title-opacity="titleOpacity" @close="onClose" />

      <scroll-view scroll-y style="max-height: calc(85vh - 120rpx - env(safe-area-inset-bottom));" @scroll="onScroll">
        <DetailBody
          :movie="movie"
          :show="show"
          :poster-url="posterUrl"
          :name="name"
          :year="year"
          :rating="rating"
          :overview="overview"
          :tmdb-id="tmdbId"
          :has-nfo="hasNfo"
          :assets="assets"
          :seasons="seasons"
          :total-episodes="totalEpisodes"
          :missing-episodes="missingEpisodes"
          :total-missing-count="totalMissingCount"
          :flat-missing-episodes="flatMissingEpisodes"
          :season-missing-map="seasonMissingMap"
          :expanded-map="expandedMap"
          @season-tap="onSeasonTap"
          @refresh-season-tap="onRefreshSeasonTap"
          @episode-item-tap="onEpisodeItemTap"
        />
      </scroll-view>

      <ActionBar :tmdb-id="tmdbId" :movie="movie" @refresh="handleRefreshMetadata" @rematch="handleRematch" @move-movie="onMoveMovieTap" />

      <view v-if="operationLoading" class="absolute inset-0 flex items-center justify-center" style="background: rgba(255, 255, 255, 0.6); border-top-left-radius: 24rpx; border-top-right-radius: 24rpx;">
        <t-loading theme="circular" size="48rpx" />
      </view>
    </view>
  </t-popup>
</template>
