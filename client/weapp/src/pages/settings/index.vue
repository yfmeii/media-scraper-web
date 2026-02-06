<script setup lang="ts">
import { computed, onShow, storeToRefs } from 'wevu'
import { useTabStore } from '@/stores/tab'
import { useServerStore } from '@/stores/server'
import { useToast } from '@/hooks/useToast'
import TabBar from '@/components/TabBar/index.vue'

definePageJson({ disableScroll: true })

const tabStore = useTabStore()
const serverStore = useServerStore()
const { isConfigured, serverUrl, hasApiKey, connectionStatus, latency } = storeToRefs(serverStore)
const { showToast } = useToast()

onShow(() => {
  tabStore.setActive(3)
  if (isConfigured.value) {
    serverStore.checkConnection()
  }
})

const displayUrl = computed(() => isConfigured.value ? serverUrl.value : '未配置')

function onTestConnection() {
  if (isConfigured.value) {
    serverStore.checkConnection()
    showToast('正在测试...', 'loading')
  }
  else {
    showToast('请先配置服务器', 'warning')
  }
}

function onDisconnect() {
  wx.showModal({
    title: '断开连接',
    content: '确定要断开当前服务器连接吗？',
    confirmColor: '#DC2626',
    success(res) {
      if (res.confirm) {
        serverStore.clear()
        showToast('已断开')
        wx.redirectTo({ url: '/pages/setup/index' })
      }
    },
  })
}

function onChangeServer() {
  wx.navigateTo({ url: '/pages/setup/index' })
}

const statusText = computed(() => {
  const status = connectionStatus.value
  if (status === 'online') return '\u5728\u7EBF (' + latency.value + 'ms)'
  if (status === 'offline') return '离线'
  if (status === 'checking') return '检测中...'
  return '未知'
})

const statusColor = computed(() => {
  const status = connectionStatus.value
  if (status === 'online') return 'var(--color-success)'
  if (status === 'offline') return 'var(--color-destructive)'
  return 'var(--color-muted-foreground)'
})
</script>

<template>
  <view style="height: 100vh; display: flex; flex-direction: column; overflow: hidden;">
    <t-navbar title="设置" :fixed="false" />

    <scroll-view scroll-y style="flex: 1; min-height: 0;">
      <!-- Server Connection -->
      <view class="px-4 pt-3">
        <view class="pl-1 text-xs font-medium text-muted-foreground mb-1">🔗 服务器连接</view>
        <view class="mt-2 rounded-xl bg-card p-3">
          <view class="flex items-center">
            <view class="text-sm text-foreground">地址</view>
            <view class="flex-1 text-right text-xs text-muted-foreground ml-3" style="overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">{{ displayUrl }}</view>
          </view>
          <view class="h-px bg-border my-3"></view>
          <view class="flex items-center">
            <view class="text-sm text-foreground">API Key</view>
            <view class="flex-1 text-right text-xs text-muted-foreground">{{ hasApiKey ? '已配置' : '未配置' }}</view>
          </view>
          <view class="h-px bg-border my-3"></view>
          <view class="flex items-center">
            <view class="text-sm text-foreground">状态</view>
            <view class="flex-1 flex items-center justify-end gap-1">
              <view class="h-1.5 w-1.5 rounded-full" :style="{ backgroundColor: statusColor }" />
              <view class="text-xs" :style="{ color: statusColor }">{{ statusText }}</view>
            </view>
          </view>
        </view>
      </view>

      <!-- Actions -->
      <view class="px-4">
        <view class="pl-1 text-xs font-medium text-muted-foreground mt-6 mb-1">⚙️ 操作</view>
        <view class="mt-2 rounded-xl bg-card">
          <view class="p-3 flex items-center" hover-class="opacity-70" @tap="onTestConnection">
            <view class="flex-1 text-sm text-foreground">测试连接</view>
            <t-icon name="chevron-right" size="32rpx" color="var(--color-muted-foreground)" />
          </view>
          <view class="h-px bg-border mx-3"></view>
          <view class="p-3 flex items-center" hover-class="opacity-70" @tap="onChangeServer">
            <view class="flex-1 text-sm text-foreground">更换服务器</view>
            <t-icon name="chevron-right" size="32rpx" color="var(--color-muted-foreground)" />
          </view>
          <view class="h-px bg-border mx-3"></view>
          <view class="p-3 flex items-center" hover-class="opacity-70" @tap="onDisconnect">
            <view class="flex-1 text-sm text-destructive">断开连接</view>
            <view class="text-xs text-muted-foreground">危险操作</view>
          </view>
        </view>
      </view>

      <!-- About -->
      <view class="px-4">
        <view class="pl-1 text-xs font-medium text-muted-foreground mt-6 mb-1">ℹ️ 关于</view>
        <view class="mt-2 rounded-xl bg-card p-3">
          <view class="flex items-center">
            <view class="text-sm text-foreground">版本</view>
            <view class="flex-1 text-right text-xs text-muted-foreground">1.0.0</view>
          </view>
          <view class="h-px bg-border my-3"></view>
          <view class="flex items-center">
            <view class="text-sm text-foreground">框架</view>
            <view class="flex-1 text-right text-xs text-muted-foreground">wevu + weapp-vite + TDesign</view>
          </view>
        </view>
      </view>

      <!-- Footer -->
      <view class="mt-8 px-4 pb-4">
        <view class="text-xs text-muted-foreground text-center leading-relaxed">
          MediaScraper · 媒体库管理工具
        </view>
      </view>
    </scroll-view>

    <TabBar />
    <t-toast id="t-toast" />
  </view>
</template>
