<script setup lang="ts">
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

function handleError(e: WechatMiniprogram.CustomEvent) {
  emit('error', e.detail)
}

function handleLoad(e: WechatMiniprogram.CustomEvent) {
  emit('load', e.detail)
}
</script>

<template>
  <wxs module="tool" src="./tool.wxs" />

  <image
    :src="tool.getSrc(src, placeholderUrl)"
    :mode="tool.getMode(mode)"
    :lazy-load="tool.asBool(lazyLoad)"
    :show-menu-by-longpress="tool.asBool(showMenuByLongpress)"
    :fade-in="tool.asBool(fadeIn)"
    :style="tool.getStyle(width, height)"
    @error="handleError"
    @load="handleLoad"
  />
</template>
