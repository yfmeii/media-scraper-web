<script lang="ts">
  import { onMount } from 'svelte';
  import {
    inferCandidateMediaType as inferCandidateMediaKind,
    inferMediaTypeFromParsed,
  } from '@media-scraper/shared/inbox-workflow';
  import {
    previewPlan,
    recognizePath,
    type MediaFile, 
    type SearchResult, 
    type DirectoryGroup,
  } from '$lib/api';
  import InboxSidebar from '$lib/components/inbox/InboxSidebar.svelte';
  import InboxFileTable from '$lib/components/inbox/InboxFileTable.svelte';
  import InboxBatchBar from '$lib/components/inbox/InboxBatchBar.svelte';
  import InboxDetailModal from '$lib/components/inbox/InboxDetailModal.svelte';
  import InboxPreviewModal from '$lib/components/inbox/InboxPreviewModal.svelte';
  import InboxToolbar from '$lib/components/inbox/InboxToolbar.svelte';
  import { buildInboxPreviewItem, loadInboxDetailMatch, resolveInboxAiRecognize, searchInboxCandidates } from '$lib/inboxDetail';
  import { autoProcessInboxFile, aiRecognizeProcessInboxFile, processSelectedCandidate } from '$lib/inboxProcess';
  import { runInboxBatchProcess } from '$lib/inboxBatch';
  import {
    createClosingInboxDetailUiState,
    createInboxDetailUiState,
    createInboxOperationUiState,
    createInboxPreviewUiState,
    createOpenedInboxDetailUiState,
    setInboxFileProcessStatus,
  } from '$lib/inboxPageState';
  import {
    applyAiRecognizeState,
    applyProcessedFile,
    createInboxPreviewState,
    createPostBatchState,
    getInboxBatchSelection,
    loadInboxPageData,
    refreshInboxTargetPath,
  } from '$lib/inboxPageWorkflow';
  import {
    buildCurrentDirLabel,
    filterInboxFiles,
    normalizeInboxIndex,
    resolveDirectorySelection,
  } from '$lib/inboxPage';
  import { confirmDialog } from '$lib/stores';
  import { handleItemClick, toggleAllSelection } from '$lib/selection';
  
  let directories = $state<DirectoryGroup[]>([]);
  let files = $state<MediaFile[]>([]);
  let allFiles = $state<MediaFile[]>([]);
  let selectedFiles = $state(new Set<string>());
  let loading = $state(true);
  let filterStatus = $state('all');
  let searchQuery = $state('');
  
  let currentDir = $state('');

  let detailState = $state(createInboxDetailUiState());
  let operationState = $state(createInboxOperationUiState());
  let previewState = $state(createInboxPreviewUiState());

  function setFileStatus(path: string, status: 'processing' | 'success' | 'failed') {
    operationState.fileStatus = setInboxFileProcessStatus(operationState.fileStatus, path, status);
  }

  function markFileProcessed(path: string) {
    const nextState = applyProcessedFile({
      files,
      allFiles,
      selectedFile: detailState.selectedFile,
      detailFile: detailState.detailFile,
    }, path);
    files = nextState.files;
    allFiles = nextState.allFiles;
    detailState.selectedFile = nextState.selectedFile;
    detailState.detailFile = nextState.detailFile;

    if (!nextState.updated) return;
  }

  const currentDirLabel = $derived.by(() => buildCurrentDirLabel(currentDir));
  
  onMount(async () => {
    await loadData();
  });
  
  async function loadData() {
    loading = true;
    try {
      const nextState = await loadInboxPageData(currentDir);
      directories = nextState.directories;
      allFiles = nextState.allFiles;
      currentDir = nextState.currentDir;
      files = nextState.files;
      selectedFiles = nextState.selectedFiles;
      detailState.selectedFile = nextState.selectedFile;
      detailState.detailFile = nextState.detailFile;
      detailState.showDetailModal = nextState.showDetailModal;
      detailState.matchCandidates = nextState.matchCandidates;
      detailState.selectedCandidate = nextState.selectedCandidate;
      operationState.fileStatus = nextState.fileStatus;
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }
  
  function selectDirectory(dir: DirectoryGroup | null) {
    const nextSelection = resolveDirectorySelection(dir, allFiles);
    currentDir = nextSelection.currentDir;
    files = nextSelection.files;
    selectedFiles = new Set();
    closeDetailModal();
  }
  
  function toggleFile(path: string, event: MouseEvent) {
    const isRangeSelect = event.shiftKey && selectedFiles.size > 0;
    const isToggleSelect = event.ctrlKey || event.metaKey;
    
    selectedFiles = handleItemClick(path, event, selectedFiles, files, f => f.path);

    if (isRangeSelect || isToggleSelect) return;

    // Update selected file for detail only on normal click
    const file = files.find(f => f.path === path);
    if (file) {
      selectFileForDetail(file);
    }
  }

  function toggleFileSelection(path: string, event: MouseEvent) {
    if (event.shiftKey && selectedFiles.size > 0) {
      selectedFiles = handleItemClick(path, event, selectedFiles, files, f => f.path);
      return;
    }

    const nextSelected = new Set(selectedFiles);
    if (nextSelected.has(path)) {
      nextSelected.delete(path);
    } else {
      nextSelected.add(path);
    }
    selectedFiles = nextSelected;
  }

  function inferFileMediaType(file: MediaFile | null): 'tv' | 'movie' {
    return inferMediaTypeFromParsed(file?.parsed);
  }

  function inferCandidateMediaType(candidate: SearchResult | null): 'tv' | 'movie' {
    return inferCandidateMediaKind(candidate, inferFileMediaType(detailState.selectedFile));
  }

  function closeDetailModal() {
    detailState = createClosingInboxDetailUiState({
      selectedFile: detailState.selectedFile,
      detailFile: detailState.detailFile,
      currentTargetPathSeq: detailState.targetPathSeq,
    });
  }

  function handleDetailModalOutroEnd() {
    if (!detailState.showDetailModal) {
      detailState.selectedFile = null;
      detailState.detailFile = null;
    }
  }

  async function refreshTargetPath() {
    if (!detailState.showDetailModal || !detailState.selectedFile || !detailState.selectedCandidate) {
      detailState.targetPath = '';
      detailState.isLoadingTargetPath = false;
      return;
    }

    const currentSeq = ++detailState.targetPathSeq;
    detailState.isLoadingTargetPath = true;
    try {
      const nextTargetPath = await refreshInboxTargetPath({
        showDetailModal: detailState.showDetailModal,
        file: detailState.selectedFile,
        candidate: detailState.selectedCandidate,
        season: detailState.editSeason,
        episode: detailState.editEpisode,
      });
      if (currentSeq !== detailState.targetPathSeq) return;
      detailState.targetPath = nextTargetPath;
    } catch (e) {
      console.error('Refresh target path error:', e);
      if (currentSeq !== detailState.targetPathSeq) return;
      detailState.targetPath = '';
    } finally {
      if (currentSeq === detailState.targetPathSeq) {
        detailState.isLoadingTargetPath = false;
      }
    }
  }
  
  async function selectFileForDetail(file: MediaFile) {
    detailState = createOpenedInboxDetailUiState(file, detailState.targetPathSeq);
    operationState.fileStatus = new Map();
    detailState.isSearchingTMDB = true;
    try {
      const matchState = await loadInboxDetailMatch(file);
      detailState.matchCandidates = matchState.candidates;
      detailState.selectedCandidate = matchState.selectedCandidate;
      detailState.isAutoMatched = matchState.isAutoMatched;
      detailState.matchScore = matchState.matchScore;
      await refreshTargetPath();
    } catch (e) {
      console.error(e);
    } finally {
      detailState.isSearchingTMDB = false;
    }
  }
  
  function handleDoubleClick(file: MediaFile) {
    void selectFileForDetail(file);
    // TODO: Open detail modal/drawer
  }
  
  function toggleAll() {
    selectedFiles = toggleAllSelection(selectedFiles, filteredFiles, f => f.path);
  }
  
  async function handleManualSearch() {
    if (!detailState.manualSearchQuery.trim() || !detailState.selectedFile) return;
    detailState.isSearchingTMDB = true;
    try {
      detailState.matchCandidates = await searchInboxCandidates(detailState.manualSearchQuery);
      detailState.selectedCandidate = null;
      await refreshTargetPath();
    } catch (e) {
      console.error(e);
    } finally {
      detailState.isSearchingTMDB = false;
    }
  }
  
  function selectCandidate(candidate: SearchResult) {
    detailState.selectedCandidate = candidate;
    // 更新预计路径 - 使用选中的候选名称
    void refreshTargetPath();
  }

  function updateManualSearchQuery(value: string) {
    detailState.manualSearchQuery = value;
  }

  function updateEditSeason(value: number) {
    detailState.editSeason = normalizeInboxIndex(value);
    void refreshTargetPath();
  }

  function updateEditEpisode(value: number) {
    detailState.editEpisode = normalizeInboxIndex(value);
    void refreshTargetPath();
  }
  
  // AI 智能识别路径
  async function handleAIRecognize() {
    if (!detailState.selectedFile) return;
    
    detailState.isAIRecognizing = true;
    detailState.aiRecognizeResult = null;
    
    try {
      const resolved = await resolveInboxAiRecognize(detailState.selectedFile);
      const appliedState = applyAiRecognizeState({
        resolved,
        currentSeason: detailState.editSeason,
        currentEpisode: detailState.editEpisode,
      });
      detailState.aiRecognizeResult = appliedState.aiRecognizeResult;
      detailState.matchCandidates = appliedState.matchCandidates;
      detailState.selectedCandidate = appliedState.selectedCandidate;
      detailState.editSeason = appliedState.editSeason;
      detailState.editEpisode = appliedState.editEpisode;
      operationState.operationMessage = appliedState.operationMessage;
      if (resolved.aiRecognizeResult) {
        await refreshTargetPath();
      }
    } catch (e) {
      console.error('AI recognize error:', e);
      operationState.operationMessage = `❌ AI 识别错误: ${e instanceof Error ? e.message : '未知错误'}`;
    } finally {
      detailState.isAIRecognizing = false;
    }
  }
  
  // Batch operations - 一键自动匹配入库（自动判断电影/剧集）
  async function batchAutoMatchAndProcess() {
    if (selectedFiles.size === 0) return;
    
    confirmDialog.show({
      title: '一键匹配入库',
      message: `确定对 ${selectedFiles.size} 个文件进行自动匹配入库？\n\n根据文件解析结果自动判断类型：\n• 有季/集信息 → 剧集\n• 无季/集信息 → 电影\n\n⚠️ 此操作将移动文件到媒体库`,
      onConfirm: executeBatchAutoMatch
    });
  }
  
  async function executeBatchAutoMatch() {
    operationState.isOperating = true;
    const selectedFilesList = getInboxBatchSelection(allFiles, selectedFiles);
    operationState.batchProgress = { current: 0, total: selectedFilesList.length };

    const summary = await runInboxBatchProcess(selectedFilesList, async (file, context) => {
      operationState.operationMessage = `匹配中 (${context.current}/${context.total}): ${file.name}`;
      const { result, mediaType } = await autoProcessInboxFile(file);

      if (result.success && mediaType) {
        operationState.operationMessage = `入库中 (${context.current}/${context.total}): ${file.name} [${mediaType === 'movie' ? '电影' : '剧集'}]`;
        return { success: true, mediaType };
      }

      return { success: false, mediaType };
    }, {
      onStart: (file) => {
        setFileStatus(file.path, 'processing');
      },
      onSettled: (file, outcome, context) => {
        if (outcome.success) {
          markFileProcessed(file.path);
          setFileStatus(file.path, 'success');
        } else {
          setFileStatus(file.path, 'failed');
        }
        operationState.batchProgress = { current: context.current, total: context.total };
      },
      onError: (file, error) => {
        console.error('Batch auto match error:', file.path, error);
      },
    });
    
    const postBatchState = createPostBatchState({ summary, selectedFiles });
    const hadSuccess = postBatchState.hadSuccess;
    operationState.operationMessage = postBatchState.operationMessage;
    if (hadSuccess) {
      await loadData();
    }
    
    setTimeout(() => {
      operationState.isOperating = false;
      operationState.operationMessage = '';
      if (hadSuccess) {
        selectedFiles = postBatchState.selectedFiles;
      }
    }, 3000);
  }
  
  // Batch operations - 一键 AI 识别入库
  async function batchAIRecognizeAndProcess() {
    if (selectedFiles.size === 0) return;
    
    confirmDialog.show({
      title: '一键 AI 识别入库',
      message: `确定对 ${selectedFiles.size} 个文件进行 AI 识别入库？\n\n🤖 AI 将自动判断每个文件是电影还是剧集\n\n⚠️ 此操作将移动文件到媒体库`,
      onConfirm: executeBatchAIRecognize,
      confirmVariant: 'destructive',
    });
  }
  
  async function executeBatchAIRecognize() {
    operationState.isOperating = true;
    const selectedFilesList = getInboxBatchSelection(allFiles, selectedFiles);
    operationState.batchProgress = { current: 0, total: selectedFilesList.length };

    const summary = await runInboxBatchProcess(selectedFilesList, async (file, context) => {
      operationState.operationMessage = `AI 识别中 (${context.current}/${context.total}): ${file.relativePath}`;
      const { result, mediaType } = await aiRecognizeProcessInboxFile(file, recognizePath);

      if (result.success && mediaType) {
        operationState.operationMessage = `入库中 (${context.current}/${context.total}): ${file.relativePath} [${mediaType === 'movie' ? '电影' : '剧集'}]`;
        return { success: true, mediaType };
      }

      return { success: false, mediaType };
    }, {
      onStart: (file) => {
        setFileStatus(file.path, 'processing');
      },
      onSettled: (file, outcome, context) => {
        if (outcome.success) {
          markFileProcessed(file.path);
          setFileStatus(file.path, 'success');
        } else {
          setFileStatus(file.path, 'failed');
        }
        operationState.batchProgress = { current: context.current, total: context.total };
      },
      onError: (file, error) => {
        console.error('Batch AI process error:', file.path, error);
      },
    });
    
    const postBatchState = createPostBatchState({ summary, selectedFiles });
    const hadSuccess = postBatchState.hadSuccess;
    operationState.operationMessage = postBatchState.operationMessage;
    if (hadSuccess) {
      await loadData();
    }
    
    setTimeout(() => {
      operationState.isOperating = false;
      operationState.operationMessage = '';
      if (hadSuccess) {
        selectedFiles = postBatchState.selectedFiles;
      }
    }, 3000);  // 延长显示时间以便用户看到统计
  }
  
  async function processSingleFile() {
    if (!detailState.selectedFile || !detailState.selectedCandidate) return;

    const currentFile = detailState.selectedFile;
    const currentCandidate = detailState.selectedCandidate;
    
    operationState.isOperating = true;
    operationState.operationMessage = `正在处理: ${currentFile.relativePath}`;
    setFileStatus(currentFile.path, 'processing');
    
    try {
      const result = await processSelectedCandidate(currentFile, currentCandidate, {
        season: detailState.editSeason,
        episode: detailState.editEpisode,
      });
      operationState.operationMessage = result.success ? '处理成功' : (result.message || '处理失败');
      if (result.success) {
        markFileProcessed(currentFile.path);
        setFileStatus(currentFile.path, 'success');
      } else {
        setFileStatus(currentFile.path, 'failed');
      }
      
      await loadData();
    } catch (e) {
      operationState.operationMessage = '处理出错';
      console.error(e);
      setFileStatus(currentFile.path, 'failed');
    }
    
    setTimeout(() => {
      operationState.isOperating = false;
      operationState.operationMessage = '';
    }, 2000);
  }
  
  async function showPreview() {
    if (!detailState.selectedFile || !detailState.selectedCandidate) return;

    const currentFile = detailState.selectedFile;
    const currentCandidate = detailState.selectedCandidate;
    
    previewState.isLoadingPreview = true;
    previewState.showPreviewModal = true;
    
    try {
      // 根据选中候选自动决定媒体类型
      const plan = await previewPlan([
        buildInboxPreviewItem({
          file: currentFile,
          candidate: currentCandidate,
          season: detailState.editSeason,
          episode: detailState.editEpisode,
        })!,
      ]);
      const nextPreviewState = createInboxPreviewState(plan);
      previewState.previewActions = nextPreviewState.previewActions;
      previewState.previewSummary = nextPreviewState.previewSummary;
    } catch (e) {
      console.error(e);
      const nextPreviewState = createInboxPreviewState(null);
      previewState.previewActions = nextPreviewState.previewActions;
      previewState.previewSummary = nextPreviewState.previewSummary;
    } finally {
      previewState.isLoadingPreview = false;
    }
  }
  
  const filteredFiles = $derived.by(() => filterInboxFiles(files, filterStatus, searchQuery));
</script>

<div class="container mx-auto px-4 py-4">
  <div class="flex h-[calc(100vh-64px-32px)] border border-border rounded-lg overflow-hidden">
    <InboxSidebar loading={loading} directories={directories} currentDir={currentDir} allFilesCount={allFiles.length} onSelect={selectDirectory} />
  
  <!-- Main Content -->
  <div class="flex flex-1 flex-col">
    <!-- File List -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <InboxToolbar bind:filterStatus bind:searchQuery currentDirLabel={currentDirLabel} onRefresh={loadData} />
        
        <InboxFileTable loading={loading} filteredFiles={filteredFiles} selectedFiles={selectedFiles} fileStatus={operationState.fileStatus} onToggleAll={toggleAll} onToggleFile={toggleFile} onToggleFileSelection={toggleFileSelection} onDoubleClick={handleDoubleClick} />
      
    </div>
    
    <!-- Bottom Panel: Action bar always visible, Details slides -->
    <InboxBatchBar isOperating={operationState.isOperating} operationMessage={operationState.operationMessage} batchProgress={operationState.batchProgress} selectedCount={selectedFiles.size} onBatchAuto={batchAutoMatchAndProcess} onBatchAI={batchAIRecognizeAndProcess} />
  </div>
  </div>
</div>

<InboxDetailModal show={detailState.showDetailModal} detailFile={detailState.detailFile} selectedCandidate={detailState.selectedCandidate} targetPath={detailState.targetPath} isLoadingTargetPath={detailState.isLoadingTargetPath} isOperating={operationState.isOperating} manualSearchQuery={detailState.manualSearchQuery} isSearchingTMDB={detailState.isSearchingTMDB} isAIRecognizing={detailState.isAIRecognizing} editSeason={detailState.editSeason} editEpisode={detailState.editEpisode} aiRecognizeResult={detailState.aiRecognizeResult} matchCandidates={detailState.matchCandidates} inferCandidateMediaType={inferCandidateMediaType} onClose={closeDetailModal} onOutroEnd={handleDetailModalOutroEnd} onShowPreview={showPreview} onProcess={processSingleFile} onManualSearch={handleManualSearch} onAIRecognize={handleAIRecognize} onManualSearchQueryChange={updateManualSearchQuery} onSelectCandidate={selectCandidate} onEditSeasonChange={updateEditSeason} onEditEpisodeChange={updateEditEpisode} />

<InboxPreviewModal show={previewState.showPreviewModal} isLoading={previewState.isLoadingPreview} actions={previewState.previewActions} summary={previewState.previewSummary} onClose={() => previewState.showPreviewModal = false} onConfirm={() => { previewState.showPreviewModal = false; processSingleFile(); }} />

<!-- Confirm Dialog is now handled globally in +layout.svelte -->

<style lang="postcss">
  @reference "tailwindcss";
</style>
