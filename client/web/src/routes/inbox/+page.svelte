<script lang="ts">
  import { onMount } from 'svelte';
  import {
    inferCandidateMediaType as inferCandidateMediaKind,
    inferMediaTypeFromParsed,
  } from '@media-scraper/shared/inbox-workflow';
  import { 
    fetchInboxByDirectory, 
    previewPlan,
    recognizePath,
    type MediaFile, 
    type SearchResult, 
    type DirectoryGroup,
    type PathRecognizeResult,
    type PreviewAction,
    type PreviewPlan
  } from '$lib/api';
  import InboxSidebar from '$lib/components/inbox/InboxSidebar.svelte';
  import InboxFileTable from '$lib/components/inbox/InboxFileTable.svelte';
  import InboxBatchBar from '$lib/components/inbox/InboxBatchBar.svelte';
  import InboxDetailModal from '$lib/components/inbox/InboxDetailModal.svelte';
  import InboxPreviewModal from '$lib/components/inbox/InboxPreviewModal.svelte';
  import InboxToolbar from '$lib/components/inbox/InboxToolbar.svelte';
  import { buildInboxPreviewItem, loadInboxDetailMatch, resolveInboxAiRecognize, resolveInboxTargetPath, searchInboxCandidates } from '$lib/inboxDetail';
  import { autoProcessInboxFile, aiRecognizeProcessInboxFile, processSelectedCandidate } from '$lib/inboxProcess';
  import { runInboxBatchProcess } from '$lib/inboxBatch';
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
  let selectedFile = $state<MediaFile | null>(null);
  let detailFile = $state<MediaFile | null>(null);
  let loading = $state(true);
  let filterStatus = $state('all');
  let searchQuery = $state('');
  
  let currentDir = $state('');
  
  // Match candidates for selected file
  let matchCandidates = $state<SearchResult[]>([]);
  let selectedCandidate = $state<SearchResult | null>(null);
  let isAutoMatched = $state(false);  // Whether current selection is from auto-match
  let matchScore = $state(0);  // Match confidence score
  let isSearchingTMDB = $state(false);
  let manualSearchQuery = $state('');
  let showDetailModal = $state(false);
  
  // Target library path
  let targetPath = $state('');
  let isLoadingTargetPath = $state(false);
  let targetPathSeq = 0;
  
  // 用户可编辑的季数和集数
  let editSeason = $state(1);
  let editEpisode = $state(1);
  
  // Batch operation state
  let isOperating = $state(false);
  let operationMessage = $state('');
  let batchProgress = $state({ current: 0, total: 0 });
  
  // Preview modal
  let showPreviewModal = $state(false);
  let previewActions = $state<PreviewAction[]>([]);
  let previewSummary = $state<PreviewPlan['impactSummary'] | null>(null);
  let isLoadingPreview = $state(false);
  
  // AI 识别状态
  let isAIRecognizing = $state(false);
  let aiRecognizeResult = $state<PathRecognizeResult | null>(null);
  let fileStatus = $state(new Map<string, 'processing' | 'success' | 'failed'>());

  function setFileStatus(path: string, status: 'processing' | 'success' | 'failed') {
    fileStatus = new Map(fileStatus).set(path, status);
  }

  function markFileProcessed(path: string) {
    const nextState = applyProcessedFile({ files, allFiles, selectedFile, detailFile }, path);
    files = nextState.files;
    allFiles = nextState.allFiles;
    selectedFile = nextState.selectedFile;
    detailFile = nextState.detailFile;

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
      selectedFile = nextState.selectedFile;
      detailFile = nextState.detailFile;
      showDetailModal = nextState.showDetailModal;
      matchCandidates = nextState.matchCandidates;
      selectedCandidate = nextState.selectedCandidate;
      fileStatus = nextState.fileStatus;
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
    return inferCandidateMediaKind(candidate, inferFileMediaType(selectedFile));
  }

  function closeDetailModal() {
    showDetailModal = false;
    matchCandidates = [];
    selectedCandidate = null;
    manualSearchQuery = '';
    isAutoMatched = false;
    matchScore = 0;
    aiRecognizeResult = null;
    targetPath = '';
    isLoadingTargetPath = false;
    targetPathSeq++;
  }

  function handleDetailModalOutroEnd() {
    if (!showDetailModal) {
      selectedFile = null;
      detailFile = null;
    }
  }

  async function refreshTargetPath() {
    if (!showDetailModal || !selectedFile || !selectedCandidate) {
      targetPath = '';
      isLoadingTargetPath = false;
      return;
    }

    const currentSeq = ++targetPathSeq;
    isLoadingTargetPath = true;
    try {
      const nextTargetPath = await refreshInboxTargetPath({
        showDetailModal,
        file: selectedFile,
        candidate: selectedCandidate,
        season: editSeason,
        episode: editEpisode,
      });
      if (currentSeq !== targetPathSeq) return;
      targetPath = nextTargetPath;
    } catch (e) {
      console.error('Refresh target path error:', e);
      if (currentSeq !== targetPathSeq) return;
      targetPath = '';
    } finally {
      if (currentSeq === targetPathSeq) {
        isLoadingTargetPath = false;
      }
    }
  }
  
  async function selectFileForDetail(file: MediaFile) {
    selectedFile = file;
    detailFile = file;
    matchCandidates = [];
    selectedCandidate = null;
    isAutoMatched = false;
    matchScore = 0;
    fileStatus = new Map();
    showDetailModal = true;
    
    // 初始化可编辑的季数和集数
    editSeason = file.parsed.season || 1;
    editEpisode = file.parsed.episode || 1;
    
    targetPath = '';
    isLoadingTargetPath = false;
    targetPathSeq++;
    
    isSearchingTMDB = true;
    try {
      const detailState = await loadInboxDetailMatch(file);
      matchCandidates = detailState.candidates;
      selectedCandidate = detailState.selectedCandidate;
      isAutoMatched = detailState.isAutoMatched;
      matchScore = detailState.matchScore;
      await refreshTargetPath();
    } catch (e) {
      console.error(e);
    } finally {
      isSearchingTMDB = false;
    }
  }
  
  function handleDoubleClick(file: MediaFile) {
    selectedFile = file;
    selectFileForDetail(file);
    // TODO: Open detail modal/drawer
  }
  
  function toggleAll() {
    selectedFiles = toggleAllSelection(selectedFiles, filteredFiles, f => f.path);
  }
  
  async function handleManualSearch() {
    if (!manualSearchQuery.trim() || !selectedFile) return;
    isSearchingTMDB = true;
    try {
      matchCandidates = await searchInboxCandidates(manualSearchQuery);
      selectedCandidate = null;
      await refreshTargetPath();
    } catch (e) {
      console.error(e);
    } finally {
      isSearchingTMDB = false;
    }
  }
  
  function selectCandidate(candidate: SearchResult) {
    selectedCandidate = candidate;
    // 更新预计路径 - 使用选中的候选名称
    refreshTargetPath();
  }

  function updateManualSearchQuery(value: string) {
    manualSearchQuery = value;
  }

  function updateEditSeason(value: number) {
    editSeason = normalizeInboxIndex(value);
    void refreshTargetPath();
  }

  function updateEditEpisode(value: number) {
    editEpisode = normalizeInboxIndex(value);
    void refreshTargetPath();
  }
  
  // AI 智能识别路径
  async function handleAIRecognize() {
    if (!selectedFile) return;
    
    isAIRecognizing = true;
    aiRecognizeResult = null;
    
    try {
      const resolved = await resolveInboxAiRecognize(selectedFile);
      const appliedState = applyAiRecognizeState({
        resolved,
        currentSeason: editSeason,
        currentEpisode: editEpisode,
      });
      aiRecognizeResult = appliedState.aiRecognizeResult;
      matchCandidates = appliedState.matchCandidates;
      selectedCandidate = appliedState.selectedCandidate;
      editSeason = appliedState.editSeason;
      editEpisode = appliedState.editEpisode;
      operationMessage = appliedState.operationMessage;
      if (resolved.aiRecognizeResult) {
        await refreshTargetPath();
      }
    } catch (e) {
      console.error('AI recognize error:', e);
      operationMessage = `❌ AI 识别错误: ${e instanceof Error ? e.message : '未知错误'}`;
    } finally {
      isAIRecognizing = false;
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
    isOperating = true;
    const selectedFilesList = getInboxBatchSelection(allFiles, selectedFiles);
    batchProgress = { current: 0, total: selectedFilesList.length };

    const summary = await runInboxBatchProcess(selectedFilesList, async (file, context) => {
      operationMessage = `匹配中 (${context.current}/${context.total}): ${file.name}`;
      const { result, mediaType } = await autoProcessInboxFile(file);

      if (result.success && mediaType) {
        operationMessage = `入库中 (${context.current}/${context.total}): ${file.name} [${mediaType === 'movie' ? '电影' : '剧集'}]`;
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
        batchProgress = { current: context.current, total: context.total };
      },
      onError: (file, error) => {
        console.error('Batch auto match error:', file.path, error);
      },
    });
    
    const postBatchState = createPostBatchState({ summary, selectedFiles });
    const hadSuccess = postBatchState.hadSuccess;
    operationMessage = postBatchState.operationMessage;
    if (hadSuccess) {
      await loadData();
    }
    
    setTimeout(() => {
      isOperating = false;
      operationMessage = '';
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
    isOperating = true;
    const selectedFilesList = getInboxBatchSelection(allFiles, selectedFiles);
    batchProgress = { current: 0, total: selectedFilesList.length };

    const summary = await runInboxBatchProcess(selectedFilesList, async (file, context) => {
      operationMessage = `AI 识别中 (${context.current}/${context.total}): ${file.relativePath}`;
      const { result, mediaType } = await aiRecognizeProcessInboxFile(file, recognizePath);

      if (result.success && mediaType) {
        operationMessage = `入库中 (${context.current}/${context.total}): ${file.relativePath} [${mediaType === 'movie' ? '电影' : '剧集'}]`;
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
        batchProgress = { current: context.current, total: context.total };
      },
      onError: (file, error) => {
        console.error('Batch AI process error:', file.path, error);
      },
    });
    
    const postBatchState = createPostBatchState({ summary, selectedFiles });
    const hadSuccess = postBatchState.hadSuccess;
    operationMessage = postBatchState.operationMessage;
    if (hadSuccess) {
      await loadData();
    }
    
    setTimeout(() => {
      isOperating = false;
      operationMessage = '';
      if (hadSuccess) {
        selectedFiles = postBatchState.selectedFiles;
      }
    }, 3000);  // 延长显示时间以便用户看到统计
  }
  
  async function processSingleFile() {
    if (!selectedFile || !selectedCandidate) return;

    const currentFile = selectedFile;
    const currentCandidate = selectedCandidate;
    
    isOperating = true;
    operationMessage = `正在处理: ${currentFile.relativePath}`;
    setFileStatus(currentFile.path, 'processing');
    
    try {
      const result = await processSelectedCandidate(currentFile, currentCandidate, {
        season: editSeason,
        episode: editEpisode,
      });
      operationMessage = result.success ? '处理成功' : (result.message || '处理失败');
      if (result.success) {
        markFileProcessed(currentFile.path);
        setFileStatus(currentFile.path, 'success');
      } else {
        setFileStatus(currentFile.path, 'failed');
      }
      
      await loadData();
    } catch (e) {
      operationMessage = '处理出错';
      console.error(e);
      setFileStatus(currentFile.path, 'failed');
    }
    
    setTimeout(() => {
      isOperating = false;
      operationMessage = '';
    }, 2000);
  }
  
  async function showPreview() {
    if (!selectedFile || !selectedCandidate) return;

    const currentFile = selectedFile;
    const currentCandidate = selectedCandidate;
    
    isLoadingPreview = true;
    showPreviewModal = true;
    
    try {
      // 根据选中候选自动决定媒体类型
      const plan = await previewPlan([
        buildInboxPreviewItem({
          file: currentFile,
          candidate: currentCandidate,
          season: editSeason,
          episode: editEpisode,
        })!,
      ]);
      const previewState = createInboxPreviewState(plan);
      previewActions = previewState.previewActions;
      previewSummary = previewState.previewSummary;
    } catch (e) {
      console.error(e);
      const previewState = createInboxPreviewState(null);
      previewActions = previewState.previewActions;
      previewSummary = previewState.previewSummary;
    } finally {
      isLoadingPreview = false;
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
        
        <InboxFileTable loading={loading} filteredFiles={filteredFiles} selectedFiles={selectedFiles} fileStatus={fileStatus} onToggleAll={toggleAll} onToggleFile={toggleFile} onToggleFileSelection={toggleFileSelection} onDoubleClick={handleDoubleClick} />
      
    </div>
    
    <!-- Bottom Panel: Action bar always visible, Details slides -->
    <InboxBatchBar isOperating={isOperating} operationMessage={operationMessage} batchProgress={batchProgress} selectedCount={selectedFiles.size} onBatchAuto={batchAutoMatchAndProcess} onBatchAI={batchAIRecognizeAndProcess} />
  </div>
  </div>
</div>

<InboxDetailModal show={showDetailModal} detailFile={detailFile} selectedCandidate={selectedCandidate} targetPath={targetPath} isLoadingTargetPath={isLoadingTargetPath} isOperating={isOperating} manualSearchQuery={manualSearchQuery} isSearchingTMDB={isSearchingTMDB} isAIRecognizing={isAIRecognizing} editSeason={editSeason} editEpisode={editEpisode} aiRecognizeResult={aiRecognizeResult} matchCandidates={matchCandidates} inferCandidateMediaType={inferCandidateMediaType} onClose={closeDetailModal} onOutroEnd={handleDetailModalOutroEnd} onShowPreview={showPreview} onProcess={processSingleFile} onManualSearch={handleManualSearch} onAIRecognize={handleAIRecognize} onManualSearchQueryChange={updateManualSearchQuery} onSelectCandidate={selectCandidate} onEditSeasonChange={updateEditSeason} onEditEpisodeChange={updateEditEpisode} />

<InboxPreviewModal show={showPreviewModal} isLoading={isLoadingPreview} actions={previewActions} summary={previewSummary} onClose={() => showPreviewModal = false} onConfirm={() => { showPreviewModal = false; processSingleFile(); }} />

<!-- Confirm Dialog is now handled globally in +layout.svelte -->

<style lang="postcss">
  @reference "tailwindcss";
</style>
