<script setup lang="ts">
import { computed } from 'wevu'
import MsImage from '@/components/MsImage/index.vue'

defineComponentJson({ styleIsolation: 'apply-shared' })

const props = defineProps({
  /** 封面图 URL（允许任意类型，内部统一兜底为字符串） */
  src: {
    type: null,
    default: '',
  },
  /** 宽度，默认 100% */
  width: String,
  /** 高度，默认 300rpx */
  height: String,
  /** 圆角 class，默认 rounded-xl */
  rounded: String,
  /** 右上角徽章文字 */
  badge: String,
  /** 是否懒加载，默认 true */
  lazyLoad: {
    type: Boolean,
    default: true,
  },
})

const safeSrc = computed(() => {
  const value = props.src
  if (typeof value === 'string') return value
  if (value == null) return ''
  return String(value)
})
</script>

<template>
  <view class="relative overflow-hidden" :class="props.rounded || 'rounded-xl'">
    <MsImage
      :src="safeSrc"
      mode="aspectFill"
      :width="props.width || '100%'"
      :height="props.height || '300rpx'"
      class="bg-muted"
      :lazy-load="props.lazyLoad !== false"
    />
    <view
      v-if="props.badge"
      class="absolute right-1 top-1 rounded-lg bg-warning px-1 py-0.5 text-xs text-white"
    >{{ props.badge }}</view>
  </view>
</template>
