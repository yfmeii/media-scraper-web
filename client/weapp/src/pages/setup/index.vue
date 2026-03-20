<script setup lang="ts">
import { onLoad, onShow, ref, storeToRefs } from 'wevu'
import { testConnection } from '@/utils/request'
import { useServerStore } from '@/stores/server'
import { useToast } from '@/hooks/useToast'

definePageJson({ disableScroll: true })

const serverStore = useServerStore()
const { isConfigured, serverUrl: savedServerUrl } = storeToRefs(serverStore)
const { showToast } = useToast()

const serverUrl = ref('')
const apiKey = ref('')
const loading = ref(false)
const errorMsg = ref('')
const allowEditMode = ref(false)

onLoad((query) => {
  allowEditMode.value = query?.mode === 'edit'
})

onShow(() => {
  if (!isConfigured.value || allowEditMode.value) {
    if (!serverUrl.value && savedServerUrl.value) {
      serverUrl.value = savedServerUrl.value
    }
    return
  }
  if (!serverUrl.value && savedServerUrl.value) {
    serverUrl.value = savedServerUrl.value
  }
  setTimeout(() => {
    const current = getCurrentPages()[getCurrentPages().length - 1]?.route
    if (current === 'pages/setup/index') {
      wx.switchTab({ url: '/pages/index/index' })
    }
  }, 0)
})

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
    <t-navbar :title="allowEditMode ? '更换服务器' : '连接服务器'" :left-arrow="allowEditMode" :fixed="false" />

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
          <input
            :value="serverUrl"
            class="rounded-lg px-3 text-sm"
            style="width: 100%; box-sizing: border-box; height: 76rpx; border: 1rpx solid var(--color-border); color: var(--color-foreground); background: var(--color-background);"
            placeholder="http://192.168.1.10:3000"
            placeholder-style="color: var(--color-muted-foreground);"
            @input="onUrlInput"
          />
          <view class="h-px bg-border my-3"></view>
          <view class="text-xs text-muted-foreground mb-1">API Key (可选)</view>
          <input
            :value="apiKey"
            password
            class="rounded-lg px-3 text-sm"
            style="width: 100%; box-sizing: border-box; height: 76rpx; border: 1rpx solid var(--color-border); color: var(--color-foreground); background: var(--color-background);"
            placeholder="留空则不使用"
            placeholder-style="color: var(--color-muted-foreground);"
            @input="onKeyInput"
          />
        </view>

        <view v-if="errorMsg" class="mt-2 pl-1 text-xs text-destructive">{{ errorMsg }}</view>

        <t-button theme="primary" block :loading="loading" class="mt-6" @tap="onConnect">
          连接服务器
        </t-button>
      </view>
    </scroll-view>

  </view>
</template>
