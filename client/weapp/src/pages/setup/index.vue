<script setup lang="ts">
import { ref } from 'wevu'
import { testConnection } from '@/utils/request'
import { useServerStore } from '@/stores/server'
import { useToast } from '@/hooks/useToast'

definePageJson({ disableScroll: true })

const serverStore = useServerStore()
const { showToast } = useToast()

const serverUrl = ref('')
const apiKey = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function onConnect() {
  const url = serverUrl.value.trim()
  if (!url) {
    errorMsg.value = '请输入服务器地址'
    return
  }
  errorMsg.value = ''
  loading.value = true

  try {
    const ok = await testConnection(url, apiKey.value.trim() || undefined)
    if (ok) {
      serverStore.save(url, apiKey.value.trim() || undefined)
      showToast('连接成功')
      wx.vibrateShort({ type: 'medium' })
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' })
      }, 600)
    }
    else {
      errorMsg.value = '无法连接到服务器，请检查地址'
      showToast('连接失败', 'error')
    }
  }
  catch {
    errorMsg.value = '网络错误，请检查网络连接'
    showToast('网络错误', 'error')
  }
  finally {
    loading.value = false
  }
}

function onUrlInput(e: WechatMiniprogram.CustomEvent) {
  serverUrl.value = e.detail.value
}

function onKeyInput(e: WechatMiniprogram.CustomEvent) {
  apiKey.value = e.detail.value
}
</script>

<template>
  <view style="height: 100vh; display: flex; flex-direction: column; overflow: hidden;">
    <t-navbar title="连接服务器" :fixed="false" />

    <scroll-view scroll-y style="flex: 1; min-height: 0;">
      <!-- Logo Area -->
      <view class="flex flex-col items-center px-4 pt-10">
        <view class="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
          <t-icon name="play-circle-stroke" size="48rpx" color="var(--color-primary-foreground)" />
        </view>
        <view class="mt-4 text-lg font-semibold text-foreground">MediaScraper</view>
        <view class="mt-1 text-xs text-muted-foreground">请连接您的服务器</view>
      </view>

      <!-- Form -->
      <view class="mt-10 px-4">
        <view class="pl-1 text-xs font-medium text-muted-foreground mb-1">🔗 连接信息</view>
        <view class="mt-2 rounded-xl bg-card p-3">
          <view class="text-xs text-muted-foreground mb-1">服务器地址</view>
          <t-input :value="serverUrl" placeholder="http://192.168.1.10:3000" clearable @change="onUrlInput" />
          <view class="h-px bg-border my-3"></view>
          <view class="text-xs text-muted-foreground mb-1">API Key (可选)</view>
          <t-input :value="apiKey" placeholder="留空则不使用" type="password" clearable @change="onKeyInput" />
        </view>

        <view v-if="errorMsg" class="mt-2 pl-1 text-xs text-destructive">{{ errorMsg }}</view>

        <t-button theme="primary" block :loading="loading" class="mt-6" @tap="onConnect">
          连接服务器
        </t-button>
      </view>
    </scroll-view>

  </view>
</template>
