<script setup lang="ts">
import MsImage from '@/components/MsImage/index.vue'

defineComponentJson({ styleIsolation: 'apply-shared' })

defineProps<{
  /** 封面图 URL */
  src?: string
  /** 宽度，默认 100% */
  width?: string
  /** 高度，默认 300rpx */
  height?: string
  /** 圆角 class，默认 rounded-xl */
  rounded?: string
  /** 右上角徽章文字 */
  badge?: string
  /** 是否懒加载，默认 true */
  lazyLoad?: boolean
}>()
</script>

<template>
  <view class="relative overflow-hidden" :class="rounded || 'rounded-xl'">
    <MsImage
      :src="src"
      mode="aspectFill"
      :width="width || '100%'"
      :height="height || '300rpx'"
      class="bg-muted"
      :lazy-load="lazyLoad !== false"
    />
    <view
      v-if="badge"
      class="absolute right-1 top-1 rounded-lg bg-warning px-1 py-0.5 text-xs text-white"
    >{{ badge }}</view>
  </view>
</template>
