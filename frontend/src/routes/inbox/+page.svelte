<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    fetchInboxByDirectory, 
    searchTMDB, 
    processTV, 
    processMovie, 
    autoMatch, 
    batchScrapeWithDisambiguation,
    previewPlan,
    type MediaFile, 
    type SearchResult, 
    type DirectoryGroup,
    type BatchScrapeItem
  } from '$lib/api';
  
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
  
  // Assets checkboxes
  let generatePoster = true;
  let generateNfo = true;
  let generateBackdrop = false;
  let generateSubtitle = false;
  
  // Target library path
  let targetPath = '';
  
  // Batch operation state
  let isOperating = false;
  let operationMessage = '';
  let batchProgress = { current: 0, total: 0 };
  
  // Disambiguation modal
  let showDisambiguationModal = false;
  let disambiguationMode: 'manual' | 'ai' = 'manual';
  let pendingBatchItems: Array<{ file: MediaFile; candidates: SearchResult[] }> = [];
  let currentMatchIndex = 0;
  
  // Preview modal
  let showPreviewModal = false;
  let previewActions: Array<{ type: string; source?: string; destination: string; willOverwrite: boolean }> = [];
  let previewSummary: { filesMoving: number; nfoCreating: number; nfoOverwriting: number } | null = null;
  let isLoadingPreview = false;
  
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
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }
  
  function selectDirectory(dir: DirectoryGroup) {
    currentDir = dir.path;
    files = dir.files;
    selectedFiles.clear();
    selectedFiles = selectedFiles;
    selectedFile = null;
  }
  
  function toggleFile(path: string, event: MouseEvent) {
    if (event.shiftKey && selectedFiles.size > 0) {
      // Shift-click: select range
      const paths = files.map(f => f.path);
      const lastSelected = Array.from(selectedFiles).pop()!;
      const lastIdx = paths.indexOf(lastSelected);
      const currentIdx = paths.indexOf(path);
      const [start, end] = lastIdx < currentIdx ? [lastIdx, currentIdx] : [currentIdx, lastIdx];
      for (let i = start; i <= end; i++) {
        selectedFiles.add(paths[i]);
      }
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl-click: toggle single
      if (selectedFiles.has(path)) selectedFiles.delete(path);
      else selectedFiles.add(path);
    } else {
      // Normal click: select single
      selectedFiles.clear();
      selectedFiles.add(path);
    }
    selectedFiles = selectedFiles;
    
    // Update selected file
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
    
    if (file.parsed.title) {
      // Set target path
      if (file.kind === 'movie') {
        targetPath = `Library/Movies/${file.parsed.title}`;
      } else {
        targetPath = `Library/Shows/${file.parsed.title}/Season ${String(file.parsed.season || 1).padStart(2, '0')}`;
      }
      
      // Auto match using backend API
      isSearchingTMDB = true;
      try {
        const kind = file.kind === 'movie' ? 'movie' : 'tv';
        const matchResult = await autoMatch(file.path, kind, file.parsed.title, file.parsed.year);
        
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
      } catch (e) {
        console.error(e);
      } finally {
        isSearchingTMDB = false;
      }
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
  
  async function handleManualSearch() {
    if (!manualSearchQuery.trim() || !selectedFile) return;
    isSearchingTMDB = true;
    try {
      const searchType = selectedFile.kind === 'movie' ? 'movie' : 'tv';
      matchCandidates = await searchTMDB(searchType, manualSearchQuery);
      if (matchCandidates.length > 0) {
        selectedCandidate = matchCandidates[0];
      }
    } catch (e) {
      console.error(e);
    } finally {
      isSearchingTMDB = false;
    }
  }
  
  function selectCandidate(candidate: SearchResult) {
    selectedCandidate = candidate;
  }
  
  // Batch operations
  async function batchScrape() {
    if (selectedFiles.size === 0) return;
    // Show disambiguation mode selection
    showDisambiguationModal = true;
  }
  
  async function startBatchWithDisambiguation() {
    showDisambiguationModal = false;
    isOperating = true;
    operationMessage = '正在分析文件...';
    
    const selectedFilesList = allFiles.filter(f => selectedFiles.has(f.path));
    pendingBatchItems = [];
    batchProgress = { current: 0, total: selectedFilesList.length };
    
    // Match all files first
    for (const file of selectedFilesList) {
      operationMessage = `正在匹配 (${batchProgress.current + 1}/${batchProgress.total}): ${file.name}`;
      const kind = file.kind === 'movie' ? 'movie' : 'tv';
      const matchResult = await autoMatch(file.path, kind, file.parsed.title, file.parsed.year);
      
      if (matchResult.matched && matchResult.result) {
        // Auto matched - add to process list
        pendingBatchItems.push({
          file,
          candidates: matchResult.candidates.map(c => ({
            id: c.id,
            name: c.name || '',
            title: c.name,
            posterPath: c.posterPath,
          }))
        });
      } else if (matchResult.candidates.length > 0) {
        pendingBatchItems.push({
          file,
          candidates: matchResult.candidates.map(c => ({
            id: c.id,
            name: c.name || '',
            title: c.name,
            posterPath: c.posterPath,
          }))
        });
      }
      
      batchProgress.current++;
      batchProgress = batchProgress;
    }
    
    if (disambiguationMode === 'ai') {
      await executeBatchWithAI();
    } else {
      // Manual mode - start matching
      currentMatchIndex = 0;
      if (pendingBatchItems.length > 0) {
        // Show first item for manual selection
        const first = pendingBatchItems[0];
        selectedFile = first.file;
        matchCandidates = first.candidates;
        selectedCandidate = matchCandidates[0];
      }
      isOperating = false;
      operationMessage = '请为每个文件选择正确的匹配';
    }
  }
  
  async function executeBatchWithAI() {
    operationMessage = '正在使用 AI 处理...';
    batchProgress = { current: 0, total: pendingBatchItems.length };
    
    const items: BatchScrapeItem[] = pendingBatchItems.map(item => ({
      sourcePath: item.file.path,
      kind: (item.file.kind === 'movie' ? 'movie' : 'tv') as 'tv' | 'movie',
      showName: item.file.parsed.title,
      tmdbId: item.candidates[0]?.id,
      season: item.file.parsed.season,
      episodes: item.file.parsed.episode !== undefined 
        ? [{ source: item.file.path, episode: item.file.parsed.episode }] 
        : undefined,
      candidates: item.candidates.map(c => ({ id: c.id, name: c.name || c.title || '' })),
    }));
    
    const result = await batchScrapeWithDisambiguation(items, 'ai');
    
    operationMessage = result.success 
      ? `完成: ${result.processed} 成功, ${result.failed} 失败` 
      : '批量处理失败';
    
    await loadData();
    
    setTimeout(() => {
      isOperating = false;
      operationMessage = '';
      pendingBatchItems = [];
      selectedFiles.clear();
      selectedFiles = selectedFiles;
    }, 2000);
  }
  
  async function confirmCurrentMatch() {
    if (!selectedCandidate || currentMatchIndex >= pendingBatchItems.length) return;
    
    const item = pendingBatchItems[currentMatchIndex];
    isOperating = true;
    operationMessage = `正在处理 (${currentMatchIndex + 1}/${pendingBatchItems.length}): ${item.file.name}`;
    
    try {
      if (item.file.kind === 'movie') {
        await processMovie({
          sourcePath: item.file.path,
          tmdbId: selectedCandidate.id,
        });
      } else {
        await processTV({
          sourcePath: item.file.path,
          showName: item.file.parsed.title || '',
          tmdbId: selectedCandidate.id,
          season: item.file.parsed.season || 1,
          episodes: [{ source: item.file.path, episode: item.file.parsed.episode || 1 }],
        });
      }
    } catch (e) {
      console.error(e);
    }
    
    currentMatchIndex++;
    
    if (currentMatchIndex < pendingBatchItems.length) {
      const next = pendingBatchItems[currentMatchIndex];
      selectedFile = next.file;
      matchCandidates = next.candidates;
      selectedCandidate = matchCandidates[0];
      isOperating = false;
    } else {
      operationMessage = '批量处理完成';
      await loadData();
      setTimeout(() => {
        isOperating = false;
        operationMessage = '';
        pendingBatchItems = [];
        selectedFiles.clear();
        selectedFiles = selectedFiles;
      }, 2000);
    }
  }
  
  async function processSingleFile() {
    if (!selectedFile || !selectedCandidate) return;
    
    isOperating = true;
    operationMessage = `正在处理: ${selectedFile.name}`;
    
    try {
      if (selectedFile.kind === 'movie') {
        const result = await processMovie({
          sourcePath: selectedFile.path,
          tmdbId: selectedCandidate.id,
        });
        operationMessage = result.success ? '处理成功' : (result.message || '处理失败');
      } else {
        const result = await processTV({
          sourcePath: selectedFile.path,
          showName: selectedFile.parsed.title || '',
          tmdbId: selectedCandidate.id,
          season: selectedFile.parsed.season || 1,
          episodes: [{ source: selectedFile.path, episode: selectedFile.parsed.episode || 1 }],
        });
        operationMessage = result.success ? '处理成功' : (result.message || '处理失败');
      }
      
      await loadData();
    } catch (e) {
      operationMessage = '处理出错';
      console.error(e);
    }
    
    setTimeout(() => {
      isOperating = false;
      operationMessage = '';
    }, 2000);
  }
  
  function skipCurrentMatch() {
    currentMatchIndex++;
    if (currentMatchIndex < pendingBatchItems.length) {
      const next = pendingBatchItems[currentMatchIndex];
      selectedFile = next.file;
      matchCandidates = next.candidates;
      selectedCandidate = matchCandidates[0];
    } else {
      operationMessage = '批量处理完成';
      loadData();
      setTimeout(() => {
        operationMessage = '';
        pendingBatchItems = [];
        selectedFiles.clear();
        selectedFiles = selectedFiles;
      }, 2000);
    }
  }
  
  async function showPreview() {
    if (!selectedFile || !selectedCandidate) return;
    
    isLoadingPreview = true;
    showPreviewModal = true;
    
    try {
      const kind: 'tv' | 'movie' = selectedFile.kind === 'movie' ? 'movie' : 'tv';
      const items = [{
        sourcePath: selectedFile.path,
        kind,
        tmdbId: selectedCandidate.id,
        showName: selectedFile.parsed.title,
        season: selectedFile.parsed.season,
        // Backend expects episodes as array of objects with source path
        episodes: selectedFile.parsed.episode !== undefined 
          ? [{ source: selectedFile.path, episode: selectedFile.parsed.episode }] 
          : undefined,
      }];
      
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
  
  $: filteredFiles = files.filter(f => {
    if (filterStatus === 'processed' && !f.isProcessed) return false;
    if (filterStatus === 'unprocessed' && f.isProcessed) return false;
    if (searchQuery && !f.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });
</script>

<div class="flex h-[calc(100vh-64px)]">
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
    <div class="flex gap-2 border-t border-border p-3">
      <button 
        class="flex-1 inline-flex items-center justify-center rounded-md text-xs font-medium h-8 px-3 border border-input bg-background hover:bg-accent"
        on:click={loadData}
      >
        <svg class="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
        刷新
      </button>
    </div>
  </div>
  
  <!-- Main Content -->
  <div class="flex flex-1 flex-col">
    <!-- File List -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <div class="flex items-center gap-4 border-b border-border bg-card px-4 py-2">
        <h2 class="text-sm font-medium">当前目录: {currentDir.split('/').pop()}</h2>
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
                      <svg class="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/></svg>
                    {:else}
                      <svg class="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                    {/if}
                    <span class="font-mono text-xs truncate max-w-[300px]">{file.name}</span>
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
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      
      <!-- Batch Actions -->
      <div class="flex items-center gap-2 border-t border-border bg-card px-4 py-2 flex-wrap">
        {#if isOperating}
          <div class="flex items-center gap-2 flex-1">
            <svg class="h-4 w-4 animate-spin text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            <span class="text-xs font-medium">{operationMessage}</span>
            {#if batchProgress.total > 0}
              <span class="text-xs text-muted-foreground">({batchProgress.current}/{batchProgress.total})</span>
            {/if}
          </div>
        {:else if pendingBatchItems.length > 0}
          <div class="flex items-center gap-2 flex-1">
            <span class="text-xs text-muted-foreground">手动匹配 {currentMatchIndex + 1}/{pendingBatchItems.length}:</span>
            <button 
              class="inline-flex items-center justify-center rounded-md text-xs font-medium h-8 px-3 bg-primary text-primary-foreground hover:opacity-90"
              on:click={confirmCurrentMatch}
            >
              确认并处理
            </button>
            <button 
              class="inline-flex items-center justify-center rounded-md text-xs font-medium h-8 px-3 border border-input bg-background hover:bg-accent"
              on:click={skipCurrentMatch}
            >
              跳过
            </button>
          </div>
        {:else}
          <span class="text-xs text-muted-foreground">已选 {selectedFiles.size} 个文件:</span>
          <button 
            class="inline-flex items-center justify-center rounded-md text-xs font-medium h-8 px-3 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50" 
            disabled={selectedFiles.size === 0 || isOperating} 
            on:click={batchScrape}
          >
            一键刮削
          </button>
        {/if}
      </div>
    </div>
    
    <!-- File Details Panel -->
    <div class="h-72 border-t border-border bg-card p-4 overflow-y-auto">
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
                class="ml-auto inline-flex items-center justify-center rounded-md text-[10px] font-medium h-6 px-2 border border-input bg-background hover:bg-accent"
                on:click={() => manualSearchQuery = selectedFile?.parsed.title || ''}
              >
                手动搜索
              </button>
            </div>
            
            <!-- Manual Search -->
            {#if manualSearchQuery !== ''}
              <div class="flex gap-2 mb-2">
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
              {#each matchCandidates as candidate, i}
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
                  <span class="text-muted-foreground">({i + 1})</span>
                  <span class="flex-1 truncate">{candidate.name || candidate.title} ({candidate.firstAirDate?.slice(0, 4) || candidate.releaseDate?.slice(0, 4)})</span>
                  <span class="text-muted-foreground shrink-0">#{candidate.id}</span>
                  <span class="inline-flex items-center justify-center rounded-md text-[10px] font-medium h-6 px-2 shrink-0 {selectedCandidate?.id === candidate.id ? 'bg-primary text-primary-foreground' : 'border border-input bg-background'}">
                    {selectedCandidate?.id === candidate.id ? '已选' : '选用'}
                  </span>
                </button>
              {/each}
            </div>
          </div>
          
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
  </div>
</div>

<!-- Disambiguation Mode Modal -->
{#if showDisambiguationModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
    <div class="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
      <h3 class="text-lg font-semibold mb-4">选择消歧方式</h3>
      <p class="text-sm text-muted-foreground mb-4">
        已选择 {selectedFiles.size} 个文件，请选择如何处理多个匹配结果的情况：
      </p>
      <div class="space-y-3 mb-6">
        <label class="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 cursor-pointer {disambiguationMode === 'manual' ? 'border-primary bg-accent/30' : ''}">
          <input type="radio" bind:group={disambiguationMode} value="manual" class="mt-1 accent-primary" />
          <div>
            <div class="font-medium">手动匹配</div>
            <div class="text-sm text-muted-foreground">逐个确认每个文件的 TMDB 匹配结果</div>
          </div>
        </label>
        <label class="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 cursor-pointer {disambiguationMode === 'ai' ? 'border-primary bg-accent/30' : ''}">
          <input type="radio" bind:group={disambiguationMode} value="ai" class="mt-1 accent-primary" />
          <div>
            <div class="font-medium">AI 自动</div>
            <div class="text-sm text-muted-foreground">使用 AI 自动选择最佳匹配</div>
          </div>
        </label>
      </div>
      <div class="flex justify-end gap-2">
        <button 
          class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 border border-input bg-background hover:bg-accent"
          on:click={() => showDisambiguationModal = false}
        >
          取消
        </button>
        <button 
          class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 bg-primary text-primary-foreground hover:opacity-90"
          on:click={startBatchWithDisambiguation}
        >
          开始处理
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Preview Modal -->
{#if showPreviewModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
    <div class="w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-lg max-h-[80vh] flex flex-col">
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

<style lang="postcss">
  @reference "tailwindcss";
</style>
