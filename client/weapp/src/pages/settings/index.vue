<script setup lang="ts">
import { computed, onShow, ref, storeToRefs, watch } from 'wevu'
import { useTabStore } from '@/stores/tab'
import { useServerStore } from '@/stores/server'
import { useToast } from '@/hooks/useToast'
import { DEFAULT_IMAGE_PROXY_URL } from '@/utils/config'
import TabBar from '@/components/TabBar/index.vue'

definePageJson({ disableScroll: true })

const tabStore = useTabStore()
const serverStore = useServerStore()
const {
  isConfigured,
  serverUrl,
  hasApiKey,
  connectionStatus,
  latency,
  imageProxyEnabled,
  imageProxyUrl,
} = storeToRefs(serverStore)
const { showToast } = useToast()
const proxyEnabled = ref(true)
const proxyUrl = ref(DEFAULT_IMAGE_PROXY_URL)

watch(
  [imageProxyEnabled, imageProxyUrl],
  ([enabled, url]) => {
    proxyEnabled.value = enabled
    proxyUrl.value = url || DEFAULT_IMAGE_PROXY_URL
  },
  { immediate: true },
)

// Initial connection check (runs once during setup)
if (isConfigured.value) {
  serverStore.checkConnection()
}

onShow(() => {
  tabStore.setActive(3)
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

function onToggleProxy() {
  proxyEnabled.value = !proxyEnabled.value
}

function onProxyUrlInput(e: WechatMiniprogram.CustomEvent) {
  proxyUrl.value = e.detail.value
}

function onResetProxy() {
  proxyEnabled.value = true
  proxyUrl.value = DEFAULT_IMAGE_PROXY_URL
}

function onSaveProxy() {
  if (!isConfigured.value) {
    showToast('请先配置服务器', 'warning')
    return
  }
  serverStore.saveImageProxy(proxyEnabled.value, proxyUrl.value)
  proxyUrl.value = proxyUrl.value.trim() || DEFAULT_IMAGE_PROXY_URL
  showToast('图片代理设置已保存')
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

      <!-- Image Proxy -->
      <view class="px-4">
        <view class="pl-1 text-xs font-medium text-muted-foreground mt-6 mb-1">🖼️ 图片代理</view>
        <view class="mt-2 rounded-xl bg-card p-3">
          <view class="flex items-center justify-between">
            <view class="pr-3">
              <view class="text-sm text-foreground">外链图片代理</view>
              <view class="mt-1 text-xs text-muted-foreground">用于 TMDB 等外链图片，降低防盗链和 TLS 问题</view>
            </view>
            <view
              class="shrink-0 rounded px-2 py-1 text-xs"
              :class="proxyEnabled ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
              hover-class="opacity-70"
              @tap="onToggleProxy"
            >{{ proxyEnabled ? '已开启' : '已关闭' }}</view>
          </view>

          <view class="h-px bg-border my-3"></view>

          <view class="text-xs text-muted-foreground mb-1">代理地址</view>
          <t-input
            :value="proxyUrl"
            placeholder="https://wsrv.nl/?url="
            clearable
            @change="onProxyUrlInput"
          />
          <view class="mt-1 text-xs text-muted-foreground">
            支持两种格式：1) 末尾拼接原图 URL；2) 用 <text class="text-foreground">{url}</text> 作为占位符
          </view>

          <view class="mt-3 flex gap-2">
            <view
              class="flex-1 rounded-xl bg-muted py-2 text-center text-sm text-muted-foreground"
              hover-class="opacity-70"
              @tap="onResetProxy"
            >恢复默认</view>
            <view
              class="flex-1 rounded-xl bg-primary py-2 text-center text-sm text-primary-foreground"
              hover-class="opacity-80"
              @tap="onSaveProxy"
            >保存设置</view>
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
  </view>
</template>
