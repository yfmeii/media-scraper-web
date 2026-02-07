<script setup lang="ts">
import type { MediaFile } from '@media-scraper/shared'
import { computed, nextTick, onShow, ref } from 'wevu'
import { autoMatch, fetchInbox, recognizePath, searchTMDBByImdb } from '@/utils/api'
import { useTabStore } from '@/stores/tab'
import { useToast } from '@/hooks/useToast'
import { useDialog } from '@/hooks/useDialog'
import { processMedia } from '@/hooks/useMediaProcess'
import EmptyState from '@/components/EmptyState/index.vue'
import TabBar from '@/components/TabBar/index.vue'
import InboxFileDetail from '@/components/InboxFileDetail/index.vue'

definePageJson({ disableScroll: true })

const tabStore = useTabStore()
const { showToast } = useToast()
const { confirm } = useDialog()
const refreshing = ref(false)

const files = ref<MediaFile[]>([])
const loading = ref(true)
const searchKeyword = ref('')
const selectedPaths = ref<string[]>([])
let searchTimer: ReturnType<typeof setTimeout> | null = null

function encodePathKey(path: string): string {
  // wevu/setData 的 diff 路径会按 "." 分层，文件后缀会导致 key 被拆开
  // 这里把 "." 也编码掉，确保 key 在模板里是稳定的扁平字段
  return encodeURIComponent(path).replaceAll('.', '%2E')
}

const filteredFiles = computed(() => {
  let list = files.value
  if (searchKeyword.value) {
    const kw = searchKeyword.value.toLowerCase()
    list = list.filter(f => f.name.toLowerCase().includes(kw))
  }
  return list
})

const selectedMap = computed(() => {
  const map: Record<string, boolean> = {}
  for (const path of selectedPaths.value) {
    map[encodePathKey(path)] = true
  }
  return map
})
const filteredSelectKeys = computed(() => filteredFiles.value.map(file => encodePathKey(file.path)))
const selectedCount = computed(() => selectedPaths.value.length)
const hasSelection = computed(() => selectedCount.value > 0)
const allFilteredSelected = computed(() =>
  filteredFiles.value.length > 0 && filteredFiles.value.every(file => !!selectedMap.value[encodePathKey(file.path)]),
)

function toggleSelect(path: string) {
  const idx = selectedPaths.value.indexOf(path)
  if (idx >= 0) {
    selectedPaths.value.splice(idx, 1)
  }
  else {
    selectedPaths.value.push(path)
  }
}

function onToggleSelect(e: WechatMiniprogram.CustomEvent) {
  const path = (e.currentTarget as { dataset?: { path?: string } })?.dataset?.path
  if (!path) return
  toggleSelect(path)
}

function selectAll() {
  if (allFilteredSelected.value) {
    selectedPaths.value = []
  }
  else {
    selectedPaths.value = filteredFiles.value.map(file => file.path)
  }
}

function clearSelection() {
  selectedPaths.value = []
}

async function loadInbox() {
  loading.value = true
  try {
    files.value = await fetchInbox()
    const filePathSet = new Set(files.value.map(f => f.path))
    selectedPaths.value = selectedPaths.value.filter(path => filePathSet.has(path))
  }
  catch {
    showToast('加载失败', 'error')
  }
  finally {
    loading.value = false
  }
}

// Initial data load (runs once during setup)
loadInbox()

onShow(() => {
  tabStore.setActive(1)
})

async function onRefresh() {
  refreshing.value = true
  await loadInbox()
  refreshing.value = false
}

function onSearch(e: WechatMiniprogram.CustomEvent) {
  const value = e.detail.value || ''
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  searchTimer = setTimeout(() => {
    searchKeyword.value = value
  }, 120)
}

// ── Detail Popup ──
const detailVisible = ref(false)
const detailFile = ref<MediaFile | null>(null)
const detailRef = ref<InstanceType<typeof InboxFileDetail> | null>(null)

function openDetail(file: MediaFile) {
  detailFile.value = file
  detailVisible.value = true
  nextTick(() => {
    detailRef.value?.initForFile(file)
  })
}

function closeDetail() {
  detailVisible.value = false
  detailFile.value = null
}

function onOpenDetail(e: WechatMiniprogram.CustomEvent) {
  const index = Number((e.currentTarget as { dataset?: { index?: number | string } })?.dataset?.index)
  if (!Number.isInteger(index) || index < 0 || index >= filteredFiles.value.length) return
  openDetail(filteredFiles.value[index])
}

async function onProcessed() {
  await loadInbox()
}

// ── Batch Operations ──
const batchProcessing = ref(false)
const batchProgress = ref('')
const fileStatus = ref<Record<string, 'processing' | 'success' | 'failed'>>({})

type BatchProcessor = (
  file: MediaFile,
  helpers: { index: number, total: number, setProgress: (prefix: string) => void },
) => Promise<boolean>

function getSelectedFiles(): MediaFile[] {
  const selectedSet = new Set(selectedPaths.value)
  return files.value.filter(file => selectedSet.has(file.path))
}

async function runBatchProcess(
  title: string,
  buildContent: (count: number) => string,
  processor: BatchProcessor,
) {
  const selected = getSelectedFiles()
  if (!selected.length) return

  const confirmed = await confirm({
    title,
    content: buildContent(selected.length),
    confirmBtn: '开始',
    cancelBtn: '取消',
  })
  if (!confirmed) return

  batchProcessing.value = true
  fileStatus.value = {}

  let successCount = 0
  let failCount = 0

  for (let i = 0; i < selected.length; i++) {
    const file = selected[i]
    fileStatus.value[file.path] = 'processing'

    const setProgress = (prefix: string) => {
      batchProgress.value = `${prefix} ${i + 1}/${selected.length}...`
    }

    try {
      const success = await processor(file, { index: i, total: selected.length, setProgress })
      fileStatus.value[file.path] = success ? 'success' : 'failed'
      if (success) successCount++
      else failCount++
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

async function batchAutoProcess() {
  await runBatchProcess(
    '一键匹配入库',
    count => `将对选中的 ${count} 个文件自动匹配 TMDB 并入库，是否继续？`,
    async (file, { setProgress }) => {
      setProgress('匹配中')
      const matchResult = await autoMatch(
        file.path,
        file.parsed.title,
        file.parsed.year,
      )
      if (!matchResult?.matched || !matchResult.result) return false

      setProgress('入库中')
      const match = matchResult.result
      const matchType = match.mediaType === 'tv' || match.mediaType === 'movie'
        ? match.mediaType
        : (file.parsed.season || file.parsed.episode ? 'tv' : 'movie')
      const result = await processMedia({
        file,
        candidate: {
          id: match.id,
          name: match.name,
          title: match.name,
          mediaType: match.mediaType,
        },
        type: matchType,
        season: file.parsed.season || 1,
        episode: file.parsed.episode || 1,
      })
      return result.success
    },
  )
}

async function batchAIProcess() {
  await runBatchProcess(
    '一键 AI 识别入库',
    count => `将对选中的 ${count} 个文件使用 AI 自动识别并入库，是否继续？`,
    async (file, { setProgress }) => {
      setProgress('AI 识别中')
      const aiResult = await recognizePath(file.path)
      const imdbMatched = aiResult?.imdb_id
        ? (await searchTMDBByImdb(aiResult.imdb_id))[0] || null
        : null
      const tmdbId = aiResult?.tmdb_id ?? imdbMatched?.id ?? null
      if (!tmdbId) return false

      setProgress('入库中')
      const result = await processMedia({
        file,
        candidate: {
          id: tmdbId,
          name: imdbMatched?.name || imdbMatched?.title || aiResult.tmdb_name || aiResult.title,
          title: imdbMatched?.name || imdbMatched?.title || aiResult.tmdb_name || aiResult.title,
          mediaType: imdbMatched?.mediaType,
        },
        type: (imdbMatched?.mediaType || aiResult.media_type) === 'tv' ? 'tv' : 'movie',
        season: aiResult.season || file.parsed.season || 1,
        episode: aiResult.episode || file.parsed.episode || 1,
      })
      return result.success
    },
  )
}

</script>

<template>
  <wxs module="fmt" src="../../utils/format.wxs" />
  <view style="height: 100vh; display: flex; flex-direction: column; overflow: hidden;">
    <t-navbar title="收件箱" :fixed="false" />

    <!-- Search -->
    <view class="bg-background px-4 pt-2 pb-2">
      <t-search :value="searchKeyword" placeholder="搜索文件名..." shape="round" @change="onSearch" />
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
        <view v-else-if="filteredFiles.length === 0" class="mt-3">
          <EmptyState title="暂无文件" :description="searchKeyword ? '没有匹配的文件' : '收件箱为空'" />
        </view>

        <!-- File List -->
        <block v-else>
          <view class="pl-1 text-xs font-medium text-muted-foreground mt-3 mb-1 flex items-center justify-between pr-1">
            <text>📥 待处理文件 ({{ filteredFiles.length }})</text>
            <text class="text-primary" @tap="selectAll">{{ allFilteredSelected ? '取消全选' : '全选' }}</text>
          </view>
          <view class="mt-2 rounded-xl bg-card">
            <view
              v-for="(file, idx) in filteredFiles"
              :key="file.path"
            >
              <view class="flex items-center">
                <!-- Checkbox -->
                <view class="pl-3 py-3 pr-2 shrink-0" :data-path="file.path" @tap="onToggleSelect">
                  <view
                    class="h-5 w-5 rounded-full border flex items-center justify-center"
                    :class="selectedMap[filteredSelectKeys[idx]] ? 'bg-primary border-primary' : 'bg-card border-border'"
                  >
                    <t-icon v-if="selectedMap[filteredSelectKeys[idx]]" name="check" size="20rpx" color="#fff" />
                  </view>
                </view>
                <!-- Content -->
                <view
                  class="flex-1 min-w-0 py-3 pr-3 flex items-center"
                  hover-class="opacity-70"
                  :data-index="idx"
                  @tap="onOpenDetail"
                >
                  <view class="flex-1 min-w-0">
                    <view class="text-sm font-medium text-foreground" style="overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
                      {{ fmt.truncateFilename(file.name, 32) }}
                    </view>
                    <view class="mt-1 flex items-center gap-1">
                      <text class="text-xs text-muted-foreground">{{ fmt.formatFileSize(file.size) }}</text>
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
        <text class="text-xs text-muted-foreground" @tap="clearSelection">清除选择</text>
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
  </view>
</template>
