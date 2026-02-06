<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, scale, slide, fly } from 'svelte/transition';
  import { quintOut, cubicOut } from 'svelte/easing';
  import { flip } from 'svelte/animate';
  import { 
    fetchInboxByDirectory, 
    searchTMDB, 
    processTV, 
    processMovie, 
    autoMatch, 
    previewPlan,
    recognizePath,
    type MediaFile, 
    type SearchResult, 
    type DirectoryGroup,
    type PathRecognizeResult,
    type PreviewItem,
    type PreviewAction,
    type PreviewPlan
  } from '$lib/api';
  import { confirmDialog } from '$lib/stores';
  import { handleItemClick, toggleAllSelection } from '$lib/selection';
  
  let directories = $state<DirectoryGroup[]>([]);
  let files = $state<MediaFile[]>([]);
  let allFiles = $state<MediaFile[]>([]);
  let selectedFiles = $state(new Set<string>());
  let selectedFile = $state<MediaFile | null>(null);
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
    let updated = false;
    for (const list of [files, allFiles]) {
      const item = list.find(f => f.path === path);
      if (item && !item.isProcessed) {
        item.isProcessed = true;
        updated = true;
      }
    }

    if (selectedFile?.path === path && selectedFile && !selectedFile.isProcessed) {
      selectedFile = { ...selectedFile, isProcessed: true };
      updated = true;
    }

    if (updated) {
      files = [...files];
      allFiles = [...allFiles];
    }
  }
  
  onMount(async () => {
    await loadData();
  });
  
  async function loadData() {
    loading = true;
    const prevDir = currentDir;
    try {
      directories = await fetchInboxByDirectory();
      // Collect all files
      allFiles = directories.flatMap(d => d.files);
      
      // Try to keep current directory if it still exists
      const currentDirData = directories.find(d => d.path === prevDir);
      if (currentDirData) {
        currentDir = currentDirData.path;
        files = currentDirData.files;
      } else if (directories.length > 0) {
        // Fallback to first directory
        currentDir = directories[0].path;
        files = directories[0].files;
      } else {
        currentDir = '';
        files = [];
      }
      
      // Clear selection
      selectedFiles = new Set();
      selectedFile = null;
      matchCandidates = [];
      selectedCandidate = null;
      fileStatus = new Map();
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }
  
  function selectDirectory(dir: DirectoryGroup | null) {
    if (dir === null) {
      // Select "All"
      currentDir = '';
      files = allFiles;
    } else {
      currentDir = dir.path;
      files = dir.files;
    }
    selectedFiles = new Set();
    selectedFile = null;
    showDetailModal = false;
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
    if (!file) return 'movie';
    return file.parsed.season !== undefined || file.parsed.episode !== undefined ? 'tv' : 'movie';
  }

  function inferCandidateMediaType(candidate: SearchResult | null): 'tv' | 'movie' {
    if (candidate?.mediaType === 'tv' || candidate?.mediaType === 'movie') return candidate.mediaType;
    return inferFileMediaType(selectedFile);
  }
  
  async function selectFileForDetail(file: MediaFile) {
    selectedFile = file;
    matchCandidates = [];
    selectedCandidate = null;
    isAutoMatched = false;
    matchScore = 0;
    fileStatus = new Map();
    showDetailModal = true;
    
    // 初始化可编辑的季数和集数
    editSeason = file.parsed.season || 1;
    editEpisode = file.parsed.episode || 1;
    
    // 自动匹配使用解析出的标题
    const searchKeyword = file.parsed.title || file.name.replace(/\.[^/.]+$/, '');
    
    // Set target path
    if (inferFileMediaType(file) === 'movie') {
      targetPath = `Library/Movies/${searchKeyword}`;
    } else {
      targetPath = `Library/Shows/${searchKeyword}/Season ${String(file.parsed.season || 1).padStart(2, '0')}`;
    }
    
    // Auto match using backend API - 使用解析出的标题进行 TMDB 匹配
    isSearchingTMDB = true;
    try {
      // 使用解析出的标题（无手动类型，后端自动混合匹配）
      const matchResult = await autoMatch(file.path, searchKeyword, file.parsed.year);
      
      // Convert candidates to SearchResult format
      matchCandidates = matchResult.candidates.map(c => ({
        id: c.id,
        mediaType: c.mediaType,
        name: c.name,
        title: c.name,
        posterPath: c.posterPath,
        overview: c.overview,
        // Backend returns 'date' field, map it to firstAirDate/releaseDate
        firstAirDate: c.date,
        releaseDate: c.date,
      }));
      
      if (matchResult.matched && matchResult.result) {
        // Find the matched result in candidates
        const matched = matchCandidates.find(c => c.id === matchResult.result!.id);
        if (matched) {
          selectedCandidate = matched;
          isAutoMatched = true;
          matchScore = matchResult.result.score;
        } else if (matchCandidates.length > 0) {
          selectedCandidate = matchCandidates[0];
        }
      } else if (matchCandidates.length > 0) {
        selectedCandidate = matchCandidates[0];
      }
      // 更新预计路径
      updateTargetPath();
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
      matchCandidates = await searchTMDB(manualSearchQuery);
      if (matchCandidates.length > 0) {
        selectedCandidate = matchCandidates[0];
        // 更新预计路径
        updateTargetPath();
      }
    } catch (e) {
      console.error(e);
    } finally {
      isSearchingTMDB = false;
    }
  }
  
  function selectCandidate(candidate: SearchResult) {
    selectedCandidate = candidate;
    // 更新预计路径 - 使用选中的候选名称
    updateTargetPath();
  }
  
  function updateTargetPath() {
    if (!selectedFile || !selectedCandidate) return;
    const name = selectedCandidate.name || selectedCandidate.title || '';
    if (inferCandidateMediaType(selectedCandidate) === 'movie') {
      targetPath = `Library/Movies/${name}`;
    } else {
      // 使用用户编辑的季数
      targetPath = `Library/Shows/${name}/Season ${String(editSeason).padStart(2, '0')}`;
    }
  }
  
  // AI 智能识别路径
  async function handleAIRecognize() {
    if (!selectedFile) return;
    
    isAIRecognizing = true;
    aiRecognizeResult = null;
    
    try {
      const result = await recognizePath(selectedFile.relativePath);
      
      if (result) {
        aiRecognizeResult = result;
        
        const aiMediaType = result.media_type || 'tv';
        operationMessage = `🤖 AI 识别为${aiMediaType === 'movie' ? '电影' : '剧集'}，请选择候选确认`;
        
        // 置信度警告
        if (result.confidence < 0.7) {
          operationMessage = `⚠️ AI 置信度较低 (${Math.round(result.confidence * 100)}%)，建议手动确认`;
        }
        
        // 更新季/集编辑值
        if (result.season !== null) {
          editSeason = result.season;
        }
        if (result.episode !== null) {
          editEpisode = result.episode;
        }
        
        // 如果有 TMDB 结果，更新匹配
        if (result.tmdb_id && result.tmdb_name) {
          const searchResults = await searchTMDB(result.tmdb_name);
          if (searchResults.length > 0) {
            // 找到匹配的结果
            const matched = searchResults.find(r => r.id === result.tmdb_id) || searchResults[0];
            matchCandidates = searchResults;
            selectedCandidate = matched;
            updateTargetPath();
          }
        }
      } else {
        operationMessage = '❌ AI 识别失败，请手动搜索';
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
    const selectedFilesList = allFiles.filter(f => selectedFiles.has(f.path));
    batchProgress = { current: 0, total: selectedFilesList.length };
    
    let successCount = 0;
    let failCount = 0;
    let tvCount = 0;
    let movieCount = 0;
    
    for (const file of selectedFilesList) {
      const inferredType = inferFileMediaType(file);
      
      operationMessage = `匹配中 (${batchProgress.current + 1}/${batchProgress.total}): ${file.name}`;
      setFileStatus(file.path, 'processing');
      
      try {
        // 使用解析出的标题进行 TMDB 匹配
        const searchKeyword = file.parsed.title || file.name.replace(/\.[^/.]+$/, '');
        const matchResult = await autoMatch(file.path, searchKeyword, file.parsed.year);
        
        if (!matchResult.result) {
          failCount++;
          setFileStatus(file.path, 'failed');
          batchProgress.current++;
          batchProgress = { ...batchProgress };
          continue;
        }

        const mediaType = matchResult.result.mediaType === 'tv' || matchResult.result.mediaType === 'movie'
          ? matchResult.result.mediaType
          : inferredType;
        const typeLabel = mediaType === 'movie' ? '电影' : '剧集';
        
        operationMessage = `入库中 (${batchProgress.current + 1}/${batchProgress.total}): ${file.name} [${typeLabel}]`;
        
        // 根据候选类型入库
        if (mediaType === 'movie') {
          await processMovie({
            sourcePath: file.path,
            tmdbId: matchResult.result.id,
          });
          movieCount++;
        } else {
          const season = file.parsed.season ?? 1;
          const episode = file.parsed.episode ?? 1;
          await processTV({
            sourcePath: file.path,
            showName: matchResult.result.name || file.parsed.title || file.name,
            tmdbId: matchResult.result.id,
            season,
            episodes: [{ source: file.path, episode }],
          });
          tvCount++;
        }
        
        markFileProcessed(file.path);
        setFileStatus(file.path, 'success');
        successCount++;
      } catch (e) {
        console.error('Batch auto match error:', e);
        failCount++;
        setFileStatus(file.path, 'failed');
      }
      
      batchProgress.current++;
      batchProgress = { ...batchProgress };
    }
    
    const hadSuccess = successCount > 0;
    operationMessage = `完成: ${successCount} 成功 (${tvCount} 剧集, ${movieCount} 电影), ${failCount} 失败`;
    if (hadSuccess) {
      await loadData();
    }
    
    setTimeout(() => {
      isOperating = false;
      operationMessage = '';
      if (hadSuccess) {
        selectedFiles = new Set();
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
    const selectedFilesList = allFiles.filter(f => selectedFiles.has(f.path));
    batchProgress = { current: 0, total: selectedFilesList.length };
    
    let successCount = 0;
    let failCount = 0;
    let tvCount = 0;
    let movieCount = 0;
    
    for (const file of selectedFilesList) {
      operationMessage = `AI 识别中 (${batchProgress.current + 1}/${batchProgress.total}): ${file.relativePath}`;
      setFileStatus(file.path, 'processing');
      
      try {
        // 1. 调用 AI 识别（不传 kind，让 AI 自动判断）
        const recognizeInput = file.relativePath || file.path;
        const result = await recognizePath(recognizeInput);
        
        const tmdbId = result?.tmdb_id ?? (result as any)?.tmdbId ?? (result as any)?.tmdbID ?? null;
        if (!result || !tmdbId) {
          failCount++;
          setFileStatus(file.path, 'failed');
          batchProgress.current++;
          batchProgress = { ...batchProgress };
          continue;
        }
        
        // 使用 AI 判断的媒体类型
        const mediaType = (result.media_type || (result as any)?.mediaType || 'tv') as 'tv' | 'movie';  // 兼容旧版本
        const fallbackName = file.parsed.title || file.name.replace(/\.[^/.]+$/, '');
        const showName = result.tmdb_name || (result as any)?.tmdbName || result.title || fallbackName;
        operationMessage = `入库中 (${batchProgress.current + 1}/${batchProgress.total}): ${file.relativePath} [${mediaType === 'movie' ? '电影' : '剧集'}]`;
        
        // 2. 根据 AI 判断的媒体类型入库
        if (mediaType === 'movie') {
          await processMovie({
            sourcePath: file.path,
            tmdbId,
          });
          movieCount++;
        } else {
          const season = result.season ?? (result as any)?.Season ?? file.parsed.season ?? 1;
          const episode = result.episode ?? (result as any)?.Episode ?? file.parsed.episode ?? 1;
          await processTV({
            sourcePath: file.path,
            showName,
            tmdbId,
            season,
            episodes: [{ source: file.path, episode }],
          });
          tvCount++;
        }

        markFileProcessed(file.path);
        setFileStatus(file.path, 'success');
        successCount++;
      } catch (e) {
        console.error('Batch AI process error:', e);
        failCount++;
        setFileStatus(file.path, 'failed');
      }
      
      batchProgress.current++;
      batchProgress = { ...batchProgress };
    }
    
    const hadSuccess = successCount > 0;
    operationMessage = `完成: ${successCount} 成功 (${tvCount} 剧集, ${movieCount} 电影), ${failCount} 失败`;
    if (hadSuccess) {
      await loadData();
    }
    
    setTimeout(() => {
      isOperating = false;
      operationMessage = '';
      if (hadSuccess) {
        selectedFiles = new Set();
      }
    }, 3000);  // 延长显示时间以便用户看到统计
  }
  
  async function processSingleFile() {
    if (!selectedFile || !selectedCandidate) return;
    
    isOperating = true;
    operationMessage = `正在处理: ${selectedFile.relativePath}`;
    setFileStatus(selectedFile.path, 'processing');
    
    try {
      // 根据选中候选自动决定媒体类型
      const showName = selectedCandidate.name || selectedCandidate.title || '';
      const kind = inferCandidateMediaType(selectedCandidate);
      
      if (kind === 'movie') {
        const result = await processMovie({
          sourcePath: selectedFile.path,
          tmdbId: selectedCandidate.id,
        });
        operationMessage = result.success ? '处理成功' : (result.message || '处理失败');
        if (result.success) {
          markFileProcessed(selectedFile.path);
          setFileStatus(selectedFile.path, 'success');
        } else {
          setFileStatus(selectedFile.path, 'failed');
        }
      } else {
        const result = await processTV({
          sourcePath: selectedFile.path,
          showName,
          tmdbId: selectedCandidate.id,
          // 使用用户编辑的季数和集数
          season: editSeason,
          episodes: [{ source: selectedFile.path, episode: editEpisode }],
        });
        operationMessage = result.success ? '处理成功' : (result.message || '处理失败');
        if (result.success) {
          markFileProcessed(selectedFile.path);
          setFileStatus(selectedFile.path, 'success');
        } else {
          setFileStatus(selectedFile.path, 'failed');
        }
      }
      
      await loadData();
    } catch (e) {
      operationMessage = '处理出错';
      console.error(e);
      setFileStatus(selectedFile.path, 'failed');
    }
    
    setTimeout(() => {
      isOperating = false;
      operationMessage = '';
    }, 2000);
  }
  
  async function showPreview() {
    if (!selectedFile || !selectedCandidate) return;
    
    isLoadingPreview = true;
    showPreviewModal = true;
    
    try {
      // 根据选中候选自动决定媒体类型
      const kind = inferCandidateMediaType(selectedCandidate);
      // 使用用户选择的 TMDB 结果的名称
      const showName = selectedCandidate.name || selectedCandidate.title || '';
      
      const item: PreviewItem = {
        sourcePath: selectedFile.path,
        kind,
        tmdbId: selectedCandidate.id,
        showName,
      };

      if (kind === 'tv') {
        item.season = editSeason;
        item.episodes = [{ source: selectedFile.path, episode: editEpisode }];
      }

      const items = [item];
      
      const plan = await previewPlan(items);
      previewActions = plan.actions;
      previewSummary = plan.impactSummary;
    } catch (e) {
      console.error(e);
      previewActions = [];
      previewSummary = null;
    } finally {
      isLoadingPreview = false;
    }
  }
  
  const filteredFiles = $derived.by(() => (
    files.filter(f => {
      if (filterStatus === 'processed' && !f.isProcessed) return false;
      if (filterStatus === 'unprocessed' && f.isProcessed) return false;
      // 搜索时使用相对路径
      if (searchQuery && !f.relativePath.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
  ));
</script>

<div class="container mx-auto px-4 py-4">
  <div class="flex h-[calc(100vh-64px-32px)] border border-border rounded-lg overflow-hidden">
    <!-- Directory Tree -->
    <div class="w-72 flex flex-col border-r border-border bg-card">
    <div class="border-b border-border p-3">
      <h2 class="text-sm font-medium">目录</h2>
    </div>
    <div class="flex-1 overflow-y-auto">
      {#if loading}
        <div class="p-2 space-y-2">
          {#each Array(8) as _}
            <div class="h-8 rounded-md bg-muted/40 animate-pulse"></div>
          {/each}
        </div>
      {:else if directories.length === 0}
        <div class="p-4 text-center text-muted-foreground text-sm">暂无文件</div>
      {:else}
        <!-- All files option -->
        <button 
          class="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-accent/50 {currentDir === '' ? 'bg-accent/30 border-l-2 border-l-primary' : ''}"
          onclick={() => selectDirectory(null)}
        >
          <svg class="h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg>
          <span class="flex-1">全部</span>
          <span class="text-xs text-muted-foreground">({allFiles.length})</span>
        </button>
        <div class="border-t border-border/50 my-1"></div>
        {#each directories as dir}
          <button 
            class="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-accent/50 {currentDir === dir.path ? 'bg-accent/30 border-l-2 border-l-primary' : ''}"
            onclick={() => selectDirectory(dir)}
          >
            <svg class="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
            <span class="flex-1 truncate">{dir.name}</span>
            <span class="text-xs text-muted-foreground">({dir.files.length})</span>
          </button>
        {/each}
      {/if}
    </div>
  </div>
  
  <!-- Main Content -->
  <div class="flex flex-1 flex-col">
    <!-- File List -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <div class="flex items-center gap-4 border-b border-border bg-card px-4 py-2">
        <h2 class="text-sm font-medium">当前目录: {currentDir === '' ? '全部' : currentDir.split('/').pop()}</h2>
        <div class="ml-auto flex items-center gap-2">
          <span class="text-xs text-muted-foreground">过滤:</span>
          <select class="h-8 rounded-md border border-input bg-background px-2 text-xs" bind:value={filterStatus}>
            <option value="all">全部</option>
            <option value="unprocessed">未处理</option>
            <option value="processed">已处理</option>
          </select>
          <span class="text-xs text-muted-foreground">搜索:</span>
          <input type="text" class="h-8 w-32 rounded-md border border-input bg-background px-2 text-xs" bind:value={searchQuery} />
          <button 
            class="inline-flex items-center justify-center rounded-md text-xs font-medium h-8 px-3 border border-input bg-background hover:bg-accent"
            onclick={loadData}
          >
            刷新
          </button>
        </div>
      </div>
      
      <div class="flex-1 overflow-y-auto custom-scrollbar">
        {#if loading}
          <div class="p-4 space-y-3">
             <div class="h-8 bg-muted/40 rounded animate-pulse w-full"></div>
             {#each Array(10) as _}
               <div class="h-12 bg-muted/30 rounded animate-pulse w-full border-b border-border/50"></div>
             {/each}
          </div>
        {:else}
          <table class="w-full text-sm">
          <thead class="sticky top-0 bg-card border-b border-border">
            <tr>
              <th class="w-10 p-2 text-left">
                <input type="checkbox" class="h-4 w-4 rounded border-input accent-primary" checked={selectedFiles.size === filteredFiles.length && filteredFiles.length > 0} onchange={toggleAll} />
              </th>
              <th class="p-2 text-left font-medium text-muted-foreground text-xs">文件名</th>
              <th class="p-2 text-left font-medium text-muted-foreground text-xs">解析结果</th>
              <th class="w-24 p-2 text-left font-medium text-muted-foreground text-xs">状态</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredFiles as file (file.path)}
              <tr 
                class="border-b border-border hover:bg-accent/50 cursor-pointer {selectedFiles.has(file.path) ? 'bg-accent/30 border-l-2 border-l-primary' : 'border-l-2 border-l-transparent'} transition-all duration-200 active:scale-[0.995]"
                onclick={(e) => toggleFile(file.path, e)}
                ondblclick={() => handleDoubleClick(file)}
                animate:flip={{ duration: 300, easing: quintOut }}
                in:fly={{ y: 20, duration: 300, easing: cubicOut }}
              >
                <td class="p-2 w-10 text-center" onclick={(e) => e.stopPropagation()}>
                  <label class="flex items-center justify-center w-full h-full p-1 -m-1 cursor-pointer">
                    <input 
                      type="checkbox" 
                      class="h-4 w-4 rounded border-input accent-primary transition-all duration-200 cursor-pointer" 
                      checked={selectedFiles.has(file.path)}
                      onclick={(e) => {
                        e.stopPropagation();
                        toggleFileSelection(file.path, e);
                      }}
                    />
                  </label>
                </td>
                <td class="p-2">
                  <div class="flex items-center gap-2">
                    {#if file.kind !== 'unknown'}
                      <svg class="h-4 w-4 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/></svg>
                    {:else}
                      <svg class="h-4 w-4 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                    {/if}
                    <span class="font-mono text-xs truncate max-w-[400px]" title={file.relativePath}>{file.name}</span>
                  </div>
                </td>
                <td class="p-2">
                  {#if file.parsed.title}
                    <div class="flex items-center gap-2 text-xs">
                      <span>{file.parsed.title}</span>
                      {#if file.parsed.season !== undefined}
                        <span class="text-muted-foreground">S{String(file.parsed.season).padStart(2, '0')}</span>
                      {/if}
                      {#if file.parsed.episode !== undefined}
                        <span class="text-muted-foreground">E{String(file.parsed.episode).padStart(2, '0')}</span>
                      {/if}
                      {#if file.parsed.resolution}
                        <span class="rounded bg-secondary px-1 py-0.5 text-[10px]">{file.parsed.resolution}</span>
                      {/if}
                      {#if file.parsed.codec}
                        <span class="rounded bg-secondary px-1 py-0.5 text-[10px]">{file.parsed.codec}</span>
                      {/if}
                    </div>
                  {:else}
                    <span class="text-xs text-muted-foreground">-</span>
                  {/if}
                </td>
                <td class="p-2">
                  {#if fileStatus.get(file.path) === 'processing'}
                    <span class="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] text-primary" in:scale>
                      <svg class="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                      处理中
                    </span>
                  {:else if fileStatus.get(file.path) === 'failed'}
                    <span class="inline-flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-500" in:scale>
                      失败
                    </span>
                  {:else if fileStatus.get(file.path) === 'success' || file.isProcessed}
                    <span class="inline-flex items-center gap-1 rounded border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[10px] text-green-500" in:scale>
                      已处理
                    </span>
                  {:else}
                    <span class="inline-flex items-center gap-1 rounded border border-muted-foreground/20 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                      未处理
                    </span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
      </div>
      
    </div>
    
    <!-- Bottom Panel: Action bar always visible, Details slides -->
    <div class="border-t border-border bg-card">
      <!-- Action Bar (always visible) -->
      <div class="flex items-center gap-2 px-4 py-2 flex-wrap">
        {#if isOperating}
          <div class="flex items-center gap-2 flex-1">
            <svg class="h-4 w-4 animate-spin text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            <span class="text-xs font-medium">{operationMessage}</span>
            {#if batchProgress.total > 0}
              <span class="text-xs text-muted-foreground">({batchProgress.current}/{batchProgress.total})</span>
            {/if}
          </div>
        {:else}
          <span class="text-xs text-muted-foreground">已选 {selectedFiles.size} 个文件</span>
          
          <!-- 自动匹配入库（自动判断电影/剧集） -->
          <button 
            class="inline-flex items-center justify-center rounded-md text-xs font-medium h-8 px-3 border border-border bg-background hover:bg-muted disabled:opacity-50" 
            disabled={selectedFiles.size === 0 || isOperating} 
            onclick={batchAutoMatchAndProcess}
          >
            📂 一键匹配入库
          </button>
          
          <!-- AI 识别入库 -->
          <button 
            class="inline-flex items-center justify-center rounded-md text-xs font-medium h-8 px-3 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50" 
            disabled={selectedFiles.size === 0 || isOperating} 
            onclick={batchAIRecognizeAndProcess}
          >
            🤖 一键 AI 识别入库
          </button>
        {/if}
      </div>
      
    </div>
  </div>
  </div>
</div>

<!-- Details Modal -->
{#if showDetailModal && selectedFile}
  <div 
    class="fixed inset-0 z-50 flex items-center justify-center"
    transition:fade={{ duration: 200 }}
  >
    <button
      type="button"
      class="absolute inset-0 bg-black/50 backdrop-blur-sm"
      aria-label="关闭详情"
      onclick={() => { showDetailModal = false; }}
    ></button>
    <div 
      class="relative bg-card w-full max-w-4xl max-h-[85vh] rounded-xl shadow-2xl overflow-hidden flex flex-col border border-border ring-1 ring-white/10"
      transition:scale={{ duration: 250, start: 0.96, easing: quintOut }}
    >
       <!-- Header -->
       <div class="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
          <h3 class="text-base font-semibold flex items-center gap-2">
            <div class="p-1.5 rounded-md bg-primary/10 text-primary">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            </div>
            <span>文件入库详情</span>
          </h3>
          <button 
            type="button"
            class="h-8 w-8 rounded-full hover:bg-accent flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
            aria-label="关闭详情"
            onclick={() => showDetailModal = false}
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 15-6-6-6 6"/></svg>
          </button>
       </div>

       <!-- Content (Two Columns) -->
       <div class="flex-1 overflow-hidden flex">
          {#if selectedFile}
            <!-- Left Panel: File Info & Actions -->
            <div class="w-[320px] flex flex-col border-r border-border bg-muted/10 p-5 gap-6 overflow-y-auto custom-scrollbar">
              
              <!-- File Info -->
              <div class="space-y-3">
                <div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">原始文件</div>
                <div class="p-3 rounded-lg bg-card border border-border shadow-sm space-y-2">
                  <div class="font-medium text-sm break-all leading-snug" title={selectedFile.name}>
                    {selectedFile.name}
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    {#if selectedFile.kind !== 'unknown'}
                      <span class="px-1.5 py-0.5 rounded-md bg-primary/10 text-[10px] text-primary font-medium border border-primary/20 uppercase">{selectedFile.kind}</span>
                    {/if}
                    {#if selectedFile.parsed.resolution}
                      <span class="px-1.5 py-0.5 rounded-md bg-muted text-[10px] text-muted-foreground border border-border">{selectedFile.parsed.resolution}</span>
                    {/if}
                    {#if selectedFile.parsed.codec}
                      <span class="px-1.5 py-0.5 rounded-md bg-muted text-[10px] text-muted-foreground border border-border">{selectedFile.parsed.codec}</span>
                    {/if}
                    {#if selectedFile.parsed.year}
                      <span class="px-1.5 py-0.5 rounded-md bg-muted text-[10px] text-muted-foreground border border-border">{selectedFile.parsed.year}</span>
                    {/if}
                    {#if selectedFile.parsed.season !== undefined}
                      <span class="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-500 text-[10px] border border-blue-500/20 font-medium">S{String(selectedFile.parsed.season).padStart(2, '0')}</span>
                    {/if}
                    {#if selectedFile.parsed.episode !== undefined}
                      <span class="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-500 text-[10px] border border-blue-500/20 font-medium">E{String(selectedFile.parsed.episode).padStart(2, '0')}</span>
                    {/if}
                  </div>
                </div>
              </div>

              <!-- Target Preview -->
              <div class="flex-1 flex flex-col min-h-0 space-y-2">
                 <div class="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    <span>入库预览</span>
                    {#if selectedCandidate}
                      <span class="text-[10px] text-green-500 flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                        已匹配
                      </span>
                    {/if}
                 </div>
                 <div class="p-3 rounded-lg bg-muted/30 border border-border text-xs font-mono break-all flex-1 relative group">
                    {#if targetPath}
                      <div class="text-foreground leading-relaxed">{targetPath}</div>
                    {:else}
                      <div class="absolute inset-0 flex items-center justify-center text-muted-foreground/50 italic text-center px-4">
                        请在右侧选择匹配结果
                      </div>
                    {/if}
                 </div>
              </div>

              <!-- Primary Actions -->
              <div class="grid grid-cols-2 gap-3 mt-auto pt-2">
                 <button 
                  class="inline-flex items-center justify-center rounded-lg text-xs font-medium h-10 px-3 border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-all active:scale-[0.98]"
                  disabled={!selectedCandidate}
                  onclick={showPreview}
                >
                  预览计划
                </button>
                <button 
                  class="inline-flex items-center justify-center rounded-lg text-xs font-medium h-10 px-3 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-sm"
                  disabled={!selectedCandidate || isOperating}
                  onclick={processSingleFile}
                >
                  {#if isOperating}
                    <svg class="h-3.5 w-3.5 animate-spin mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    处理中...
                  {:else}
                    立即入库
                  {/if}
                </button>
              </div>
            </div>

            <!-- Right Panel: Search & Candidates -->
            <div class="flex-1 flex flex-col min-w-0 bg-background">
              
              <!-- Search Toolbar -->
              <div class="p-4 border-b border-border space-y-3 bg-card/50">
                 <!-- Search Input Group -->
                 <div class="flex gap-2">
                    <div class="relative flex-1 group">
                       <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                         <svg class="h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                       </div>
                       <input 
                         type="text" 
                         class="w-full h-10 rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all" 
                         bind:value={manualSearchQuery}
                         placeholder="搜索电影或剧集..."
                         onkeydown={(e) => e.key === 'Enter' && handleManualSearch()}
                       />
                    </div>
                    
                    <button 
                       class="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all active:scale-[0.98] shadow-sm"
                       onclick={handleManualSearch}
                       disabled={isSearchingTMDB}
                     >
                       {isSearchingTMDB ? '...' : '搜索'}
                    </button>
                 </div>

                 <!-- AI Button & Season Editor Row -->
                 <div class="flex items-center justify-between gap-4">
                    <button 
                      class="h-8 px-3 rounded-md bg-purple-500/10 text-purple-600 border border-purple-500/20 text-xs font-medium hover:bg-purple-500/20 transition-all active:scale-[0.98] flex items-center gap-1.5"
                      disabled={isAIRecognizing}
                      onclick={handleAIRecognize}
                    >
                      {#if isAIRecognizing}
                        <svg class="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                      {:else}
                        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/></svg>
                      {/if}
                      AI 智能识别
                    </button>

                    {#if inferCandidateMediaType(selectedCandidate) === 'tv'}
                      <div class="flex items-center gap-3 text-xs bg-muted/30 px-3 py-1.5 rounded-md border border-border/50">
                        <span class="text-muted-foreground font-medium">手动修正:</span>
                        <div class="flex items-center gap-2">
                          <label class="flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors">
                            <span>第</span>
                            <input 
                              type="number" min="1"
                              class="w-10 h-6 rounded border border-input bg-background text-center focus:ring-1 focus:ring-primary text-xs"
                              bind:value={editSeason}
                              onchange={updateTargetPath}
                            />
                            <span>季</span>
                          </label>
                          <span class="text-border">|</span>
                          <label class="flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors">
                            <span>第</span>
                            <input 
                              type="number" min="1"
                              class="w-10 h-6 rounded border border-input bg-background text-center focus:ring-1 focus:ring-primary text-xs"
                              bind:value={editEpisode}
                            />
                            <span>集</span>
                          </label>
                        </div>
                      </div>
                    {/if}
                 </div>
              </div>

              <!-- AI Result Banner -->
              {#if aiRecognizeResult}
                <div class="px-4 pt-4">
                  <div class="flex items-start gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20 text-xs animate-in slide-in-from-top-2 duration-300">
                    <div class="p-1 rounded-full bg-green-500/10 text-green-600 mt-0.5">
                      <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between mb-1">
                        <span class="font-medium text-foreground">AI 推荐结果</span>
                        <span class="text-[10px] text-green-600/80 font-medium">{(aiRecognizeResult.confidence * 100).toFixed(0)}% 置信度</span>
                      </div>
                      <div class="text-muted-foreground truncate">
                         {aiRecognizeResult.title} 
                         {#if aiRecognizeResult.season}S{String(aiRecognizeResult.season).padStart(2, '0')}{/if}
                         {#if aiRecognizeResult.episode}E{String(aiRecognizeResult.episode).padStart(2, '0')}{/if}
                      </div>
                    </div>
                  </div>
                </div>
              {/if}

              <!-- Candidates Grid -->
              <div class="flex-1 overflow-y-auto custom-scrollbar p-4 min-h-0">
                {#if matchCandidates.length > 0}
                  <div class="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-4 content-start">
                    {#each matchCandidates as candidate}
                      <button 
                        class="group relative flex flex-col gap-2 p-2 rounded-xl border text-left transition-all hover:shadow-md active:scale-[0.98] {selectedCandidate?.id === candidate.id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:border-primary/50 hover:bg-accent/30'}"
                        onclick={() => selectCandidate(candidate)}
                      >
                         <!-- Selection Indicator -->
                         {#if selectedCandidate?.id === candidate.id}
                           <div class="absolute -top-1.5 -right-1.5 z-10 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-sm">
                             <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>
                           </div>
                         {/if}

                         <div class="aspect-2/3 w-full bg-muted rounded-lg overflow-hidden relative shadow-sm">
                            {#if candidate.posterPath}
                              <img src={candidate.posterPath} alt={candidate.name} class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                            {:else}
                              <div class="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2 p-2 text-center">
                                <svg class="h-8 w-8 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                                <span class="text-[10px] opacity-50">无海报</span>
                              </div>
                            {/if}
                            
                            <!-- Type Badge -->
                            <div class="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-[8px] text-white font-medium backdrop-blur-sm shadow-sm">
                              {inferCandidateMediaType(candidate) === 'movie' ? '电影' : '剧集'}
                            </div>

                            <!-- Year Badge -->
                            {#if candidate.releaseDate || candidate.firstAirDate}
                              <div class="absolute bottom-0 left-0 right-0 p-1.5 bg-linear-to-t from-black/80 to-transparent">
                                <div class="text-[10px] text-white font-medium text-center">
                                  {candidate.releaseDate?.slice(0, 4) || candidate.firstAirDate?.slice(0, 4)}
                                </div>
                              </div>
                            {/if}
                         </div>
                         <div class="space-y-1 px-1 pb-1">
                            <div class="font-medium text-xs leading-tight line-clamp-2" title={candidate.name || candidate.title}>
                              {candidate.name || candidate.title}
                            </div>
                            <div class="text-[10px] text-muted-foreground font-mono opacity-70">
                              ID: {candidate.id}
                            </div>
                         </div>
                      </button>
                    {/each}
                  </div>
                {:else if manualSearchQuery}
                  <div class="h-full flex flex-col items-center justify-center text-muted-foreground space-y-3 opacity-60">
                     <div class="p-4 rounded-full bg-muted/50">
                        <svg class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6M8 11h6"/></svg>
                     </div>
                     <span class="text-sm">未找到相关结果</span>
                  </div>
                {:else}
                  <div class="h-full flex flex-col items-center justify-center text-muted-foreground space-y-3 opacity-40">
                     <div class="p-4 rounded-full bg-muted/50">
                       <svg class="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                     </div>
                     <div class="text-center space-y-1">
                       <span class="text-sm block">输入关键词开始搜索</span>
                       <span class="text-xs block">或使用 AI 智能识别</span>
                     </div>
                  </div>
                {/if}
              </div>

            </div>
          {:else}
             <div class="h-full flex items-center justify-center text-muted-foreground text-sm flex-col py-12">
                <p>请选择一个文件</p>
             </div>
          {/if}
       </div>
    </div>
  </div>
{/if}

<!-- Preview Modal -->
{#if showPreviewModal}
  <div 
    class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
    transition:fade={{ duration: 200 }}
  >
    <div 
      class="w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-lg max-h-[80vh] flex flex-col"
      transition:scale={{ duration: 200, start: 0.95, easing: quintOut }}
    >
      <h3 class="text-lg font-semibold mb-4">移动预览</h3>
      {#if isLoadingPreview}
        <div class="flex-1 flex items-center justify-center py-8">
          <svg class="h-6 w-6 animate-spin text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          <span class="ml-2 text-muted-foreground">加载中...</span>
        </div>
      {:else if previewActions.length === 0}
        <div class="flex-1 flex items-center justify-center py-8 text-muted-foreground">
          无法生成预览
        </div>
      {:else}
        <!-- Summary -->
        {#if previewSummary}
          <div class="flex gap-4 mb-4 text-xs">
            <span class="text-muted-foreground">移动: <span class="text-foreground font-medium">{previewSummary.filesMoving}</span></span>
            <span class="text-muted-foreground">创建 NFO: <span class="text-foreground font-medium">{previewSummary.nfoCreating}</span></span>
            {#if previewSummary.nfoOverwriting > 0}
              <span class="text-yellow-500">覆盖 NFO: <span class="font-medium">{previewSummary.nfoOverwriting}</span></span>
            {/if}
          </div>
        {/if}
        
        <div class="flex-1 overflow-y-auto space-y-2 mb-4">
          {#each previewActions as action}
            <div class="p-3 rounded-lg border border-border text-xs">
              <div class="flex items-center gap-2 mb-1">
                {#if action.type === 'move'}
                  <svg class="h-4 w-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  <span class="text-green-500 font-medium">移动</span>
                {:else if action.type === 'create-nfo'}
                  <svg class="h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                  <span class="text-blue-500 font-medium">创建 NFO</span>
                {:else if action.type === 'create-dir'}
                  <svg class="h-4 w-4 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M12 10v6"/><path d="m9 13 3-3 3 3"/></svg>
                  <span class="text-purple-500 font-medium">创建目录</span>
                {:else if action.type === 'download-poster'}
                  <svg class="h-4 w-4 text-cyan-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                  <span class="text-cyan-500 font-medium">下载海报</span>
                {/if}
                {#if action.willOverwrite}
                  <span class="text-[10px] text-yellow-500 border border-yellow-500/50 rounded px-1">覆盖</span>
                {/if}
              </div>
              {#if action.source}
                <div class="font-mono text-muted-foreground truncate">{action.source}</div>
                <div class="flex items-center gap-1 my-1">
                  <svg class="h-3 w-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
                </div>
              {/if}
              <div class="font-mono truncate">{action.destination}</div>
            </div>
          {/each}
        </div>
      {/if}
      <div class="flex justify-end gap-2 pt-4 border-t border-border">
        <button 
          class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 border border-input bg-background hover:bg-accent"
          onclick={() => showPreviewModal = false}
        >
          关闭
        </button>
        <button 
          class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          disabled={previewActions.length === 0 || isLoadingPreview}
          onclick={() => { showPreviewModal = false; processSingleFile(); }}
        >
          确认执行
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Confirm Dialog is now handled globally in +layout.svelte -->

<style lang="postcss">
  @reference "tailwindcss";
</style>
