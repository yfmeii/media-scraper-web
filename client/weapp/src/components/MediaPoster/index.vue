<script setup lang="ts">
import { computed } from 'wevu'
import MsImage from '@/components/MsImage/index.vue'

defineComponentJson({ styleIsolation: 'apply-shared' })

type MediaPosterProps = {
  src?: string | number | null
  width?: string
  height?: string
  mode?: string
  rounded?: string
  badge?: string
  lazyLoad?: boolean
}

const props = withDefaults(defineProps<MediaPosterProps>(), {
  src: '',
  width: '100%',
  height: '300rpx',
  mode: 'aspectFill',
  rounded: 'rounded-md',
  lazyLoad: true,
})

const safeSrc = computed(() => {
  const value = props.src
  if (typeof value === 'string') return value
  if (value == null) return ''
  return String(value)
})

const wrapperStyle = computed(() =>
  `width:${props.width || '100%'};height:${props.height || '300rpx'};`,
)
</script>

<template>
  <view class="relative overflow-hidden" :class="props.rounded || 'rounded-md'" :style="wrapperStyle">
    <MsImage
      :src="safeSrc || ''"
      :mode="props.mode || 'aspectFill'"
      width="100%"
      height="100%"
      style="width: 100%; height: 100%; display: block;"
      class="bg-muted"
      :lazy-load="props.lazyLoad !== false"
      :show-menu-by-longpress="false"
      :fade-in="false"
    />
    <view
      v-if="props.badge"
      class="absolute right-1 top-1 rounded bg-warning px-1 py-0.5 text-xs text-white"
    >{{ props.badge }}</view>
  </view>
</template>
