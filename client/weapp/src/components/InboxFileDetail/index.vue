<script setup lang="ts">
import type { MediaFile, PathRecognizeResult, PreviewAction, PreviewItem, PreviewPlan, SearchResult } from '@media-scraper/shared'
import { computed, ref, watch } from 'wevu'
import { previewPlan, recognizePath, searchTMDB, searchTMDBByImdb } from '@/utils/api'
import { getPosterUrl } from '@/utils/request'
import { useToast } from '@/hooks/useToast'
import { useMediaMatch } from '@/hooks/useMediaMatch'
import { processMedia } from '@/hooks/useMediaProcess'
import MediaPoster from '@/components/MediaPoster/index.vue'

defineComponentJson({ styleIsolation: 'apply-shared' })

const props = defineProps<{
  visible: boolean
  file: MediaFile | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'processed'): void
}>()

const { showToast } = useToast()
const {
  matchLoading,
  searching,
  candidates,
  selectedCandidate,
  doAutoMatch,
  doSearch,
  selectCandidate,
  cancelPending,
  reset: resetMatch,
} = useMediaMatch()

const localVisible = ref(false)
const processing = ref(false)
const aiLoading = ref(false)
const previewVisible = ref(false)
const previewLoading = ref(false)
const previewActions = ref<PreviewAction[]>([])
const previewSummary = ref<PreviewPlan['impactSummary'] | null>(null)
const searchQuery = ref('')
const season = ref(1)
const episode = ref(1)
const aiResult = ref<PathRecognizeResult | null>(null)
const aiHint = ref('')
const autoMatchTried = ref(false)
const targetPreviewPath = ref('')
const targetPreviewLoading = ref(false)
let targetPreviewSeq = 0

interface CandidateCard {
  id: number
  displayName: string
  displayYear: string
  posterUrl: string
  mediaType: 'tv' | 'movie'
}

function inferCandidateMediaType(candidate: { mediaType?: 'tv' | 'movie', firstAirDate?: string, releaseDate?: string }): 'tv' | 'movie' {
  if (candidate.mediaType === 'tv' || candidate.mediaType === 'movie') return candidate.mediaType
  if (candidate.firstAirDate && !candidate.releaseDate) return 'tv'
  if (candidate.releaseDate && !candidate.firstAirDate) return 'movie'
  return 'movie'
}

function mergeCandidates(...groups: SearchResult[][]): SearchResult[] {
  const merged: SearchResult[] = []
  const seen = new Set<number>()
  for (const group of groups) {
    for (const item of group) {
      if (!item || seen.has(item.id)) continue
      seen.add(item.id)
      merged.push(item)
    }
  }
  return merged
}

function moveCandidateToFront(list: SearchResult[], preferredId: number | null | undefined): SearchResult[] {
  if (!preferredId) return list
  const idx = list.findIndex(item => item.id === preferredId)
  if (idx <= 0) return list
  const copy = list.slice()
  const [hit] = copy.splice(idx, 1)
  copy.unshift(hit)
  return copy
}

function toPositiveInt(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return null
  return Math.floor(parsed)
}

function syncTvEpisodeByCandidate(
  candidate: { mediaType?: 'tv' | 'movie', firstAirDate?: string, releaseDate?: string } | null,
  preferAI = false,
) {
  if (!candidate) return
  if (inferCandidateMediaType(candidate) !== 'tv') return

  const aiSeason = toPositiveInt(aiResult.value?.season)
  const aiEpisode = toPositiveInt(aiResult.value?.episode)
  const parsedSeason = toPositiveInt(props.file?.parsed.season)
  const parsedEpisode = toPositiveInt(props.file?.parsed.episode)

  const nextSeason = preferAI
    ? (aiSeason || parsedSeason || season.value || 1)
    : (parsedSeason || aiSeason || season.value || 1)
  const nextEpisode = preferAI
    ? (aiEpisode || parsedEpisode || episode.value || 1)
    : (parsedEpisode || aiEpisode || episode.value || 1)

  season.value = nextSeason
  episode.value = nextEpisode
}

function buildAiFallbackCandidate(result: PathRecognizeResult): SearchResult | null {
  if (!result.tmdb_id) return null
  const name = result.tmdb_name || result.title || ''
  const mediaType: 'tv' | 'movie' = result.media_type === 'tv' ? 'tv' : 'movie'
  const year = result.year && result.year > 0 ? `${result.year}-01-01` : undefined
  return {
    id: result.tmdb_id,
    mediaType,
    name,
    title: name,
    releaseDate: mediaType === 'movie' ? year : undefined,
    firstAirDate: mediaType === 'tv' ? year : undefined,
  }
}

const candidateCards = computed<CandidateCard[]>(() =>
  candidates.value.map(candidate => ({
    id: candidate.id,
    displayName: candidate.name || candidate.title || '未知',
    displayYear: (candidate.releaseDate || candidate.firstAirDate || '').slice(0, 4),
    posterUrl: getPosterUrl(candidate.posterPath),
    mediaType: inferCandidateMediaType(candidate),
  })),
)

const selectedMediaType = computed<'tv' | 'movie'>(() => {
  const mediaType = selectedCandidate.value?.mediaType
  if (mediaType === 'tv' || mediaType === 'movie') return mediaType
  const aiType = aiResult.value?.media_type
  if (aiType === 'tv' || aiType === 'movie') return aiType
  if (props.file?.parsed.season || props.file?.parsed.episode) return 'tv'
  return 'movie'
})

function extractTargetPreviewPath(plan: PreviewPlan, sourcePath: string): string {
  const directMove = plan.actions.find(action => action.type === 'move' && action.source === sourcePath)
  if (directMove?.destination) return directMove.destination

  const firstMove = plan.actions.find(action => action.type === 'move')
  if (firstMove?.destination) return firstMove.destination

  const firstDir = plan.actions.find(action => action.type === 'create-dir')
  return firstDir?.destination || ''
}

async function refreshTargetPreviewPath() {
  const item = buildPreviewItem()
  if (!item || !localVisible.value) {
    targetPreviewPath.value = ''
    targetPreviewLoading.value = false
    return
  }

  const currentSeq = ++targetPreviewSeq
  targetPreviewLoading.value = true
  try {
    const plan = await previewPlan([item])
    if (currentSeq !== targetPreviewSeq) return
    targetPreviewPath.value = extractTargetPreviewPath(plan, item.sourcePath)
  }
  catch {
    if (currentSeq !== targetPreviewSeq) return
    targetPreviewPath.value = ''
  }
  finally {
    if (currentSeq === targetPreviewSeq) {
      targetPreviewLoading.value = false
    }
  }
}

function resetPopupState() {
  processing.value = false
  aiLoading.value = false
  previewVisible.value = false
  previewLoading.value = false
  previewActions.value = []
  previewSummary.value = null
  searchQuery.value = ''
  season.value = 1
  episode.value = 1
  aiResult.value = null
  aiHint.value = ''
  autoMatchTried.value = false
  targetPreviewPath.value = ''
  targetPreviewLoading.value = false
  targetPreviewSeq++
  resetMatch()
}

watch(() => props.visible, (val) => {
  localVisible.value = val
  if (!val) {
    resetPopupState()
  }
}, { immediate: true })

watch(
  () => `${localVisible.value ? 1 : 0}|${props.file?.path || ''}|${selectedCandidate.value?.id || ''}|${selectedMediaType.value}|${season.value}|${episode.value}`,
  () => {
    if (!localVisible.value) return
    void refreshTargetPreviewPath()
  },
)

function getDefaultQuery(file: MediaFile): string {
  return file.parsed.title || file.name.replace(/\.[^.]+$/, '')
}

function sanitizeStepperValue(value: unknown, fallback: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.min(Math.floor(parsed), max)
}

async function initForFile(file: MediaFile) {
  resetPopupState()
  searchQuery.value = getDefaultQuery(file)
  season.value = file.parsed.season || 1
  episode.value = file.parsed.episode || 1
  await handleAutoMatch(true)
}

defineExpose({ initForFile })

function onVisibleChange(e: WechatMiniprogram.CustomEvent) {
  if (!e?.detail?.visible) {
    localVisible.value = false
    resetPopupState()
    emit('close')
  }
}

function onPreviewVisibleChange(e: WechatMiniprogram.CustomEvent) {
  previewVisible.value = !!e?.detail?.visible
}

function onSearchInput(e: WechatMiniprogram.CustomEvent) {
  searchQuery.value = e.detail.value
}

function onSeasonChange(e: WechatMiniprogram.CustomEvent) {
  season.value = sanitizeStepperValue(e.detail.value, season.value, 99)
}

function onEpisodeChange(e: WechatMiniprogram.CustomEvent) {
  episode.value = sanitizeStepperValue(e.detail.value, episode.value, 999)
}

function closePopup() {
  localVisible.value = false
  resetPopupState()
  emit('close')
}

function onSelectCandidate(e: WechatMiniprogram.CustomEvent) {
  const id = Number((e.currentTarget as { dataset?: { id?: number | string } })?.dataset?.id)
  if (!Number.isInteger(id)) return
  const candidate = candidates.value.find(c => c.id === id)
  if (!candidate) return
  selectCandidate(candidate)
  syncTvEpisodeByCandidate(candidate, true)
}

function buildPreviewItem(): PreviewItem | null {
  if (!props.file || !selectedCandidate.value) return null
  const file = props.file
  const candidate = selectedCandidate.value
  const item: PreviewItem = {
    sourcePath: file.path,
    kind: selectedMediaType.value,
    tmdbId: candidate.id,
    showName: candidate.name || candidate.title || '未知',
  }
  if (selectedMediaType.value === 'tv') {
    item.season = season.value
    item.episodes = [{
      source: file.path,
      episode: episode.value,
      episodeEnd: file.parsed.episodeEnd,
    }]
  }
  return item
}

// ── Actions ──
async function handleAutoMatch(silent = false) {
  if (!props.file) return
  const ok = await doAutoMatch(
    props.file,
    searchQuery.value.trim() || undefined,
    props.file.parsed.year,
  )
  if (ok) {
    const currentId = selectedCandidate.value?.id
    const resolved = (currentId
      ? candidates.value.find(item => item.id === currentId)
      : null) || candidates.value[0] || null
    selectedCandidate.value = resolved
    syncTvEpisodeByCandidate(resolved, false)
  }
  autoMatchTried.value = true
  if (!ok && !silent) {
    showToast('未找到匹配结果', 'warning')
  }
}

async function handleManualSearch() {
  const query = searchQuery.value.trim()
  if (!query) {
    showToast('请输入搜索关键词', 'warning')
    return
  }
  const ok = await doSearch(query)
  if (!ok) {
    showToast('搜索失败', 'error')
    return
  }
  const first = candidates.value[0] || null
  selectedCandidate.value = first
  syncTvEpisodeByCandidate(first, true)
  autoMatchTried.value = true
  if (!candidates.value.length) {
    showToast('未找到匹配结果', 'warning')
  }
}

async function handleAIRecognize() {
  if (!props.file) return
  cancelPending()
  aiLoading.value = true
  aiResult.value = null
  aiHint.value = ''
  try {
    const recognizeInput = props.file.relativePath || props.file.path
    const result = await recognizePath(recognizeInput)
    if (!result || (!result.tmdb_id && !result.imdb_id)) {
      showToast('AI 识别失败', 'warning')
      return
    }

    aiResult.value = result
    searchQuery.value = result.tmdb_name || result.title || searchQuery.value

    const aiType = result.media_type === 'tv' ? 'tv' : 'movie'
    aiHint.value = `AI 识别为${aiType === 'movie' ? '电影' : '剧集'}，请选择匹配结果确认`

    if (result.season !== null && result.season > 0) {
      season.value = result.season
    }
    if (result.episode !== null && result.episode > 0) {
      episode.value = result.episode
    }

    if (result.confidence < 0.7) {
      aiHint.value = `AI 置信度 ${Math.round(result.confidence * 100)}%，建议手动确认`
    }

    const backendCandidates = result.candidates || []
    const backendPreferredId = result.preferred_tmdb_id || result.tmdb_id || null

    let imdbResults: SearchResult[] = []
    let nameResults: SearchResult[] = []
    if (!backendCandidates.length) {
      imdbResults = result.imdb_id
        ? await searchTMDBByImdb(result.imdb_id)
        : []
      nameResults = (result.tmdb_name || result.title)
        ? await searchTMDB(result.tmdb_name || result.title)
        : []
    }

    const preferredId = backendPreferredId || imdbResults[0]?.id || null
    const baseMerged = mergeCandidates(backendCandidates, imdbResults, nameResults)
    const fallbackCandidate = buildAiFallbackCandidate(result)
    const merged = preferredId && fallbackCandidate && !baseMerged.some(item => item.id === preferredId)
      ? [fallbackCandidate, ...baseMerged]
      : baseMerged
    const ordered = moveCandidateToFront(merged, preferredId)
    candidates.value = ordered
    const resolved = (preferredId
      ? ordered.find(item => item.id === preferredId)
      : null) || ordered[0] || null
    selectedCandidate.value = resolved
    syncTvEpisodeByCandidate(resolved, true)
    autoMatchTried.value = true

    if (!ordered.length) {
      showToast('未找到匹配结果', 'warning')
    }
  }
  catch {
    showToast('AI 识别失败', 'error')
  }
  finally {
    aiLoading.value = false
  }
}

async function handlePreviewPlan() {
  const item = buildPreviewItem()
  if (!item) {
    showToast('请先选择匹配结果', 'warning')
    return
  }
  previewVisible.value = true
  previewLoading.value = true
  previewActions.value = []
  previewSummary.value = null
  try {
    const plan = await previewPlan([item])
    previewActions.value = plan.actions || []
    previewSummary.value = plan.impactSummary || null
  }
  catch {
    showToast('预览失败', 'error')
  }
  finally {
    previewLoading.value = false
  }
}

async function handleProcess() {
  if (!props.file || !selectedCandidate.value || processing.value) return
  processing.value = true
  try {
    const result = await processMedia({
      file: props.file,
      candidate: selectedCandidate.value,
      type: selectedMediaType.value,
      season: season.value,
      episode: episode.value,
    })
    if (result.success) {
      showToast('入库成功', 'success')
      wx.vibrateShort({ type: 'medium' })
      emit('close')
      emit('processed')
    }
    else {
      showToast(result.message || '入库失败', 'error')
    }
  }
  catch {
    showToast('入库失败', 'error')
  }
  finally {
    processing.value = false
  }
}

async function executeFromPreview() {
  if (previewLoading.value || !previewActions.value.length) return
  previewVisible.value = false
  await handleProcess()
}

function closePreview() {
  previewVisible.value = false
}
</script>

<template>
  <wxs module="fmt" src="../../utils/format.wxs" />

  <t-popup
    :visible="localVisible"
    placement="bottom"
    :close-on-overlay-click="true"
    style="--td-popup-bg-color: var(--color-background);"
    @visible-change="onVisibleChange"
  >
    <view
      v-if="file"
      class="relative bg-background"
      style="border-top-left-radius: 24rpx; border-top-right-radius: 24rpx;"
    >
      <!-- Floating top bar -->
      <view
        class="absolute top-0 left-0 right-0"
        style="z-index: 10; height: 88rpx; border-top-left-radius: 24rpx; border-top-right-radius: 24rpx;"
      >
        <view
          class="absolute inset-0 bg-background"
          style="border-top-left-radius: 24rpx; border-top-right-radius: 24rpx;"
        />
        <view class="relative flex items-center justify-between px-3" style="height: 88rpx;">
          <text class="text-sm font-semibold text-foreground truncate flex-1 pl-1">文件入库详情</text>
          <view
            class="flex items-center justify-center rounded-full bg-card shrink-0"
            style="min-width: 60rpx; min-height: 60rpx;"
            hover-class="opacity-60"
            @tap="closePopup"
          >
            <t-icon name="close" size="32rpx" color="var(--color-foreground)" />
          </view>
        </view>
      </view>

      <scroll-view
        scroll-y
        style="max-height: calc(85vh - 120rpx - env(safe-area-inset-bottom));"
      >
        <view style="height: 88rpx;" />
        <view class="px-4 pt-3 pb-4">
          <!-- File Info -->
          <view class="rounded-xl bg-card p-3">
            <text class="text-sm font-medium text-foreground" style="word-break: break-all;">{{ file.name }}</text>
            <view class="mt-2 flex items-center gap-1.5 flex-wrap">
              <text class="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{{ fmt.formatFileSize(file.size) }}</text>
              <text v-if="file.parsed.resolution" class="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{{ file.parsed.resolution }}</text>
              <text v-if="file.parsed.codec" class="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{{ file.parsed.codec }}</text>
            </view>
            <view v-if="file.parsed.title" class="mt-2 text-xs text-muted-foreground">
              解析标题: {{ file.parsed.title }}<text v-if="file.parsed.year"> ({{ file.parsed.year }})</text>
              <text v-if="file.parsed.season"> · S{{ fmt.padStart(file.parsed.season, 2, '0') }}</text>
              <text v-if="file.parsed.episode">E{{ fmt.padStart(file.parsed.episode, 2, '0') }}</text>
            </view>
          </view>

          <!-- Target Preview -->
          <view class="mt-3 rounded-xl bg-card p-3">
            <view class="flex items-center justify-between">
              <text class="text-xs font-medium text-muted-foreground">入库预览</text>
              <text
                class="text-xs"
                :class="selectedCandidate ? 'text-green-600' : 'text-muted-foreground'"
              >{{ selectedCandidate ? '已匹配' : '未匹配' }}</text>
            </view>
          <view class="mt-2 rounded-lg bg-muted p-2">
            <text
                v-if="targetPreviewPath"
                class="text-xs text-foreground"
                style="word-break: break-all; font-family: Menlo, Monaco, Consolas, monospace;"
              >{{ targetPreviewPath }}</text>
              <text v-else-if="targetPreviewLoading" class="text-xs text-muted-foreground">计算中...</text>
              <text v-else class="text-xs text-muted-foreground">请选择匹配结果</text>
          </view>
        </view>

          <!-- AI Result -->
          <view v-if="aiResult" class="mt-3 rounded-xl bg-muted p-3 flex items-center gap-2">
            <t-icon name="check-circle" size="36rpx" color="var(--color-primary)" />
            <view class="flex-1 min-w-0">
              <text class="text-sm font-medium text-foreground">AI 识别: {{ aiResult.tmdb_name || aiResult.title }}</text>
              <text class="text-xs text-muted-foreground ml-2">置信度 {{ fmt.toPercent(aiResult.confidence) }}%</text>
            </view>
          </view>

          <view v-if="aiHint" class="mt-2 rounded-lg px-2.5 py-2 text-xs" :class="fmt.isWarningHint(aiHint) ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'">
            {{ aiHint }}
          </view>

          <!-- Search -->
          <view class="mt-3">
            <view class="flex items-center gap-2">
              <view class="flex-1 flex items-center gap-2 rounded-xl bg-card px-3" style="height: 72rpx;">
                <t-icon name="search" size="32rpx" color="var(--color-muted-foreground)" />
                <input
                  :value="searchQuery"
                  class="flex-1 text-sm"
                  style="color: var(--color-foreground);"
                  placeholder="搜索 TMDB..."
                  placeholder-style="color: var(--color-muted-foreground);"
                  @input="onSearchInput"
                  @confirm="handleManualSearch"
                />
              </view>
              <view
                class="shrink-0 rounded-xl bg-primary flex items-center justify-center"
                style="height: 72rpx; width: 120rpx;"
                hover-class="opacity-80"
                @tap="handleManualSearch"
              >
                <t-loading v-if="searching" theme="circular" size="32rpx" />
                <text v-else class="text-sm font-medium text-primary-foreground">搜索</text>
              </view>
            </view>

            <view class="mt-2 flex items-center gap-2">
              <view class="text-xs text-muted-foreground">
                类型由候选结果自动判断
              </view>

              <view v-if="selectedMediaType === 'tv'" class="flex items-center gap-2 ml-auto">
                <view class="flex items-center gap-1">
                  <text class="text-xs text-muted-foreground">S</text>
                  <input
                    :value="season"
                    type="number"
                    class="text-xs text-center rounded-md px-1"
                    style="width: 92rpx; height: 52rpx; border: 1rpx solid var(--color-border); color: var(--color-foreground);"
                    placeholder="1"
                    placeholder-style="color: var(--color-muted-foreground);"
                    @input="onSeasonChange"
                  />
                </view>
                <view class="flex items-center gap-1">
                  <text class="text-xs text-muted-foreground">E</text>
                  <input
                    :value="episode"
                    type="number"
                    class="text-xs text-center rounded-md px-1"
                    style="width: 110rpx; height: 52rpx; border: 1rpx solid var(--color-border); color: var(--color-foreground);"
                    placeholder="1"
                    placeholder-style="color: var(--color-muted-foreground);"
                    @input="onEpisodeChange"
                  />
                </view>
              </view>
            </view>

            <view class="mt-2 grid grid-cols-2 gap-2">
              <view
                class="flex items-center justify-center gap-1 rounded-xl py-2 bg-primary"
                :class="{ 'opacity-50': matchLoading }"
                hover-class="opacity-80"
                @tap="handleAutoMatch"
              >
                <t-loading v-if="matchLoading" theme="circular" size="28rpx" />
                <t-icon v-else name="search" size="28rpx" color="#fff" />
                <text class="text-sm font-medium text-primary-foreground">自动匹配</text>
              </view>

              <view
                class="flex items-center justify-center gap-1 rounded-xl py-2 bg-accent"
                :class="{ 'opacity-50': aiLoading }"
                hover-class="opacity-80"
                @tap="handleAIRecognize"
              >
                <t-loading v-if="aiLoading" theme="circular" size="28rpx" />
                <t-icon v-else name="root-list" size="28rpx" color="var(--color-accent-foreground)" />
                <text class="text-sm font-medium text-accent-foreground">AI 识别</text>
              </view>
            </view>
          </view>

          <!-- Candidates -->
          <view class="mt-3">
            <view class="flex items-center justify-between">
              <text class="text-xs font-medium text-muted-foreground">匹配结果</text>
              <text v-if="candidates.length > 0" class="text-xs text-muted-foreground">{{ candidates.length }} 条</text>
            </view>

            <view v-if="matchLoading || searching" class="mt-2 flex items-center justify-center py-6">
              <t-loading theme="circular" size="48rpx" />
              <text class="ml-2 text-sm text-muted-foreground">匹配中...</text>
            </view>

            <view v-else-if="candidates.length === 0" class="mt-2 py-6 text-center">
              <text class="text-sm text-muted-foreground">{{ autoMatchTried ? '没有找到候选结果，请尝试修改关键词' : '点击「自动匹配」或「AI 识别」开始' }}</text>
            </view>

            <view v-else class="mt-2 grid grid-cols-3 gap-1.5">
              <view
                v-for="c in candidateCards"
                :key="c.id"
                class="relative rounded-xl overflow-hidden border-2 bg-card"
                :class="selectedCandidate && selectedCandidate.id === c.id ? 'border-primary' : 'border-transparent'"
                :data-id="c.id"
                @tap="onSelectCandidate"
              >
                <MediaPoster
                  :src="c.posterUrl"
                  width="100%"
                  mode="widthFix"
                  rounded="rounded-none"
                />
                <view
                  class="absolute top-1 left-1 rounded px-1.5 py-0.5 text-[20rpx] text-white"
                  :class="c.mediaType === 'movie' ? 'bg-purple-500/90' : 'bg-blue-500/90'"
                >
                  {{ c.mediaType === 'movie' ? '电影' : '剧集' }}
                </view>
                <view class="p-1.5 bg-card">
                  <text class="text-xs text-foreground" style="overflow: hidden; white-space: nowrap; text-overflow: ellipsis; display: block;">
                    {{ c.displayName }}
                  </text>
                  <text class="text-xs text-muted-foreground">{{ c.displayYear }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>

      <!-- Bottom Action -->
      <view class="bg-background px-4 pt-2 pb-2">
        <view class="flex gap-2">
          <view
            class="w-1/3 flex items-center justify-center gap-1 py-3 rounded-xl bg-muted"
            :class="selectedCandidate && !previewLoading && !processing ? 'text-foreground' : 'text-muted-foreground'"
            hover-class="opacity-80"
            @tap="handlePreviewPlan"
          >
            <t-loading v-if="previewLoading" theme="circular" size="30rpx" />
            <t-icon v-else name="search" size="30rpx" color="var(--color-muted-foreground)" />
            <text class="text-sm font-medium">预览</text>
          </view>

          <view
            class="flex-1 flex items-center justify-center gap-1 py-3 rounded-xl"
            :class="selectedCandidate && !processing ? 'bg-primary' : 'bg-muted'"
            hover-class="opacity-80"
            @tap="handleProcess"
          >
            <t-loading v-if="processing" theme="circular" size="32rpx" />
            <t-icon
              v-else
              name="check"
              size="32rpx"
              :color="selectedCandidate ? '#fff' : 'var(--color-muted-foreground)'"
            />
            <text class="text-sm font-medium" :class="selectedCandidate ? 'text-primary-foreground' : 'text-muted-foreground'">
              {{ processing ? '入库中...' : '确认入库' }}
            </text>
          </view>
        </view>
      </view>
    </view>
  </t-popup>

  <t-popup
    :visible="previewVisible"
    placement="bottom"
    :close-on-overlay-click="true"
    style="--td-popup-bg-color: var(--color-background);"
    @visible-change="onPreviewVisibleChange"
  >
    <view style="height: 78vh; display: flex; flex-direction: column; border-top-left-radius: 24rpx; border-top-right-radius: 24rpx;">
      <view class="flex items-center justify-between px-4" style="height: 88rpx; border-bottom: 1rpx solid var(--color-border);">
        <text class="text-base font-semibold text-foreground">移动预览</text>
        <view
          class="flex items-center justify-center rounded-full bg-card"
          style="min-width: 60rpx; min-height: 60rpx;"
          hover-class="opacity-60"
          @tap="closePreview"
        >
          <t-icon name="close" size="32rpx" color="var(--color-foreground)" />
        </view>
      </view>

      <scroll-view scroll-y style="flex: 1; min-height: 0;">
        <view class="px-4 py-3">
          <view v-if="previewLoading" class="py-8 flex items-center justify-center">
            <t-loading theme="circular" size="48rpx" />
            <text class="ml-2 text-sm text-muted-foreground">生成预览中...</text>
          </view>

          <view v-else-if="previewActions.length === 0" class="py-8 text-center">
            <text class="text-sm text-muted-foreground">暂无可执行动作</text>
          </view>

          <block v-else>
            <view v-if="previewSummary" class="rounded-xl bg-card p-3">
              <view class="text-xs text-muted-foreground">移动文件: <text class="text-foreground font-medium">{{ previewSummary.filesMoving }}</text></view>
              <view class="mt-1 text-xs text-muted-foreground">创建 NFO: <text class="text-foreground font-medium">{{ previewSummary.nfoCreating }}</text></view>
              <view class="mt-1 text-xs text-muted-foreground">下载海报: <text class="text-foreground font-medium">{{ previewSummary.postersDownloading }}</text></view>
              <view v-if="previewSummary.nfoOverwriting > 0" class="mt-1 text-xs text-warning">
                将覆盖 NFO: {{ previewSummary.nfoOverwriting }}
              </view>
            </view>

            <view class="mt-3 flex flex-col gap-2">
              <view
                v-for="(action, idx) in previewActions"
                :key="`${idx}-${action.destination}`"
                class="rounded-xl border border-border bg-card p-3"
              >
                <view class="flex items-center justify-between">
                  <text class="text-xs font-medium" :class="fmt.getPreviewActionClass(action.type)">{{ fmt.getPreviewActionLabel(action.type) }}</text>
                  <text v-if="action.willOverwrite" class="text-[20rpx] px-1.5 py-0.5 rounded bg-warning/10 text-warning">覆盖</text>
                </view>
                <view v-if="action.source" class="mt-1 text-xs text-muted-foreground" style="word-break: break-all; font-family: Menlo, Monaco, Consolas, monospace;">
                  {{ action.source }}
                </view>
                <view v-if="action.source" class="my-1 text-xs text-muted-foreground">↓</view>
                <view class="text-xs text-foreground" style="word-break: break-all; font-family: Menlo, Monaco, Consolas, monospace;">
                  {{ action.destination }}
                </view>
              </view>
            </view>
          </block>
        </view>
      </scroll-view>

      <view class="px-4 pt-2 border-t border-border bg-background">
        <view class="flex gap-2">
          <view
            class="flex-1 flex items-center justify-center py-3 rounded-xl bg-muted"
            hover-class="opacity-80"
            @tap="closePreview"
          >
            <text class="text-sm font-medium text-muted-foreground">关闭</text>
          </view>
          <view
            class="flex-1 flex items-center justify-center py-3 rounded-xl bg-primary"
            :class="{ 'opacity-50': previewLoading || previewActions.length === 0 }"
            hover-class="opacity-80"
            @tap="executeFromPreview"
          >
            <text class="text-sm font-medium text-primary-foreground">确认执行</text>
          </view>
        </view>
        <view class="h-[calc(12rpx+env(safe-area-inset-bottom))]"></view>
      </view>
    </view>
  </t-popup>
</template>
