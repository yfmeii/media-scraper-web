<script setup lang="ts">
import type { PreviewAction, PreviewPlan } from '@media-scraper/shared'

defineProps<{
  visible: boolean
  loading: boolean
  actions: PreviewAction[]
  summary: PreviewPlan['impactSummary'] | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
  (e: 'visible-change', visible: boolean): void
}>()

function onVisibleChange(e: WechatMiniprogram.CustomEvent) {
  emit('visible-change', !!e?.detail?.visible)
}
</script>

<template>
  <wxs module="fmt" src="../../utils/format.wxs" />

  <t-popup :visible="visible" placement="bottom" :close-on-overlay-click="true" style="--td-popup-bg-color: var(--color-background);" @visible-change="onVisibleChange">
    <view style="height: 78vh; display: flex; flex-direction: column; border-top-left-radius: 24rpx; border-top-right-radius: 24rpx;">
      <view class="flex items-center justify-between px-4" style="height: 88rpx; border-bottom: 1rpx solid var(--color-border);">
        <text class="text-base font-semibold text-foreground">移动预览</text>
        <view class="flex items-center justify-center rounded-full bg-card" style="min-width: 60rpx; min-height: 60rpx;" hover-class="opacity-60" @tap="emit('close')">
          <t-icon name="close" size="32rpx" color="var(--color-foreground)" />
        </view>
      </view>

      <scroll-view scroll-y style="flex: 1; min-height: 0;">
        <view class="px-4 py-3 animate-fade-in-up">
          <view v-if="loading" class="py-8 flex items-center justify-center">
            <t-loading theme="circular" size="48rpx" />
            <text class="ml-2 text-sm text-muted-foreground">生成预览中...</text>
          </view>

          <view v-else-if="actions.length === 0" class="py-8 text-center">
            <text class="text-sm text-muted-foreground">暂无可执行动作</text>
          </view>

          <block v-else>
            <view v-if="summary" class="rounded-xl bg-card p-3">
              <view class="text-xs text-muted-foreground">移动文件: <text class="text-foreground font-medium">{{ summary.filesMoving }}</text></view>
              <view class="mt-1 text-xs text-muted-foreground">创建 NFO: <text class="text-foreground font-medium">{{ summary.nfoCreating }}</text></view>
              <view class="mt-1 text-xs text-muted-foreground">下载海报: <text class="text-foreground font-medium">{{ summary.postersDownloading }}</text></view>
              <view v-if="summary.nfoOverwriting > 0" class="mt-1 text-xs text-warning">将覆盖 NFO: {{ summary.nfoOverwriting }}</view>
            </view>

            <view class="mt-3 flex flex-col gap-2">
              <view v-for="(action, idx) in actions" :key="`${idx}-${action.destination}`" class="rounded-xl border border-border bg-card p-3">
                <view class="flex items-center justify-between">
                  <text class="text-xs font-medium" :class="fmt.getPreviewActionClass(action.type)">{{ fmt.getPreviewActionLabel(action.type) }}</text>
                  <text v-if="action.willOverwrite" class="px-1.5 py-0.5 rounded text-warning" style="font-size: 20rpx; background: rgba(245, 158, 11, 0.1);">覆盖</text>
                </view>
                <view v-if="action.source" class="mt-1 text-xs text-muted-foreground" style="word-break: break-all; font-family: Menlo, Monaco, Consolas, monospace;">{{ action.source }}</view>
                <view v-if="action.source" class="my-1 text-xs text-muted-foreground">↓</view>
                <view class="text-xs text-foreground" style="word-break: break-all; font-family: Menlo, Monaco, Consolas, monospace;">{{ action.destination }}</view>
              </view>
            </view>
          </block>
        </view>
      </scroll-view>

      <view class="px-4 pt-2 border-t border-border bg-background">
        <view class="flex gap-2">
          <view class="flex-1 flex items-center justify-center py-3 rounded-xl bg-muted" hover-class="opacity-80 active-scale" @tap="emit('close')">
            <text class="text-sm font-medium text-muted-foreground">关闭</text>
          </view>
          <view class="flex-1 flex items-center justify-center py-3 rounded-xl bg-primary" :class="{ 'opacity-50': loading || actions.length === 0 }" hover-class="opacity-80 active-scale" @tap="emit('confirm')">
            <text class="text-sm font-medium text-primary-foreground">确认执行</text>
          </view>
        </view>
        <view style="height: calc(12rpx + env(safe-area-inset-bottom));"></view>
      </view>
    </view>
  </t-popup>
</template>
