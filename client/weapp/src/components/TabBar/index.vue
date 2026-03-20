<script setup lang="ts">
import { storeToRefs } from 'wevu'
import { useTabStore } from '@/stores/tab'

defineComponentJson({
  styleIsolation: 'apply-shared',
})

const tabStore = useTabStore()
const { activeIndex } = storeToRefs(tabStore)

interface TabItem {
  key: string
  label: string
  icon: string
  pagePath: string
}

const tabs: TabItem[] = [
  { key: 'home', label: '首页', icon: 'home', pagePath: '/pages/index/index' },
  { key: 'inbox', label: '收件箱', icon: 'mail', pagePath: '/pages/inbox/index' },
  { key: 'library', label: '媒体库', icon: 'video-library', pagePath: '/pages/library/index' },
  { key: 'settings', label: '设置', icon: 'setting', pagePath: '/pages/settings/index' },
]

function onTap(index: number) {
  if (activeIndex.value === index) return
  tabStore.setActive(index)
  wx.switchTab({ url: tabs[index].pagePath })
}

function onTabTap(e: WechatMiniprogram.CustomEvent) {
  const index = Number((e.currentTarget as { dataset?: { index?: number | string } })?.dataset?.index)
  if (!Number.isInteger(index) || index < 0 || index >= tabs.length) return
  onTap(index)
}
</script>

<template>
  <view class="tab-bar-root">
    <view class="tab-bar-inner">
      <view
        v-for="(tab, index) in tabs"
        :key="tab.key"
        class="tab-item"
        :data-index="index"
        hover-class="active-scale"
        @tap="onTabTap"
      >
        <view class="tab-icon-wrapper" :class="{ 'active': activeIndex === index }">
          <t-icon
            :name="tab.icon"
            size="40rpx"
            :color="activeIndex === index ? 'var(--color-primary)' : 'var(--color-muted-foreground)'"
          />
        </view>
        <view
          class="tab-label"
          :class="activeIndex === index ? 'tab-label-active' : ''"
        >{{ tab.label }}</view>
      </view>
    </view>
    <view class="safe-area"></view>
  </view>
</template>

<style>
.tab-bar-root {
  background-color: var(--color-card, #ffffff);
  flex-shrink: 0;
  border-top: 1rpx solid var(--color-border);
}
.tab-bar-inner {
  display: flex;
  height: 96rpx;
}
.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
}
.tab-icon-wrapper {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  display: flex;
  align-items: center;
  justify-content: center;
}
.tab-icon-wrapper.active {
  transform: scale(1.15);
}
.tab-label {
  font-size: 20rpx;
  color: var(--color-muted-foreground, #737373);
  transition: color 0.2s;
}
.tab-label-active {
  color: var(--color-primary, #7C3AED);
  font-weight: 500;
}
.safe-area {
  height: env(safe-area-inset-bottom);
}
</style>
