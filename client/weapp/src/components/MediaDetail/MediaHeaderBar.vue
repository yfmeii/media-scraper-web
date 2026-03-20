<script setup lang="ts">
defineProps<{
  name: string
  topBarOpacity: number
  titleOpacity: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()
</script>

<template>
  <view
    class="absolute top-0 left-0 right-0"
    style="z-index: 10; height: 88rpx; border-top-left-radius: 24rpx; border-top-right-radius: 24rpx;"
  >
    <view
      class="absolute inset-0 bg-background"
      style="border-top-left-radius: 24rpx; border-top-right-radius: 24rpx;"
      :style="{ opacity: topBarOpacity }"
    />

    <view class="relative flex items-center justify-between px-3" style="height: 88rpx;">
      <text
        class="text-sm font-semibold text-foreground truncate flex-1 pl-1"
        :style="{ opacity: titleOpacity }"
      >{{ name }}</text>
      <view
        class="flex items-center justify-center rounded-full bg-card shrink-0"
        style="min-width: 60rpx; min-height: 60rpx;"
        hover-class="opacity-60"
        @tap="emit('close')"
      >
        <t-icon name="close" size="32rpx" color="var(--color-foreground)" />
      </view>
    </view>
  </view>
</template>
