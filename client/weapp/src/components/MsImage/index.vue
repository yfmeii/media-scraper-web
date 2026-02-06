<script setup lang="ts">
import { ref, watch } from 'wevu'

defineComponentJson({ styleIsolation: 'apply-shared' })

type ImageMode = 'aspectFill' | 'scaleToFill' | 'aspectFit' | 'widthFix' | 'heightFix' | 'top' | 'bottom' | 'center' | 'left' | 'right' | 'top left' | 'top right' | 'bottom left' | 'bottom right'

const props = defineProps<{
  src?: string
  mode?: ImageMode
  lazyLoad?: boolean
  showMenuByLongpress?: boolean
  fadeIn?: boolean
  placeholderUrl?: string
  errorUrl?: string
  /** 图片宽度 (inline style)，如 "100%"、"110rpx" */
  width?: string
  /** 图片高度 (inline style)，如 "300rpx"、"160rpx" */
  height?: string
}>()

const emit = defineEmits<{
  (e: 'error', detail: unknown): void
  (e: 'load', detail: unknown): void
}>()

/** Local file path after downloading HTTP images */
const localSrc = ref('')
const error = ref(false)
const loading = ref(false)

// Simple in-memory cache shared across all MsImage instances
const _cache: Record<string, string> = {}
const _inflight: Record<string, Promise<string>> = {}

function downloadFile(url: string): Promise<string> {
  if (url in _cache) return Promise.resolve(_cache[url])
  if (url in _inflight) return _inflight[url]

  const promise = new Promise<string>((resolve) => {
    wx.downloadFile({
      url,
      success(res) {
        if (res.statusCode === 200 && res.tempFilePath) {
          _cache[url] = res.tempFilePath
          resolve(res.tempFilePath)
        } else {
          resolve('')
        }
      },
      fail() {
        resolve('')
      },
      complete() {
        delete _inflight[url]
      },
    })
  })
  _inflight[url] = promise
  return promise
}

function resolveSrc(src: string) {
  error.value = false
  localSrc.value = ''

  if (!src) return

  // HTTPS or local paths can be used directly
  if (src.startsWith('https://') || src.startsWith('wxfile://') || src.startsWith('/')) {
    localSrc.value = src
    return
  }

  // HTTP links must be downloaded first (mini-program <image> rejects HTTP)
  if (src.startsWith('http://')) {
    loading.value = true
    downloadFile(src).then((path) => {
      loading.value = false
      if (path) {
        localSrc.value = path
      } else {
        error.value = true
      }
    })
    return
  }

  // Any other value, use as-is
  localSrc.value = src
}

watch(() => props.src, (val) => resolveSrc(val || ''), { immediate: true })

function handleError(e: WechatMiniprogram.CustomEvent) {
  error.value = true
  emit('error', e.detail)
}

function handleLoad(e: WechatMiniprogram.CustomEvent) {
  emit('load', e.detail)
}
</script>

<template>
  <wxs module="tool" src="./tool.wxs" />
  <image
    :src="tool.handleUrl(localSrc, error, placeholderUrl || '', errorUrl || '')"
    :mode="mode || 'aspectFill'"
    :lazy-load="!!lazyLoad"
    :show-menu-by-longpress="!!showMenuByLongpress"
    :fade-in="!!fadeIn"
    :style="`display:block;width:${width || '100%'};height:${height || 'auto'};`"
    @error="handleError"
    @load="handleLoad"
  />
</template>
