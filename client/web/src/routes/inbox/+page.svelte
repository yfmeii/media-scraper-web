<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly, scale, slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
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
    type PreviewItem
  } from '$lib/api';
  import { ConfirmDialog } from '$lib/components';
  
  let directories: DirectoryGroup[] = [];
  let files: MediaFile[] = [];
  let allFiles: MediaFile[] = [];
  let selectedFiles = new Set<string>();
  let selectedFile: MediaFile | null = null;
  let loading = true;
  let filterStatus = 'all';
  let searchQuery = '';
  
  let currentDir = '';
  
  // Match candidates for selected file
  let matchCandidates: SearchResult[] = [];
  let selectedCandidate: SearchResult | null = null;
  let isAutoMatched = false;  // Whether current selection is from auto-match
  let matchScore = 0;  // Match confidence score
  let isSearchingTMDB = false;
  let manualSearchQuery = '';
  
  // Target library path
  let targetPath = '';
  
  // 用户可编辑的季数和集数
  let editSeason = 1;
  let editEpisode = 1;
  
  // Batch operation state
  let isOperating = false;
  let operationMessage = '';
  let batchProgress = { current: 0, total: 0 };
  
  // Confirm dialog state
  let showConfirmDialog = false;
  let confirmTitle = '';
  let confirmMessage = '';
  let confirmCallback: (() => void) | null = null;
  
  function showConfirm(title: string, message: string, onConfirm: () => void) {
    confirmTitle = title;
    confirmMessage = message;
    confirmCallback = onConfirm;
    showConfirmDialog = true;
  }
  
  function handleConfirm() {
    showConfirmDialog = false;
    if (confirmCallback) confirmCallback();
    confirmCallback = null;
  }
  
  function handleCancelConfirm() {
    showConfirmDialog = false;
    confirmCallback = null;
  }
  
  // Preview modal
  let showPreviewModal = false;
  let previewActions: Array<{ type: string; source?: string; destination: string; willOverwrite: boolean }> = [];
  let previewSummary: { filesMoving: number; nfoCreating: number; nfoOverwriting: number } | null = null;
  let isLoadingPreview = false;
  
  // AI 识别状态
  let isAIRecognizing = false;
  let aiRecognizeResult: PathRecognizeResult | null = null;
  let fileStatus = new Map<string, 'processing' | 'success' | 'failed'>();

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
      selectedFile.isProcessed = true;
      updated = true;
    }

    if (updated) {
      files = files;
      allFiles = allFiles;
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
      selectedFiles.clear();
      selectedFiles = selectedFiles;
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
    selectedFiles.clear();
    selectedFiles = selectedFiles;
    selectedFile = null;
  }
  
  function toggleFile(path: string, event: MouseEvent) {
    const isRangeSelect = event.shiftKey && selectedFiles.size > 0;
    const isToggleSelect = event.ctrlKey || event.metaKey;
    const nextSelected = new Set(selectedFiles);

    if (isRangeSelect) {
      // Shift-click: select range
      const paths = files.map(f => f.path);
      const lastSelected = Array.from(nextSelected).pop()!;
      const lastIdx = paths.indexOf(lastSelected);
      const currentIdx = paths.indexOf(path);
      const [start, end] = lastIdx < currentIdx ? [lastIdx, currentIdx] : [currentIdx, lastIdx];
      for (let i = start; i <= end; i++) {
        nextSelected.add(paths[i]);
      }
    } else if (isToggleSelect) {
      // Ctrl-click: toggle single
      if (nextSelected.has(path)) nextSelected.delete(path);
      else nextSelected.add(path);
    } else {
      // Normal click: select single
      nextSelected.clear();
      nextSelected.add(path);
    }

    selectedFiles = nextSelected;

    if (isRangeSelect || isToggleSelect) return;

    // Update selected file for detail only on normal click
    const file = files.find(f => f.path === path);
    if (file) {
      selectFileForDetail(file);
    }
  }
  
  async function selectFileForDetail(file: MediaFile) {
    selectedFile = file;
    matchCandidates = [];
    selectedCandidate = null;
    isAutoMatched = false;
    matchScore = 0;
    fileStatus = new Map();

    if (file.kind !== 'unknown') {
      manualSearchType = file.kind;
    }
    
    // 初始化可编辑的季数和集数
    editSeason = file.parsed.season || 1;
    editEpisode = file.parsed.episode || 1;
    
    // 自动匹配使用解析出的标题
    const searchKeyword = file.parsed.title || file.name.replace(/\.[^/.]+$/, '');
    
    // Set target path
    if (file.kind === 'movie') {
      targetPath = `Library/Movies/${searchKeyword}`;
    } else {
      targetPath = `Library/Shows/${searchKeyword}/Season ${String(file.parsed.season || 1).padStart(2, '0')}`;
    }
    
    // Auto match using backend API - 使用解析出的标题进行 TMDB 匹配
    isSearchingTMDB = true;
    try {
      // 默认按剧集搜索，使用 manualSearchType 作为搜索类型
      const kind = manualSearchType;
      // 使用解析出的标题（非 AI 模式）
      const matchResult = await autoMatch(file.path, kind, searchKeyword, file.parsed.year);
      
      // Convert candidates to SearchResult format
      matchCandidates = matchResult.candidates.map(c => ({
        id: c.id,
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
    if (selectedFiles.size === files.length) selectedFiles.clear();
    else files.forEach(f => selectedFiles.add(f.path));
    selectedFiles = selectedFiles;
  }
  
  // 手动选择的搜索类型（tv 或 movie）
  let manualSearchType: 'tv' | 'movie' = 'tv';
  
  async function handleManualSearch() {
    if (!manualSearchQuery.trim() || !selectedFile) return;
    isSearchingTMDB = true;
    try {
      // 使用用户手动选择的搜索类型
      matchCandidates = await searchTMDB(manualSearchType, manualSearchQuery);
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
    if (manualSearchType === 'movie') {
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
      const result = await recognizePath(selectedFile.relativePath, manualSearchType);
      
      if (result) {
        aiRecognizeResult = result;
        
        // AI 判断的媒体类型
        const aiMediaType = result.media_type || 'tv';
        
        // 如果 AI 判断的类型和当前不同，自动切换
        if (aiMediaType !== manualSearchType) {
          manualSearchType = aiMediaType;
          operationMessage = `🤖 AI 判断为${aiMediaType === 'movie' ? '电影' : '剧集'}，已自动切换`;
        }
        
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
          // 使用 AI 判断的媒体类型进行搜索
          const searchResults = await searchTMDB(aiMediaType, result.tmdb_name);
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
    
    showConfirm(
      '一键匹配入库', 
      `确定对 ${selectedFiles.size} 个文件进行自动匹配入库？\n\n根据文件解析结果自动判断类型：\n• 有季/集信息 → 剧集\n• 无季/集信息 → 电影\n\n⚠️ 此操作将移动文件到媒体库`,
      executeBatchAutoMatch
    );
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
      // 根据解析结果自动判断类型：有 season 或 episode 则为剧集，否则为电影
      const hasEpisodeInfo = file.parsed.season !== undefined || file.parsed.episode !== undefined;
      const detectedType: 'tv' | 'movie' = hasEpisodeInfo ? 'tv' : 'movie';
      const typeLabel = detectedType === 'movie' ? '电影' : '剧集';
      
      operationMessage = `匹配中 (${batchProgress.current + 1}/${batchProgress.total}): ${file.name} [${typeLabel}]`;
      setFileStatus(file.path, 'processing');
      
      try {
        // 使用解析出的标题进行 TMDB 匹配
        const searchKeyword = file.parsed.title || file.name.replace(/\.[^/.]+$/, '');
        const matchResult = await autoMatch(file.path, detectedType, searchKeyword, file.parsed.year);
        
        if (!matchResult.matched || !matchResult.result) {
          failCount++;
          setFileStatus(file.path, 'failed');
          batchProgress.current++;
          batchProgress = batchProgress;
          continue;
        }
        
        operationMessage = `入库中 (${batchProgress.current + 1}/${batchProgress.total}): ${file.name} [${typeLabel}]`;
        
        // 根据检测的类型入库
        if (detectedType === 'movie') {
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
      batchProgress = batchProgress;
    }
    
    operationMessage = `完成: ${successCount} 成功 (${tvCount} 剧集, ${movieCount} 电影), ${failCount} 失败`;
    await loadData();
    
    setTimeout(() => {
      isOperating = false;
      operationMessage = '';
      selectedFiles.clear();
      selectedFiles = selectedFiles;
    }, 3000);
  }
  
  // Batch operations - 一键 AI 识别入库
  async function batchAIRecognizeAndProcess() {
    if (selectedFiles.size === 0) return;
    
    showConfirm(
      '一键 AI 识别入库',
      `确定对 ${selectedFiles.size} 个文件进行 AI 识别入库？\n\n🤖 AI 将自动判断每个文件是电影还是剧集\n\n⚠️ 此操作将移动文件到媒体库`,
      executeBatchAIRecognize
    );
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
        const result = await recognizePath(file.relativePath, 'tv');  // 参数被忽略，AI 会自动判断
        
        if (!result || !result.tmdb_id) {
          failCount++;
          setFileStatus(file.path, 'failed');
          batchProgress.current++;
          batchProgress = batchProgress;
          continue;
        }
        
        // 使用 AI 判断的媒体类型
        const mediaType = result.media_type || 'tv';  // 兼容旧版本
        operationMessage = `入库中 (${batchProgress.current + 1}/${batchProgress.total}): ${file.relativePath} [${mediaType === 'movie' ? '电影' : '剧集'}]`;
        
        // 2. 根据 AI 判断的媒体类型入库
        if (mediaType === 'movie') {
          await processMovie({
            sourcePath: file.path,
            tmdbId: result.tmdb_id,
          });
          movieCount++;
        } else {
          const season = result.season ?? file.parsed.season ?? 1;
          const episode = result.episode ?? file.parsed.episode ?? 1;
          await processTV({
            sourcePath: file.path,
            showName: result.tmdb_name || result.title || file.parsed.title || file.name,
            tmdbId: result.tmdb_id,
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
      batchProgress = batchProgress;
    }
    
    operationMessage = `完成: ${successCount} 成功 (${tvCount} 剧集, ${movieCount} 电影), ${failCount} 失败`;
    await loadData();
    
    setTimeout(() => {
      isOperating = false;
      operationMessage = '';
      selectedFiles.clear();
      selectedFiles = selectedFiles;
    }, 3000);  // 延长显示时间以便用户看到统计
  }
  
  async function processSingleFile() {
    if (!selectedFile || !selectedCandidate) return;
    
    isOperating = true;
    operationMessage = `正在处理: ${selectedFile.relativePath}`;
    setFileStatus(selectedFile.path, 'processing');
    
    try {
      // 使用用户选择的类型和名称
      const showName = selectedCandidate.name || selectedCandidate.title || '';
      
        if (manualSearchType === 'movie') {
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
      // 使用用户选择的类型
      const kind: 'tv' | 'movie' = manualSearchType;
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
  
  // 当类型选择器改变时，更新预计路径
  $: if (manualSearchType && selectedCandidate) {
    updateTargetPath();
  }
  
  $: filteredFiles = files.filter(f => {
    if (filterStatus === 'processed' && !f.isProcessed) return false;
    if (filterStatus === 'unprocessed' && f.isProcessed) return false;
    // 搜索时使用相对路径
    if (searchQuery && !f.relativePath.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });
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
        <div class="p-4 text-center text-muted-foreground text-sm">加载中...</div>
      {:else if directories.length === 0}
        <div class="p-4 text-center text-muted-foreground text-sm">暂无文件</div>
      {:else}
        <!-- All files option -->
        <button 
          class="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-accent/50 {currentDir === '' ? 'bg-accent/30 border-l-2 border-l-primary' : ''}"
          on:click={() => selectDirectory(null)}
        >
          <svg class="h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg>
          <span class="flex-1">全部</span>
          <span class="text-xs text-muted-foreground">({allFiles.length})</span>
        </button>
        <div class="border-t border-border/50 my-1"></div>
        {#each directories as dir}
          <button 
            class="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-accent/50 {currentDir === dir.path ? 'bg-accent/30 border-l-2 border-l-primary' : ''}"
            on:click={() => selectDirectory(dir)}
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
            on:click={loadData}
          >
            刷新
          </button>
        </div>
      </div>
      
      <div class="flex-1 overflow-y-auto">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-card border-b border-border">
            <tr>
              <th class="w-10 p-2 text-left">
                <input type="checkbox" class="h-4 w-4 rounded border-input accent-primary" checked={selectedFiles.size === filteredFiles.length && filteredFiles.length > 0} on:change={toggleAll} />
              </th>
              <th class="p-2 text-left font-medium text-muted-foreground text-xs">文件名</th>
              <th class="p-2 text-left font-medium text-muted-foreground text-xs">解析结果</th>
              <th class="w-24 p-2 text-left font-medium text-muted-foreground text-xs">状态</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredFiles as file}
              <tr 
                class="border-b border-border hover:bg-accent/50 cursor-pointer {selectedFiles.has(file.path) ? 'bg-accent/30 border-l-2 border-l-primary' : ''}"
                on:click={(e) => toggleFile(file.path, e)}
                on:dblclick={() => handleDoubleClick(file)}
              >
                <td class="p-2">
                  <input 
                    type="checkbox" 
                    class="h-4 w-4 rounded border-input accent-primary" 
                    checked={selectedFiles.has(file.path)} 
                    on:click|stopPropagation={() => {
                      if (selectedFiles.has(file.path)) {
                        selectedFiles.delete(file.path);
                      } else {
                        selectedFiles.add(file.path);
                      }
                      selectedFiles = selectedFiles;
                    }}
                  />
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
                    <span class="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                      <svg class="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                      处理中
                    </span>
                  {:else if fileStatus.get(file.path) === 'failed'}
                    <span class="inline-flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-500">
                      失败
                    </span>
                  {:else if fileStatus.get(file.path) === 'success' || file.isProcessed}
                    <span class="inline-flex items-center gap-1 rounded border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[10px] text-green-500">
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
            on:click={batchAutoMatchAndProcess}
          >
            📂 一键匹配入库
          </button>
          
          <!-- AI 识别入库 -->
          <button 
            class="inline-flex items-center justify-center rounded-md text-xs font-medium h-8 px-3 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50" 
            disabled={selectedFiles.size === 0 || isOperating} 
            on:click={batchAIRecognizeAndProcess}
          >
            🤖 一键 AI 识别入库
          </button>
        {/if}
      </div>
      
      <!-- Details Panel (slides in/out for single selection only) -->
      {#if selectedFiles.size === 1}
        <div 
          class="border-t border-border/50 h-64 p-4 overflow-y-auto"
          transition:slide={{ duration: 200 }}
        >
          <h3 class="mb-3 text-sm font-medium">选中文件详情 / 匹配结果</h3>
      {#if selectedFile}
        <div class="space-y-4 text-xs">
          <!-- Parsed Info -->
          <div>
            <div class="text-muted-foreground mb-1">解析:</div>
            <div class="flex flex-wrap gap-x-4 gap-y-1 font-mono">
              <span>标题=<span class="text-foreground">{selectedFile.parsed.title || '?'}</span></span>
              <span>年份=<span class="text-foreground">{selectedFile.parsed.year || '?'}</span></span>
              <span>季=<span class="text-foreground">{selectedFile.parsed.season ?? '?'}</span></span>
              <span>集=<span class="text-foreground">{selectedFile.parsed.episode ?? '?'}</span></span>
              <span>分辨率=<span class="text-foreground">{selectedFile.parsed.resolution || '?'}</span></span>
              <span>编码=<span class="text-foreground">{selectedFile.parsed.codec || '?'}</span></span>
            </div>
          </div>
          
          <!-- Auto Match -->
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="text-muted-foreground">自动匹配:</span>
              {#if isSearchingTMDB}
                <svg class="h-4 w-4 animate-spin text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                <span class="text-muted-foreground">搜索中...</span>
              {:else if selectedCandidate}
                <span class="font-medium">{selectedCandidate.name || selectedCandidate.title}</span>
                {#if isAutoMatched}
                  <span class="text-muted-foreground">置信度: {(matchScore * 100).toFixed(0)}%</span>
                  <span class="inline-flex items-center gap-1 text-[10px] border border-green-500/50 text-green-500 rounded px-1">
                    <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>
                    自动匹配
                  </span>
                {/if}
              {:else}
                <span class="text-muted-foreground">未找到匹配</span>
              {/if}
              <button 
                class="ml-auto inline-flex items-center justify-center rounded-md text-[10px] font-medium h-6 px-2 border border-input bg-background hover:bg-accent disabled:opacity-50"
                disabled={isAIRecognizing}
                on:click={handleAIRecognize}
              >
                {#if isAIRecognizing}
                  <svg class="h-3 w-3 animate-spin mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  AI识别中...
                {:else}
                  🤖 AI识别
                {/if}
              </button>
              <button 
                class="inline-flex items-center justify-center rounded-md text-[10px] font-medium h-6 px-2 border border-input bg-background hover:bg-accent"
                on:click={() => manualSearchQuery = selectedFile?.parsed.title || ''}
              >
                手动搜索
              </button>
            </div>
            
            <!-- AI 识别结果 -->
            {#if aiRecognizeResult}
              <div class="rounded-md bg-green-500/10 border border-green-500/20 p-2 text-xs">
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-medium text-green-600">AI 识别结果</span>
                  <span class="px-1.5 py-0.5 rounded text-[10px] {aiRecognizeResult.media_type === 'movie' ? 'bg-purple-500/20 text-purple-600' : 'bg-blue-500/20 text-blue-600'}">
                    {aiRecognizeResult.media_type === 'movie' ? '电影' : '剧集'}
                  </span>
                  <span class="text-muted-foreground">(置信度: {(aiRecognizeResult.confidence * 100).toFixed(0)}%)</span>
                </div>
                <div class="space-y-0.5 text-muted-foreground">
                  <div>标题: <span class="text-foreground">{aiRecognizeResult.title}</span></div>
                  {#if aiRecognizeResult.media_type === 'tv'}
                    {#if aiRecognizeResult.season !== null}
                      <div>季: <span class="text-foreground">{aiRecognizeResult.season}</span></div>
                    {/if}
                    {#if aiRecognizeResult.episode !== null}
                      <div>集: <span class="text-foreground">{aiRecognizeResult.episode}</span></div>
                    {/if}
                  {:else}
                    {#if aiRecognizeResult.year !== null}
                      <div>年份: <span class="text-foreground">{aiRecognizeResult.year}</span></div>
                    {/if}
                  {/if}
                  {#if aiRecognizeResult.tmdb_name}
                    <div>TMDB: <span class="text-foreground">{aiRecognizeResult.tmdb_name}</span> (#{aiRecognizeResult.tmdb_id})</div>
                  {/if}
                  <div class="text-[10px] opacity-70">{aiRecognizeResult.reason}</div>
                </div>
              </div>
            {/if}
            
            <!-- Manual Search -->
            {#if manualSearchQuery !== ''}
              <div class="flex gap-2 mb-2">
                <select 
                  class="h-7 rounded-md border border-input bg-background px-2 text-xs"
                  bind:value={manualSearchType}
                >
                  <option value="tv">剧集</option>
                  <option value="movie">电影</option>
                </select>
                <input 
                  type="text" 
                  class="flex-1 h-7 rounded-md border border-input bg-background px-2 text-xs" 
                  bind:value={manualSearchQuery}
                  placeholder="输入搜索关键词"
                />
                <button 
                  class="inline-flex items-center justify-center rounded-md text-[10px] font-medium h-7 px-3 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  on:click={handleManualSearch}
                  disabled={isSearchingTMDB}
                >
                  {isSearchingTMDB ? '搜索中...' : '搜索'}
                </button>
              </div>
            {/if}
            
            <!-- Candidate List -->
            <div class="text-muted-foreground mb-1">候选列表:</div>
            <div class="space-y-1">
              {#each matchCandidates as candidate}
                <button 
                  class="w-full flex items-center gap-3 p-2 rounded border border-border hover:bg-accent/50 text-left {selectedCandidate?.id === candidate.id ? 'border-primary bg-accent/30' : ''}"
                  on:click={() => selectCandidate(candidate)}
                >
                  {#if candidate.posterPath}
                    <img src={candidate.posterPath} alt="{candidate.name || candidate.title}" class="w-8 h-12 object-cover rounded shrink-0" />
                  {:else}
                    <div class="w-8 h-12 bg-muted rounded flex items-center justify-center shrink-0">
                      <svg class="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>
                    </div>
                  {/if}
                  <span class="px-1.5 py-0.5 rounded text-[10px] shrink-0 {manualSearchType === 'movie' ? 'bg-purple-500/20 text-purple-600' : 'bg-blue-500/20 text-blue-600'}">
                    {manualSearchType === 'movie' ? '电影' : '剧集'}
                  </span>
                  <span class="flex-1 truncate">{candidate.name || candidate.title}{#if manualSearchType === 'movie' && (candidate.releaseDate || candidate.firstAirDate)} ({candidate.releaseDate?.slice(0, 4) || candidate.firstAirDate?.slice(0, 4)}){/if}</span>
                  <span class="text-muted-foreground shrink-0">#{candidate.id}</span>
                </button>
              {/each}
            </div>
          </div>
          
          <!-- Season/Episode Edit (only for TV) -->
          {#if manualSearchType === 'tv'}
          <div>
            <div class="text-muted-foreground mb-1">季/集设置:</div>
            <div class="flex gap-4 items-center">
              <label class="flex items-center gap-2">
                <span>季</span>
                <input 
                  type="number" 
                  min="1"
                  class="w-16 h-7 rounded-md border border-input bg-background px-2 text-xs text-center"
                  bind:value={editSeason}
                  on:change={updateTargetPath}
                />
              </label>
              <label class="flex items-center gap-2">
                <span>集</span>
                <input 
                  type="number" 
                  min="1"
                  class="w-20 h-7 rounded-md border border-input bg-background px-2 text-xs text-center"
                  bind:value={editEpisode}
                />
              </label>
            </div>
          </div>
          {/if}
          
          <!-- Target Path -->
          <div>
            <div class="text-muted-foreground mb-1">入库目标:</div>
            <div class="flex gap-2">
              <input 
                type="text" 
                class="flex-1 h-7 rounded-md border border-input bg-background px-2 text-xs"
                bind:value={targetPath}
                readonly
              />
              <button 
                class="inline-flex items-center justify-center rounded-md text-[10px] font-medium h-7 px-2 border border-input bg-background hover:bg-accent disabled:opacity-50"
                disabled={!selectedCandidate}
                on:click={showPreview}
              >
                预览移动计划
              </button>
            </div>
          </div>
          
          <!-- Action Button -->
          <div class="pt-2">
            <button 
              class="w-full inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              disabled={!selectedCandidate || isOperating}
              on:click={processSingleFile}
            >
              {#if isOperating}
                <svg class="h-4 w-4 animate-spin mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                处理中...
              {:else}
                立即入库
              {/if}
            </button>
          </div>
        </div>
        {:else}
          <div class="text-center py-8 text-muted-foreground text-sm">
            <p>选择一个文件查看详情</p>
            <p class="text-xs mt-1">单击选择，双击打开详情，Shift/Ctrl 多选</p>
          </div>
        {/if}
        </div>
      {/if}
    </div>
  </div>
  </div>
</div>

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
          on:click={() => showPreviewModal = false}
        >
          关闭
        </button>
        <button 
          class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          disabled={previewActions.length === 0 || isLoadingPreview}
          on:click={() => { showPreviewModal = false; processSingleFile(); }}
        >
          确认执行
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Confirm Dialog -->
<ConfirmDialog 
  show={showConfirmDialog}
  title={confirmTitle}
  message={confirmMessage}
  on:confirm={handleConfirm}
  on:cancel={handleCancelConfirm}
/>

<style lang="postcss">
  @reference "tailwindcss";
</style>
