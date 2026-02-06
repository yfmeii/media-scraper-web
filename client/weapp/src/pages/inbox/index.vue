<script setup lang="ts">
import type { MediaFile } from '@media-scraper/shared'
import { computed, onShow, ref } from 'wevu'
import { autoMatch, fetchInbox, processMovie, processTV, recognizePath } from '@/utils/api'
import { useTabStore } from '@/stores/tab'
import { useToast } from '@/hooks/useToast'
import { normalizeMediaKind } from '@/utils/format'
import EmptyState from '@/components/EmptyState/index.vue'
import TabBar from '@/components/TabBar/index.vue'
import InboxFileDetail from '@/components/InboxFileDetail/index.vue'

definePageJson({ disableScroll: true })

const tabStore = useTabStore()
const { showToast } = useToast()
const refreshing = ref(false)

const files = ref<MediaFile[]>([])
const loading = ref(true)
const searchKeyword = ref('')
const filterKind = ref<string>('all')
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
const hasSelection = computed(() => selectedCount.value > 0)

/** Map for template: path -> boolean */
const selectedMap = computed(() => {
  const map: Record<string, boolean> = {}
  for (const p of selectedPaths.value) {
    map[p] = true
  }
  return map
})

function toggleSelect(path: string) {
  const idx = selectedPaths.value.indexOf(path)
  if (idx >= 0) {
    selectedPaths.value.splice(idx, 1)
  }
  else {
    selectedPaths.value.push(path)
  }
}

function selectAll() {
  if (selectedPaths.value.length === filteredFiles.value.length) {
    selectedPaths.value = []
  }
  else {
    selectedPaths.value = filteredFiles.value.map(f => f.path)
  }
}

async function loadInbox() {
  loading.value = true
  try {
    files.value = await fetchInbox()
    selectedPaths.value = selectedPaths.value.filter(p => files.value.some(f => f.path === p))
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

// ── Detail Popup ──
const detailVisible = ref(false)
const detailFile = ref<MediaFile | null>(null)
const detailRef = ref<InstanceType<typeof InboxFileDetail> | null>(null)

function openDetail(file: MediaFile) {
  detailFile.value = file
  detailVisible.value = true
  // Wait next tick for component to mount, then init
  setTimeout(() => {
    detailRef.value?.initForFile(file)
  }, 50)
}

function closeDetail() {
  detailVisible.value = false
}

async function onProcessed() {
  await loadInbox()
}

// ── Batch Operations ──
const batchProcessing = ref(false)
const batchProgress = ref('')
const fileStatus = ref<Record<string, 'processing' | 'success' | 'failed'>>({})

async function batchAutoProcess() {
  const selected = files.value.filter(f => selectedPaths.value.includes(f.path))
  if (!selected.length) return

  const confirmed = await new Promise<boolean>((resolve) => {
    wx.showModal({
      title: '一键匹配入库',
      content: `将对选中的 ${selected.length} 个文件自动匹配 TMDB 并入库，是否继续？`,
      confirmText: '开始',
      success: (res) => resolve(res.confirm),
    })
  })
  if (!confirmed) return

  batchProcessing.value = true
  let successCount = 0
  let failCount = 0
  fileStatus.value = {}

  for (let i = 0; i < selected.length; i++) {
    const file = selected[i]
    batchProgress.value = `匹配中 ${i + 1}/${selected.length}...`
    fileStatus.value[file.path] = 'processing'

    try {
      const matchResult = await autoMatch(
        file.path,
        normalizeMediaKind(file.kind),
        file.parsed.title,
        file.parsed.year,
      )

      if (!matchResult || !matchResult.matched || !matchResult.result) {
        failCount++
        fileStatus.value[file.path] = 'failed'
        continue
      }

      const match = matchResult.result
      batchProgress.value = `入库中 ${i + 1}/${selected.length}...`

      if (file.kind === 'tv') {
        const result = await processTV({
          sourcePath: file.path,
          tmdbId: match.id,
          showName: match.name || file.parsed.title || file.name,
          season: file.parsed.season || 1,
          episodes: [{
            source: file.path,
            episode: file.parsed.episode || 1,
            episodeEnd: file.parsed.episodeEnd,
          }],
        })
        fileStatus.value[file.path] = result.success ? 'success' : 'failed'
        if (result.success) successCount++
        else failCount++
      }
      else {
        const result = await processMovie({
          sourcePath: file.path,
          tmdbId: match.id,
        })
        fileStatus.value[file.path] = result.success ? 'success' : 'failed'
        if (result.success) successCount++
        else failCount++
      }
    }
    catch {
      failCount++
      fileStatus.value[file.path] = 'failed'
    }
  }

  batchProcessing.value = false
  batchProgress.value = ''
  fileStatus.value = {}
  selectedPaths.value = []
  showToast(`完成：${successCount} 成功，${failCount} 失败`)
  await loadInbox()
}

async function batchAIProcess() {
  const selected = files.value.filter(f => selectedPaths.value.includes(f.path))
  if (!selected.length) return

  const confirmed = await new Promise<boolean>((resolve) => {
    wx.showModal({
      title: '一键 AI 识别入库',
      content: `将对选中的 ${selected.length} 个文件使用 AI 自动识别并入库，是否继续？`,
      confirmText: '开始',
      success: (res) => resolve(res.confirm),
    })
  })
  if (!confirmed) return

  batchProcessing.value = true
  let successCount = 0
  let failCount = 0
  fileStatus.value = {}

  for (let i = 0; i < selected.length; i++) {
    const file = selected[i]
    batchProgress.value = `AI 识别中 ${i + 1}/${selected.length}...`
    fileStatus.value[file.path] = 'processing'

    try {
      const kind = normalizeMediaKind(file.kind)
      const aiResult = await recognizePath(file.path, kind)

      if (!aiResult || !aiResult.tmdb_id) {
        failCount++
        fileStatus.value[file.path] = 'failed'
        continue
      }

      batchProgress.value = `入库中 ${i + 1}/${selected.length}...`

      if (aiResult.media_type === 'tv') {
        const result = await processTV({
          sourcePath: file.path,
          tmdbId: aiResult.tmdb_id,
          showName: aiResult.tmdb_name || aiResult.title || file.name,
          season: aiResult.season || 1,
          episodes: [{
            source: file.path,
            episode: aiResult.episode || 1,
          }],
        })
        fileStatus.value[file.path] = result.success ? 'success' : 'failed'
        if (result.success) successCount++
        else failCount++
      }
      else {
        const result = await processMovie({
          sourcePath: file.path,
          tmdbId: aiResult.tmdb_id,
        })
        fileStatus.value[file.path] = result.success ? 'success' : 'failed'
        if (result.success) successCount++
        else failCount++
      }
    }
    catch {
      failCount++
      fileStatus.value[file.path] = 'failed'
    }
  }

  batchProcessing.value = false
  batchProgress.value = ''
  fileStatus.value = {}
  selectedPaths.value = []
  showToast(`完成：${successCount} 成功，${failCount} 失败`)
  await loadInbox()
}

</script>

<template>
  <wxs module="fmt" src="../../utils/format.wxs" />
  <view style="height: 100vh; display: flex; flex-direction: column; overflow: hidden;">
    <t-navbar title="收件箱" :fixed="false" />

    <!-- Search & Filter -->
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

    <!-- File List -->
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
              <view class="p-3 flex items-center">
                <view class="mr-3 h-5 w-5 rounded bg-muted skeleton-pulse shrink-0" />
                <view class="flex-1 min-w-0">
                  <view class="h-3.5 w-4/5 rounded bg-muted skeleton-pulse" />
                  <view class="mt-2 h-2.5 w-3/5 rounded bg-muted skeleton-pulse" />
                </view>
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
          <view class="pl-1 text-xs font-medium text-muted-foreground mt-3 mb-1 flex items-center justify-between pr-1">
            <text>📥 待处理文件 ({{ filteredFiles.length }})</text>
            <text class="text-primary" @tap="selectAll">{{ selectedPaths.length === filteredFiles.length ? '取消全选' : '全选' }}</text>
          </view>
          <view class="mt-2 rounded-xl bg-card">
            <view
              v-for="(file, idx) in filteredFiles"
              :key="file.path"
            >
              <view class="flex items-center">
                <!-- Checkbox -->
                <view class="pl-3 py-3 pr-2 shrink-0" @tap="() => toggleSelect(file.path)">
                  <t-checkbox :checked="selectedMap[file.path]" style="--td-checkbox-icon-size: 36rpx;" />
                </view>
                <!-- Content -->
                <view
                  class="flex-1 min-w-0 py-3 pr-3 flex items-center"
                  hover-class="opacity-70"
                  @tap="() => openDetail(file)"
                >
                  <view class="flex-1 min-w-0">
                    <view class="text-sm font-medium text-foreground" style="overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
                      {{ fmt.truncateFilename(file.name, 32) }}
                    </view>
                    <view class="mt-1 flex items-center gap-1">
                      <text class="text-xs text-muted-foreground">{{ fmt.formatFileSize(file.size) }}</text>
                      <text class="text-xs px-1 rounded"
                        :class="file.kind === 'tv' ? 'bg-muted text-blue-600' : file.kind === 'movie' ? 'bg-muted text-purple-600' : 'bg-muted text-muted-foreground'"
                      >{{ fmt.getMediaKindLabel(file.kind) }}</text>
                    </view>
                  </view>
                  <!-- Status indicators -->
                  <view v-if="fileStatus[file.path] === 'processing'" class="ml-2 shrink-0">
                    <t-loading theme="circular" size="32rpx" />
                  </view>
                  <t-icon v-else-if="fileStatus[file.path] === 'success'" name="check-circle" size="32rpx" color="var(--color-primary)" class="ml-2 shrink-0" />
                  <t-icon v-else-if="fileStatus[file.path] === 'failed'" name="close-circle" size="32rpx" color="var(--color-destructive)" class="ml-2 shrink-0" />
                  <t-icon v-else name="chevron-right" size="32rpx" color="var(--color-muted-foreground)" class="ml-2 shrink-0" />
                </view>
              </view>
              <view v-if="idx < filteredFiles.length - 1" class="h-px bg-border mx-3"></view>
            </view>
          </view>
        </block>
      </view>
    </scroll-view>

    <!-- Bottom Batch Action Bar -->
    <view v-if="hasSelection" class="bg-card border-t border-border px-4 pt-3">
      <view class="flex items-center justify-between">
        <text class="text-sm font-medium text-foreground">已选 {{ selectedCount }} 项</text>
        <text class="text-xs text-muted-foreground" @tap="() => { selectedPaths = [] }">清除选择</text>
      </view>
      <view class="mt-2 flex gap-2">
        <view
          class="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-primary"
          :class="{ 'opacity-50': batchProcessing }"
          hover-class="opacity-80"
          @tap="batchAutoProcess"
        >
          <t-icon name="play-circle" size="32rpx" color="#fff" />
          <text class="text-sm font-medium text-primary-foreground">匹配入库</text>
        </view>
        <view
          class="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-accent"
          :class="{ 'opacity-50': batchProcessing }"
          hover-class="opacity-80"
          @tap="batchAIProcess"
        >
          <t-icon name="root-list" size="32rpx" color="var(--color-accent-foreground)" />
          <text class="text-sm font-medium text-accent-foreground">AI 识别入库</text>
        </view>
      </view>
      <view class="h-[calc(12rpx+env(safe-area-inset-bottom))]"></view>
    </view>

    <!-- File Detail Popup -->
    <InboxFileDetail
      ref="detailRef"
      :visible="detailVisible"
      :file="detailFile"
      @close="closeDetail"
      @processed="onProcessed"
    />

    <!-- Batch Processing Overlay -->
    <view v-if="batchProcessing" class="fixed inset-0 flex items-center justify-center" style="z-index: 9999; background: rgba(0,0,0,0.4);">
      <view class="rounded-2xl bg-card px-6 py-5 flex flex-col items-center gap-3 shadow-lg">
        <t-loading theme="circular" size="48rpx" />
        <text class="text-sm text-foreground">{{ batchProgress }}</text>
      </view>
    </view>

    <TabBar v-if="!hasSelection" />
    <t-toast id="t-toast" />
  </view>
</template>
