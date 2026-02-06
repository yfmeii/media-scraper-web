<script setup lang="ts">
import { onShow, ref } from 'wevu'
import { clearServerConfig, getServerConfig } from '@/utils/config'
import { testConnection } from '@/utils/request'
import { useTabStore } from '@/stores/tab'
import { useToast } from '@/hooks/useToast'
import TabBar from '@/components/TabBar/index.vue'

definePageJson({ disableScroll: true })

const tabStore = useTabStore()
const { showToast } = useToast()

const serverUrl = ref('')
const serverApiKey = ref(false)
const connectionStatus = ref<'checking' | 'online' | 'offline'>('checking')
const latency = ref(0)

onShow(() => {
  loadConfig()
  tabStore.setActive(3)
})

function loadConfig() {
  const config = getServerConfig()
  if (config) {
    serverUrl.value = config.url
    serverApiKey.value = !!config.apiKey
    checkConnection(config.url, config.apiKey)
  }
  else {
    serverUrl.value = '未配置'
    connectionStatus.value = 'offline'
  }
}

async function checkConnection(url: string, apiKey?: string) {
  connectionStatus.value = 'checking'
  const start = Date.now()
  try {
    const ok = await testConnection(url, apiKey)
    latency.value = Date.now() - start
    connectionStatus.value = ok ? 'online' : 'offline'
  }
  catch {
    latency.value = 0
    connectionStatus.value = 'offline'
  }
}

function onTestConnection() {
  const config = getServerConfig()
  if (config) {
    checkConnection(config.url, config.apiKey)
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
        clearServerConfig()
        showToast('已断开')
        wx.redirectTo({ url: '/pages/setup/index' })
      }
    },
  })
}

function onChangeServer() {
  wx.navigateTo({ url: '/pages/setup/index' })
}

function getStatusText(): string {
  switch (connectionStatus.value) {
    case 'online': return `在线 (${latency.value}ms)`
    case 'offline': return '离线'
    case 'checking': return '检测中...'
  }
}

function getStatusColor(): string {
  switch (connectionStatus.value) {
    case 'online': return 'var(--color-success)'
    case 'offline': return 'var(--color-destructive)'
    case 'checking': return 'var(--color-muted-foreground)'
  }
}
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
            <view class="flex-1 text-right text-xs text-muted-foreground ml-3" style="overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">{{ serverUrl }}</view>
          </view>
          <view class="h-px bg-border my-3"></view>
          <view class="flex items-center">
            <view class="text-sm text-foreground">API Key</view>
            <view class="flex-1 text-right text-xs text-muted-foreground">{{ serverApiKey ? '已配置' : '未配置' }}</view>
          </view>
          <view class="h-px bg-border my-3"></view>
          <view class="flex items-center">
            <view class="text-sm text-foreground">状态</view>
            <view class="flex-1 flex items-center justify-end gap-1">
              <view class="h-1.5 w-1.5 rounded-full" :style="{ backgroundColor: getStatusColor() }" />
              <view class="text-xs" :style="{ color: getStatusColor() }">{{ getStatusText() }}</view>
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
