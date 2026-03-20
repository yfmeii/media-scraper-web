<script setup lang="ts">
import type { MediaFile } from '@media-scraper/shared'
import PanelContent from './PanelContent.vue'
import PreviewPopup from './PreviewPopup.vue'
import { useInboxFileDetail } from './useInboxFileDetail'

defineComponentJson({ styleIsolation: 'apply-shared' })

const props = defineProps<{
  visible: boolean
  file: MediaFile | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'processed'): void
}>()

const {
  localVisible,
  processing,
  aiLoading,
  previewVisible,
  previewLoading,
  previewActions,
  previewSummary,
  searchQuery,
  season,
  episode,
  aiResult,
  aiHint,
  autoMatchTried,
  targetPreviewPath,
  targetPreviewLoading,
  matchLoading,
  searching,
  candidates,
  selectedCandidate,
  candidateCards,
  selectedMediaType,
  onVisibleChange,
  onPreviewVisibleChange,
  onSearchInput,
  onSeasonChange,
  onEpisodeChange,
  closePopup,
  onSelectCandidate,
  handleAutoMatch,
  handleManualSearch,
  handleAIRecognize,
  handlePreviewPlan,
  handleProcess,
  executeFromPreview,
  closePreview,
  initForFile,
} = useInboxFileDetail({
  getVisible: () => props.visible,
  getFile: () => props.file,
  emitClose: () => emit('close'),
  emitProcessed: () => emit('processed'),
})

defineExpose({ initForFile })
</script>

<template>
  <t-popup
    :visible="localVisible"
    placement="bottom"
    :close-on-overlay-click="true"
    style="--td-popup-bg-color: var(--color-background);"
    @visible-change="onVisibleChange"
  >
    <PanelContent
      v-if="file"
      :file="file"
      :selected-candidate="selectedCandidate"
      :target-preview-path="targetPreviewPath"
      :target-preview-loading="targetPreviewLoading"
      :ai-result="aiResult"
      :ai-hint="aiHint"
      :search-query="searchQuery"
      :selected-media-type="selectedMediaType"
      :season="season"
      :episode="episode"
      :match-loading="matchLoading"
      :searching="searching"
      :ai-loading="aiLoading"
      :auto-match-tried="autoMatchTried"
      :candidate-cards="candidateCards"
      :candidate-count="candidates.length"
      :processing="processing"
      :preview-loading="previewLoading"
      @close="closePopup"
      @search-input="onSearchInput"
      @season-input="onSeasonChange"
      @episode-input="onEpisodeChange"
      @manual-search="handleManualSearch"
      @auto-match="handleAutoMatch"
      @ai-recognize="handleAIRecognize"
      @select-candidate="onSelectCandidate"
      @preview="handlePreviewPlan"
      @process="handleProcess"
    />
  </t-popup>

  <PreviewPopup :visible="previewVisible" :loading="previewLoading" :actions="previewActions" :summary="previewSummary" @close="closePreview" @confirm="executeFromPreview" @visible-change="onPreviewVisibleChange" />
</template>
