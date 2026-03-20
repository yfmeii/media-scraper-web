<script setup lang="ts">
import { computed, ref, watch } from 'wevu'

defineComponentJson({ styleIsolation: 'apply-shared' })

type ImageMode = 'aspectFill' | 'scaleToFill' | 'aspectFit' | 'widthFix' | 'heightFix' | 'top' | 'bottom' | 'center' | 'left' | 'right' | 'top left' | 'top right' | 'bottom left' | 'bottom right'

const props = defineProps({
  // 接收任意类型，内部统一转成字符串，避免小程序 props 类型告警
  src: {
    type: null,
    default: '',
  },
  mode: String,
  lazyLoad: Boolean,
  showMenuByLongpress: Boolean,
  fadeIn: Boolean,
  placeholderUrl: String,
  errorUrl: String,
  /** 图片宽度 (inline style)，如 "100%"、"110rpx" */
  width: String,
  /** 图片高度 (inline style)，如 "300rpx"、"160rpx" */
  height: String,
})

const emit = defineEmits<{
  (e: 'error', detail: unknown): void
  (e: 'load', detail: unknown): void
}>()

const imageSrc = computed(() => {
  const srcValue = props.src
  if (typeof srcValue === 'string') return srcValue
  if (srcValue == null) return props.placeholderUrl || ''
  return String(srcValue)
})

const imageMode = computed<ImageMode>(() => {
  const mode = props.mode
  return (typeof mode === 'string' && mode) ? (mode as ImageMode) : 'aspectFill'
})
const isLoading = ref(false)

watch(
  imageSrc,
  (src, prev) => {
    if (src === prev) return
    isLoading.value = !!src
  },
  { immediate: true },
)

function handleError(e: WechatMiniprogram.CustomEvent) {
  isLoading.value = false
  emit('error', e.detail)
}

function handleLoad(e: WechatMiniprogram.CustomEvent) {
  isLoading.value = false
  emit('load', e.detail)
}
</script>

<template>
  <view style="position: relative; width: 100%; height: 100%; overflow: hidden;">
    <view
      v-if="isLoading"
      class="skeleton-pulse"
      style="position: absolute; top: 0; right: 0; bottom: 0; left: 0;"
    />
    <image
      :src="imageSrc"
      :mode="imageMode"
      :lazy-load="!!props.lazyLoad"
      :show-menu-by-longpress="!!props.showMenuByLongpress"
      :fade-in="!!props.fadeIn"
      style="position: absolute; top: 0; right: 0; bottom: 0; left: 0; width: 100%; height: 100%; display: block;"
      @error="handleError"
      @load="handleLoad"
    />
  </view>
</template>
