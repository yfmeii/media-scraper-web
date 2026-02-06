<script setup lang="ts">
import type { MediaFile } from '@media-scraper/shared'
import { computed, onShow, ref } from 'wevu'
import { fetchInbox } from '@/utils/api'
import { useTabStore } from '@/stores/tab'
import { useToast } from '@/hooks/useToast'
import EmptyState from '@/components/EmptyState/index.vue'
import TabBar from '@/components/TabBar/index.vue'

definePageJson({ disableScroll: true })

const tabStore = useTabStore()
const { showToast } = useToast()
const refreshing = ref(false)

const files = ref<MediaFile[]>([])
const loading = ref(true)
const searchKeyword = ref('')
const filterKind = ref<string>('all')
const selectMode = ref(false)
const selectedPaths = ref<string[]>([])

const filteredFiles = computed(() => {
  let list = files.value
  if (searchKeyword.value) {
    const kw = searchKeyword.value.toLowerCase()
    list = list.filter(f => f.name.toLowerCase().includes(kw))
  }
  if (filterKind.value !== 'all') {
    list = list.filter(f => f.kind === filterKind.value)
  }
  return list
})

const selectedCount = computed(() => selectedPaths.value.length)

function isSelected(path: string): boolean {
  return selectedPaths.value.indexOf(path) >= 0
}

async function loadInbox() {
  loading.value = true
  try {
    files.value = await fetchInbox()
  }
  catch {
    showToast('加载失败', 'error')
  }
  finally {
    loading.value = false
  }
}

onShow(() => {
  loadInbox()
  tabStore.setActive(1)
})

async function onRefresh() {
  refreshing.value = true
  await loadInbox()
  refreshing.value = false
}

function onSearch(e: WechatMiniprogram.CustomEvent) {
  searchKeyword.value = e.detail.value || ''
}

function onFileClick(file: MediaFile) {
  if (selectMode.value) {
    toggleSelect(file.path)
    return
  }
  wx.navigateTo({
    url: `/pages/match/index?path=${encodeURIComponent(file.path)}&kind=${file.kind}&name=${encodeURIComponent(file.name)}`,
  })
}

function onFileLongPress(file: MediaFile) {
  selectMode.value = true
  selectedPaths.value = [file.path]
  wx.vibrateShort({ type: 'medium' })
}

function toggleSelect(path: string) {
  const idx = selectedPaths.value.indexOf(path)
  if (idx >= 0) {
    selectedPaths.value.splice(idx, 1)
  }
  else {
    selectedPaths.value.push(path)
  }
}

function exitSelectMode() {
  selectMode.value = false
  selectedPaths.value = []
}

</script>

<template>
  <wxs module="fmt" src="../../utils/format.wxs" />
  <view style="height: 100vh; display: flex; flex-direction: column; overflow: hidden;">
    <t-navbar title="收件箱" :fixed="false" />

    <!-- Search & Filter (always visible header) -->
    <view class="bg-background px-4 pt-2 pb-2">
      <t-search :value="searchKeyword" placeholder="搜索文件名..." shape="round" @change="onSearch" />
      <view class="mt-2 flex gap-2">
        <view
          class="px-2.5 py-1 text-xs rounded-lg"
          :class="filterKind === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
          @tap="() => { filterKind = 'all' }"
        >全部</view>
        <view
          class="px-2.5 py-1 text-xs rounded-lg"
          :class="filterKind === 'movie' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
          @tap="() => { filterKind = 'movie' }"
        >电影</view>
        <view
          class="px-2.5 py-1 text-xs rounded-lg"
          :class="filterKind === 'tv' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
          @tap="() => { filterKind = 'tv' }"
        >剧集</view>
        <view
          class="px-2.5 py-1 text-xs rounded-lg"
          :class="filterKind === 'unknown' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
          @tap="() => { filterKind = 'unknown' }"
        >未知</view>
      </view>
    </view>

    <!-- File List (scrollable content) -->
    <scroll-view
      scroll-y
      style="flex: 1; min-height: 0;"
      :refresher-enabled="true"
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
    >
      <view class="px-4 pb-4">
        <!-- Loading Skeleton -->
        <view v-if="loading">
          <view class="pl-1 text-xs font-medium text-muted-foreground mt-3 mb-1">📥 待处理文件</view>
          <view class="mt-2 rounded-xl bg-card">
            <view v-for="i in 5" :key="i">
              <view class="p-3 flex items-start">
                <view class="flex-1 min-w-0">
                  <view class="h-3.5 w-4/5 rounded bg-muted skeleton-pulse" />
                  <view class="mt-2 h-2.5 w-3/5 rounded bg-muted skeleton-pulse" />
                  <view class="mt-1.5 h-2.5 w-2/5 rounded bg-muted skeleton-pulse" />
                </view>
                <view class="ml-2 mt-0.5 h-4 w-4 rounded bg-muted skeleton-pulse shrink-0" />
              </view>
              <view v-if="i < 5" class="h-px bg-border mx-3" />
            </view>
          </view>
        </view>

        <!-- Empty -->
        <view v-else-if="filteredFiles.length === 0" class="pt-8">
          <EmptyState title="暂无文件" :description="searchKeyword ? '没有匹配的文件' : '收件箱为空'" />
        </view>

        <!-- File List -->
        <block v-else>
          <view class="pl-1 text-xs font-medium text-muted-foreground mt-3 mb-1">
            📥 待处理文件 ({{ filteredFiles.length }})
          </view>
          <view class="mt-2 rounded-xl bg-card">
            <view
              v-for="(file, idx) in filteredFiles"
              :key="file.path"
              hover-class="opacity-70"
              @tap="() => onFileClick(file)"
              @longpress="() => onFileLongPress(file)"
            >
              <view
                class="p-3 flex items-start"
                :class="{ 'bg-accent rounded-xl': isSelected(file.path) }"
              >
                <view v-if="selectMode" class="mr-2 mt-0.5">
                  <t-checkbox :checked="isSelected(file.path)" />
                </view>
                <view class="flex-1 min-w-0">
                  <view class="text-sm font-medium text-foreground" style="overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
                    {{ fmt.truncateFilename(file.name, 36) }}
                  </view>
                  <view class="mt-1 text-xs text-muted-foreground">
                    {{ fmt.formatFileSize(file.size) }} · {{ fmt.getMediaKindLabel(file.kind) }} · {{ fmt.getStatusLabel(file) }}
                  </view>
                  <view v-if="file.parsed.title" class="mt-0.5 text-xs text-muted-foreground">
                    解析: {{ file.parsed.title }}{{ file.parsed.year ? ` (${file.parsed.year})` : '' }}
                  </view>
                </view>
                <t-icon v-if="!selectMode" name="chevron-right" size="32rpx" color="var(--color-muted-foreground)" class="ml-2 mt-0.5 shrink-0" />
              </view>
              <view v-if="idx < filteredFiles.length - 1" class="h-px bg-border mx-3"></view>
            </view>
          </view>
        </block>
      </view>
    </scroll-view>

    <!-- Bottom Action Bar (Multi-Select, part of flex) -->
    <view v-if="selectMode" class="bg-card px-4 pt-3">
      <view class="flex items-center justify-between">
        <view class="text-sm text-foreground">已选 {{ selectedCount }} 项</view>
        <view class="px-3 py-1.5 rounded-lg bg-muted text-sm text-foreground" @tap="exitSelectMode">取消</view>
      </view>
      <view class="h-[calc(12rpx+env(safe-area-inset-bottom))]"></view>
    </view>

    <TabBar v-if="!selectMode" />
    <t-toast id="t-toast" />
  </view>
</template>
