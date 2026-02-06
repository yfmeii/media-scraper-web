<script setup lang="ts">
import type { Stats } from '@media-scraper/shared'
import { onShow, ref, storeToRefs } from 'wevu'
import { fetchStats } from '@/utils/api'
import { useTabStore } from '@/stores/tab'
import { useServerStore } from '@/stores/server'
import { useToast } from '@/hooks/useToast'
import TabBar from '@/components/TabBar/index.vue'

definePageJson({ disableScroll: true })

const tabStore = useTabStore()
const serverStore = useServerStore()
const { isConfigured } = storeToRefs(serverStore)
const { showToast } = useToast()
const stats = ref<Stats | null>(null)
const loading = ref(true)
const refreshing = ref(false)

async function loadStats() {
  if (!isConfigured.value) {
    wx.redirectTo({ url: '/pages/setup/index' })
    return
  }
  loading.value = true
  try {
    stats.value = await fetchStats()
  }
  catch {
    showToast('加载失败', 'error')
  }
  finally {
    loading.value = false
  }
}

onShow(() => {
  loadStats()
  tabStore.setActive(0)
})

async function onRefresh() {
  refreshing.value = true
  await loadStats()
  refreshing.value = false
}

function goInbox() {
  wx.switchTab({ url: '/pages/inbox/index' })
}

function goLibrary() {
  wx.switchTab({ url: '/pages/library/index' })
}
</script>

<template>
  <view style="height: 100vh; display: flex; flex-direction: column; overflow: hidden;">
    <t-navbar title="MediaScraper" :fixed="false" />

    <scroll-view
      scroll-y
      style="flex: 1; min-height: 0;"
      :refresher-enabled="true"
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
    >
      <!-- Stats Section -->
      <view class="px-4 pt-3">
        <view class="pl-1 text-xs font-medium text-muted-foreground mb-1">📊 媒体统计</view>
        <view class="mt-2 rounded-xl bg-card">
          <block v-if="loading">
            <view class="flex text-center p-3 py-2 text-sm font-medium text-muted-foreground">
              <view class="flex-1">剧集</view>
              <view class="flex-1">电影</view>
              <view class="flex-1">收件箱</view>
            </view>
            <view class="h-px bg-border"></view>
            <view class="flex p-3">
              <view v-for="i in 3" :key="i" class="flex-1 flex flex-col items-center">
                <view class="h-6 w-8 rounded bg-muted skeleton-pulse" />
                <view class="mt-2 h-2.5 w-16 rounded bg-muted skeleton-pulse" />
              </view>
            </view>
          </block>
          <block v-else>
            <view class="flex text-center p-3 py-2 text-sm font-medium text-muted-foreground">
              <view class="flex-1">剧集</view>
              <view class="flex-1">电影</view>
              <view class="flex-1">收件箱</view>
            </view>
            <view class="h-px bg-border"></view>
            <view class="flex p-3">
              <view class="flex-1 text-center">
                <view class="text-xl font-bold text-primary" style="line-height: 1;">
                  {{ (stats && stats.tvShows) || 0 }}
                </view>
                <view class="text-xs text-muted-foreground mt-1">
                  {{ (stats && stats.tvEpisodes) || 0 }} 集 · {{ (stats && stats.tvProcessed) || 0 }} 已刮
                </view>
              </view>
              <view class="flex-1 text-center">
                <view class="text-xl font-bold text-primary" style="line-height: 1;">
                  {{ (stats && stats.movies) || 0 }}
                </view>
                <view class="text-xs text-muted-foreground mt-1">
                  {{ (stats && stats.moviesProcessed) || 0 }} 已刮
                </view>
              </view>
              <view class="flex-1 text-center">
                <view class="text-xl font-bold text-primary" style="line-height: 1;">
                  {{ (stats && stats.inbox) || 0 }}
                </view>
                <view class="text-xs text-muted-foreground mt-1">待处理</view>
              </view>
            </view>
          </block>
        </view>
      </view>

      <!-- Quick Actions -->
      <view class="px-4 pb-4">
        <view class="pl-1 text-xs font-medium text-muted-foreground mt-6 mb-1">⚡ 快速操作</view>
        <view class="mt-2 rounded-xl bg-card p-3">
          <view class="flex items-center" hover-class="opacity-70" @tap="goInbox">
            <view class="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
              <t-icon name="mail" size="32rpx" color="var(--color-accent-foreground)" />
            </view>
            <view class="flex-1 ml-3">
              <view class="text-sm font-medium text-foreground">收件箱</view>
            </view>
            <view class="text-xs text-muted-foreground mr-1">{{ (stats && stats.inbox) || 0 }} 待处理</view>
            <t-icon name="chevron-right" size="32rpx" color="var(--color-muted-foreground)" />
          </view>
          <view class="h-px bg-border my-3"></view>
          <view class="flex items-center" hover-class="opacity-70" @tap="goLibrary">
            <view class="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
              <t-icon name="video-library" size="32rpx" color="var(--color-accent-foreground)" />
            </view>
            <view class="flex-1 ml-3">
              <view class="text-sm font-medium text-foreground">媒体库</view>
            </view>
            <view class="text-xs text-muted-foreground mr-1">浏览管理</view>
            <t-icon name="chevron-right" size="32rpx" color="var(--color-muted-foreground)" />
          </view>
        </view>
      </view>
    </scroll-view>

    <TabBar />
    <t-toast id="t-toast" />
  </view>
</template>
