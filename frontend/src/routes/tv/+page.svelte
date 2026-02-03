<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fetchTVShows, searchTMDB, supplementShow, refreshMetadata, fixAssets, autoMatch, batchScrapeWithDisambiguation, subscribeToProgress, type ShowInfo, type SearchResult, type BatchScrapeItem, type ProgressEvent } from '$lib/api';
  
  let shows: ShowInfo[] = [];
  let loading = true;
  let selectedShows = new Set<string>();
  
  // Filters
  let statusFilter = 'all';
  let completenessFilter = 'all';
  let searchQuery = '';
  let activeTab = 'all';
  
  // Detail drawer state
  let showDetailDrawer = false;
  let selectedShowForDetail: ShowInfo | null = null;
  
  // TMDB search modal state
  let showSearchModal = false;
  let tmdbSearchQuery = '';
  let tmdbSearchResults: SearchResult[] = [];
  let isSearchingTMDB = false;
  
  // Disambiguation modal state
  let showDisambiguationModal = false;
  let disambiguationMode: 'manual' | 'ai' = 'manual';
  let pendingBatchItems: { show: ShowInfo; match?: any }[] = [];
  let currentMatchIndex = 0;
  
  // Operation state
  let isOperating = false;
  let operationMessage = '';
  
  // Progress state
  let progressMap = new Map<string, number>(); // path -> percent
  let processingPaths = new Set<string>(); // Currently processing paths
  let unsubscribeProgress: (() => void) | null = null;
  let batchProgress = { current: 0, total: 0 }; // Overall batch progress
  
  function handleProgress(event: ProgressEvent) {
    // Check if the item is in our processing list
    if (event.item && processingPaths.has(event.item)) {
      progressMap.set(event.item, event.percent);
      progressMap = progressMap; // Trigger reactivity
      operationMessage = event.message || '';
    }
    
    if (event.type === 'complete' && processingPaths.size > 0) {
      // Clear progress after completion
      setTimeout(() => {
        progressMap.clear();
        progressMap = progressMap;
        processingPaths.clear();
      }, 2000);
    }
  }
  
  onMount(async () => {
    try {
      shows = await fetchTVShows();
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
    
    // Subscribe to SSE progress
    unsubscribeProgress = subscribeToProgress(handleProgress);
  });
  
  onDestroy(() => {
    if (unsubscribeProgress) unsubscribeProgress();
  });
  
  function toggleShow(path: string, event: MouseEvent) {
    if (event.shiftKey && selectedShows.size > 0) {
      // Shift-click: select range
      const paths = filteredShows.map(s => s.path);
      const lastSelected = Array.from(selectedShows).pop()!;
      const lastIdx = paths.indexOf(lastSelected);
      const currentIdx = paths.indexOf(path);
      const [start, end] = lastIdx < currentIdx ? [lastIdx, currentIdx] : [currentIdx, lastIdx];
      for (let i = start; i <= end; i++) {
        selectedShows.add(paths[i]);
      }
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl-click: toggle single
      if (selectedShows.has(path)) selectedShows.delete(path);
      else selectedShows.add(path);
    } else {
      // Normal click: select single
      selectedShows.clear();
      selectedShows.add(path);
    }
    selectedShows = selectedShows;
  }
  
  function toggleAll() {
    if (selectedShows.size === filteredShows.length) {
      selectedShows.clear();
    } else {
      filteredShows.forEach(s => selectedShows.add(s.path));
    }
    selectedShows = selectedShows;
  }
  
  function handleRowDoubleClick(show: ShowInfo) {
    selectedShowForDetail = show;
    showDetailDrawer = true;
  }
  
  function closeDetailDrawer() {
    showDetailDrawer = false;
    selectedShowForDetail = null;
  }
  
  async function handleTMDBSearch() {
    if (!tmdbSearchQuery.trim()) return;
    isSearchingTMDB = true;
    try {
      tmdbSearchResults = await searchTMDB('tv', tmdbSearchQuery);
    } catch (e) {
      console.error(e);
    } finally {
      isSearchingTMDB = false;
    }
  }
  
  function openSearchModal(show: ShowInfo) {
    selectedShowForDetail = show;
    tmdbSearchQuery = show.name;
    showSearchModal = true;
    handleTMDBSearch();
  }
  
  function closeSearchModal() {
    showSearchModal = false;
    tmdbSearchResults = [];
  }
  
  async function selectTMDBResult(result: SearchResult) {
    if (!selectedShowForDetail || isOperating) return;
    
    // Check if we're in batch manual matching mode
    if (pendingBatchItems.length > 0 && currentMatchIndex < pendingBatchItems.length) {
      // Save the match and continue to next item
      pendingBatchItems[currentMatchIndex].match = { id: result.id, name: result.name || result.title };
      closeSearchModal();
      currentMatchIndex++;
      await matchNextItem();
      return;
    }
    
    // Normal single-item matching
    const showPath = selectedShowForDetail.path;
    isOperating = true;
    operationMessage = `正在匹配 ${result.name || result.title}...`;
    
    try {
      // Call refresh metadata to apply the TMDB match and create NFO/poster
      const res = await refreshMetadata('tv', showPath, result.id);
      
      if (res.success) {
        operationMessage = '匹配成功，已创建元数据，正在刷新列表...';
        // Refresh shows list - force re-fetch
        loading = true;
        shows = [];
        const newShows = await fetchTVShows();
        shows = [...newShows]; // Create new array reference
        loading = false;
        operationMessage = '匹配成功';
      } else {
        operationMessage = `匹配失败: ${res.message}`;
      }
    } catch (e) {
      operationMessage = `错误: ${e}`;
    }
    
    isOperating = false;
    closeSearchModal();
    
    setTimeout(() => { operationMessage = ''; }, 3000);
  }
  
  function getStatusBadge(status: string | undefined) {
    switch (status) {
      case 'scraped': return { label: '已刮削', color: 'text-green-500', border: 'border-green-500/50' };
      case 'unscraped': return { label: '未刮削', color: 'text-red-500', border: 'border-red-500/50' };
      case 'supplement': return { label: '待处理', color: 'text-yellow-500', border: 'border-yellow-500/50' };
      default: return { label: '未知', color: 'text-muted-foreground', border: 'border-border' };
    }
  }
  
  // Batch operations
  function batchScrape() {
    if (isOperating) return;
    
    const paths = Array.from(selectedShows);
    const selectedShowsList = paths.map(p => shows.find(s => s.path === p)).filter((s): s is ShowInfo => s !== undefined);
    
    // Check if any shows need TMDB matching
    const needsMatching = selectedShowsList.some(s => s.groupStatus === 'unscraped' || !s.tmdbId);
    
    if (needsMatching) {
      // Show disambiguation mode selection
      pendingBatchItems = selectedShowsList.map(s => ({ show: s }));
      showDisambiguationModal = true;
    } else {
      // All shows already have TMDB ID, just supplement
      executeBatchSupplement();
    }
  }
  
  async function executeBatchSupplement() {
    isOperating = true;
    operationMessage = '正在补刮...';
    
    const paths = Array.from(selectedShows);
    let successCount = 0;
    let failCount = 0;
    
    // Initialize progress
    batchProgress = { current: 0, total: paths.length };
    for (const path of paths) {
      progressMap.set(path, 0);
    }
    progressMap = progressMap;
    
    for (const path of paths) {
      const show = shows.find(s => s.path === path);
      if (!show) continue;
      
      operationMessage = `正在补刮 (${batchProgress.current + 1}/${batchProgress.total}): ${show.name}`;
      const result = await supplementShow(show.path);
      if (result.success) successCount++;
      else failCount++;
      
      batchProgress.current++;
      batchProgress = batchProgress;
      
      // Refresh data to show updated state
      const updatedShows = await fetchTVShows();
      shows = [...updatedShows];
    }
    
    operationMessage = '';
    isOperating = false;
    selectedShows.clear();
    selectedShows = selectedShows;
    
    setTimeout(() => { 
      batchProgress = { current: 0, total: 0 };
    }, 2000);
  }
  
  async function startBatchWithDisambiguation() {
    showDisambiguationModal = false;
    
    if (disambiguationMode === 'ai') {
      // Use AI to auto-match and scrape
      await executeBatchWithAI();
    } else {
      // Manual mode: start matching process
      currentMatchIndex = 0;
      await matchNextItem();
    }
  }
  
  async function executeBatchWithAI() {
    isOperating = true;
    operationMessage = '正在使用 AI 自动匹配并刮削...';
    
    // Prepare items for batch API
    const items: BatchScrapeItem[] = [];
    
    for (const { show } of pendingBatchItems) {
      if (show.tmdbId) {
        // Already matched, use existing ID
        items.push({
          sourcePath: show.path,
          kind: 'tv',
          showName: show.name,
          tmdbId: show.tmdbId,
        });
      } else {
        // Need to match first
        const match = await autoMatch(show.path, 'tv', show.name);
        if (match.matched && match.result) {
          items.push({
            sourcePath: show.path,
            kind: 'tv',
            showName: show.name,
            tmdbId: match.result.id,
          });
        } else if (match.candidates.length > 0) {
          // Use AI to pick from candidates
          items.push({
            sourcePath: show.path,
            kind: 'tv',
            showName: show.name,
            candidates: match.candidates.map(c => ({ id: c.id, name: c.name })),
          });
        }
      }
    }
    
    if (items.length > 0) {
      // Initialize progress for selected items
      for (const item of items) {
        progressMap.set(item.sourcePath, 0);
        processingPaths.add(item.sourcePath);
      }
      progressMap = progressMap;
      processingPaths = processingPaths;
      
      const result = await batchScrapeWithDisambiguation(items, 'ai');
      operationMessage = `完成: ${result.processed} 成功, ${result.failed} 失败`;
    } else {
      operationMessage = '没有可处理的项目';
    }
    
    isOperating = false;
    
    // Refresh shows
    const newShows = await fetchTVShows();
    shows = [...newShows];
    selectedShows.clear();
    selectedShows = selectedShows;
    pendingBatchItems = [];
    
    setTimeout(() => { operationMessage = ''; }, 3000);
  }
  
  async function matchNextItem() {
    if (currentMatchIndex >= pendingBatchItems.length) {
      // All items matched, execute scrape
      await executeMatchedBatch();
      return;
    }
    
    const item = pendingBatchItems[currentMatchIndex];
    
    if (item.show.tmdbId) {
      // Already has TMDB ID, skip matching
      item.match = { id: item.show.tmdbId };
      currentMatchIndex++;
      await matchNextItem();
      return;
    }
    
    // Open search modal for this show
    selectedShowForDetail = item.show;
    tmdbSearchQuery = item.show.name;
    showSearchModal = true;
    await handleTMDBSearch();
  }
  
  async function executeMatchedBatch() {
    isOperating = true;
    operationMessage = '正在刮削...';
    
    let successCount = 0;
    let failCount = 0;
    
    // Initialize progress
    batchProgress = { current: 0, total: pendingBatchItems.length };
    for (const { show } of pendingBatchItems) {
      progressMap.set(show.path, 0);
    }
    progressMap = progressMap;
    
    for (const { show, match } of pendingBatchItems) {
      if (!match?.id) {
        failCount++;
        batchProgress.current++;
        batchProgress = batchProgress;
        progressMap.set(show.path, 100);
        progressMap = progressMap;
        continue;
      }
      
      operationMessage = `正在刮削 (${batchProgress.current + 1}/${batchProgress.total}): ${show.name}`;
      const result = await refreshMetadata('tv', show.path, match.id);
      if (result.success) successCount++;
      else failCount++;
      
      batchProgress.current++;
      batchProgress = batchProgress;
      
      // Refresh data to show updated state
      const updatedShows = await fetchTVShows();
      shows = [...updatedShows];
    }
    
    operationMessage = '';
    isOperating = false;
    selectedShows.clear();
    selectedShows = selectedShows;
    pendingBatchItems = [];
    
    setTimeout(() => { 
      batchProgress = { current: 0, total: 0 };
    }, 2000);
  }
  
  async function batchRefresh() {
    if (isOperating) return;
    isOperating = true;
    operationMessage = '正在刷新元数据...';
    
    const paths = Array.from(selectedShows);
    let successCount = 0;
    let failCount = 0;
    
    // Initialize progress
    batchProgress = { current: 0, total: paths.length };
    for (const path of paths) {
      progressMap.set(path, 0);
    }
    progressMap = progressMap;
    
    for (const path of paths) {
      const show = shows.find(s => s.path === path);
      if (!show || !show.tmdbId) {
        failCount++;
        batchProgress.current++;
        batchProgress = batchProgress;
        progressMap.set(path, 100);
        progressMap = progressMap;
        continue;
      }
      
      operationMessage = `正在刷新 (${batchProgress.current + 1}/${batchProgress.total}): ${show.name}`;
      const result = await refreshMetadata('tv', show.path, show.tmdbId);
      if (result.success) successCount++;
      else failCount++;
      
      batchProgress.current++;
      batchProgress = batchProgress;
      
      // Refresh data to show updated state
      const updatedShows = await fetchTVShows();
      shows = [...updatedShows];
    }
    
    operationMessage = '';
    isOperating = false;
    selectedShows.clear();
    selectedShows = selectedShows;
    
    setTimeout(() => { 
      batchProgress = { current: 0, total: 0 };
    }, 2000);
  }
  
  function batchRematch() {
    // For batch rematch, show modal with first selected show
    const firstPath = Array.from(selectedShows)[0];
    const show = shows.find(s => s.path === firstPath);
    if (show) {
      openSearchModal(show);
    }
  }
  
  // Single show operations
  async function handleScrapeShow(show: ShowInfo) {
    if (isOperating) return;
    
    // If show is not scraped yet, need to match TMDB first
    if (show.groupStatus === 'unscraped' || !show.tmdbId) {
      operationMessage = '未刮削剧集需要先匹配 TMDB，请点击"重新匹配"';
      setTimeout(() => { operationMessage = ''; }, 5000);
      return;
    }
    
    isOperating = true;
    operationMessage = '正在刮削...';
    
    try {
      const result = await supplementShow(show.path);
      operationMessage = result.success ? `刮削成功` : `失败: ${result.message}`;
      
      // Refresh shows
      const newShows = await fetchTVShows();
      shows = newShows;
    } catch (e) {
      operationMessage = `错误: ${e}`;
    }
    
    isOperating = false;
    setTimeout(() => { operationMessage = ''; }, 3000);
  }
  
  async function handleRefreshShow(show: ShowInfo) {
    if (isOperating || !show.tmdbId) return;
    isOperating = true;
    operationMessage = '正在刷新元数据...';
    
    const result = await refreshMetadata('tv', show.path, show.tmdbId);
    operationMessage = result.success ? '刷新成功' : `失败: ${result.message}`;
    isOperating = false;
    
    // Refresh shows
    shows = await fetchTVShows();
    
    setTimeout(() => { operationMessage = ''; }, 3000);
  }
  
  async function handleFixAssets(show: ShowInfo) {
    if (isOperating || !show.tmdbId) return;
    isOperating = true;
    operationMessage = '正在修复资产...';
    
    const result = await fixAssets('tv', show.path, show.tmdbId);
    operationMessage = result.success ? '修复成功' : `失败: ${result.message}`;
    isOperating = false;
    
    // Refresh shows
    shows = await fetchTVShows();
    
    setTimeout(() => { operationMessage = ''; }, 3000);
  }
  
  // Filtered shows based on current filters
  $: filteredShows = shows.filter(show => {
    // Tab filter
    if (activeTab === 'scraped' && show.groupStatus !== 'scraped') return false;
    if (activeTab === 'unscraped' && show.groupStatus !== 'unscraped') return false;
    if (activeTab === 'pending' && show.groupStatus !== 'supplement') return false;
    
    // Status filter
    if (statusFilter !== 'all' && show.groupStatus !== statusFilter) return false;
    
    // Completeness filter
    if (completenessFilter === 'complete' && (!show.assets?.hasPoster || !show.assets?.hasNfo)) return false;
    if (completenessFilter === 'incomplete' && show.assets?.hasPoster && show.assets?.hasNfo) return false;
    
    // Search query
    if (searchQuery && !show.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    
    return true;
  });
  
  $: scrapedCount = shows.filter(s => s.groupStatus === 'scraped').length;
  $: unscrapedCount = shows.filter(s => s.groupStatus === 'unscraped').length;
  $: supplementCount = shows.filter(s => s.groupStatus === 'supplement').length;
</script>

<main class="container mx-auto px-4 py-8">
  <!-- Toolbar -->
  <div class="mb-6 space-y-4">
    <div class="flex items-center justify-between flex-wrap gap-4">
      <div class="flex items-center gap-4 flex-wrap">
        <div>
          <span class="mr-2 text-sm text-muted-foreground">视图:</span>
          <span class="text-sm font-medium">表格</span>
        </div>
        <select class="h-9 w-32 rounded-md border border-input bg-background px-3 text-sm" bind:value={statusFilter}>
          <option value="all">全部状态</option>
          <option value="scraped">已刮削</option>
          <option value="unscraped">未刮削</option>
          <option value="supplement">待处理</option>
        </select>
        <select class="h-9 w-32 rounded-md border border-input bg-background px-3 text-sm" bind:value={completenessFilter}>
          <option value="all">全部</option>
          <option value="complete">完整</option>
          <option value="incomplete">不完整</option>
        </select>
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" placeholder="搜索剧集..." class="h-9 w-48 rounded-md border border-input bg-background pl-9 pr-3 text-sm" bind:value={searchQuery} />
        </div>
      </div>
    </div>
    
    <div class="flex items-center justify-between flex-wrap gap-4">
      <!-- Tabs -->
      <div class="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
        <button class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all {activeTab === 'all' ? 'bg-background text-foreground shadow-sm' : ''}" on:click={() => activeTab = 'all'}>全部 ({shows.length})</button>
        <button class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all {activeTab === 'scraped' ? 'bg-background text-foreground shadow-sm' : ''}" on:click={() => activeTab = 'scraped'}>已刮削 ({scrapedCount})</button>
        <button class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all {activeTab === 'unscraped' ? 'bg-background text-foreground shadow-sm' : ''}" on:click={() => activeTab = 'unscraped'}>未刮削 ({unscrapedCount})</button>
        <button class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all {activeTab === 'pending' ? 'bg-background text-foreground shadow-sm' : ''}" on:click={() => activeTab = 'pending'}>待处理 ({supplementCount})</button>
      </div>
      
      <!-- Action Buttons -->
      <div class="flex gap-2 items-center">
        {#if operationMessage && selectedShows.size === 0}
          <span class="text-sm text-muted-foreground">{operationMessage}</span>
        {/if}
      </div>
    </div>
  </div>
  
  <!-- Table -->
  <div class="rounded-lg border border-border bg-card overflow-hidden">
    {#if loading}
      <div class="p-8 text-center text-muted-foreground">加载中...</div>
    {:else if filteredShows.length === 0}
      <div class="p-8 text-center text-muted-foreground">没有找到符合条件的剧集</div>
    {:else}
      <table class="w-full">
        <thead class="bg-card">
          <tr class="border-b border-border text-xs text-muted-foreground">
            <th class="w-12 p-3 text-left"><input type="checkbox" class="h-4 w-4 rounded border-input accent-primary" checked={selectedShows.size === filteredShows.length && filteredShows.length > 0} on:change={toggleAll} /></th>
            <th class="w-16 p-3 text-left font-medium">海报</th>
            <th class="p-3 text-left font-medium">剧集名称</th>
            <th class="w-24 p-3 text-left font-medium">季数</th>
            <th class="w-24 p-3 text-left font-medium">集数</th>
            <th class="w-32 p-3 text-left font-medium">状态</th>
            <th class="w-40 p-3 text-left font-medium">完整性</th>
            <th class="w-40 p-3 text-left font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredShows as show}
            {@const badge = getStatusBadge(show.groupStatus)}
            <tr 
              class="border-b border-border hover:bg-accent/50 cursor-pointer {selectedShows.has(show.path) ? 'bg-accent/30 border-l-2 border-l-primary' : ''}"
              on:click={(e) => toggleShow(show.path, e)}
              on:dblclick={() => handleRowDoubleClick(show)}
            >
              <td class="p-3">
                <input 
                  type="checkbox" 
                  class="h-4 w-4 rounded border-input accent-primary" 
                  checked={selectedShows.has(show.path)} 
                  on:click|stopPropagation={() => {
                    if (selectedShows.has(show.path)) {
                      selectedShows.delete(show.path);
                    } else {
                      selectedShows.add(show.path);
                    }
                    selectedShows = selectedShows;
                  }}
                />
              </td>
              <td class="p-3">
                {#if show.posterPath}
                  <img src={show.posterPath} alt="{show.name}" class="h-12 w-9 object-cover rounded" />
                {:else if show.assets?.hasPoster}
                  <div class="flex h-12 w-9 items-center justify-center rounded bg-primary/10">
                    <svg class="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                  </div>
                {:else}
                  <div class="flex h-12 w-9 items-center justify-center rounded bg-muted">
                    <svg class="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                  </div>
                {/if}
              </td>
              <td class="p-3"><div class="font-medium">{show.name}</div></td>
              <td class="p-3 text-muted-foreground">{show.seasons.length}</td>
              <td class="p-3 text-muted-foreground">{show.seasons.reduce((sum, s) => sum + s.episodes.length, 0) || '24'}</td>
              <td class="p-3">
                <span class="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold {badge.color} {badge.border}">
                  {#if show.groupStatus === 'scraped'}
                    <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                  {:else if show.groupStatus === 'unscraped'}
                    <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                  {:else}
                    <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                  {/if}
                  {badge.label}
                </span>
              </td>
              <td class="p-3">
                <div class="flex items-center gap-2">
                  <span class="flex items-center gap-1 text-xs {show.assets?.hasPoster ? 'text-green-500' : 'text-red-500'}">
                    {#if show.assets?.hasPoster}
                      <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                    {:else}
                      <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                    {/if}
                    海报
                  </span>
                  <span class="flex items-center gap-1 text-xs {show.assets?.hasNfo ? 'text-green-500' : 'text-red-500'}">
                    {#if show.assets?.hasNfo}
                      <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                    {:else}
                      <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                    {/if}
                    NFO
                  </span>
                </div>
              </td>
              <td class="p-3">
                <div class="flex gap-1">
                  <button 
                    class="inline-flex items-center justify-center rounded-md text-xs font-medium h-7 px-2 border border-input bg-background hover:bg-accent"
                    on:click|stopPropagation={() => handleRowDoubleClick(show)}
                  >
                    详情
                  </button>
                  <button 
                    class="inline-flex items-center justify-center rounded-md text-xs font-medium h-7 px-2 border border-input bg-background hover:bg-accent"
                    on:click|stopPropagation={() => openSearchModal(show)}
                  >
                    匹配
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
  
  <!-- Bottom Bar (appears when items selected or operating) -->
  {#if selectedShows.size > 0 || isOperating}
    <div class="fixed bottom-0 left-0 right-0 border-t border-border bg-card shadow-lg z-40">
      <!-- Progress bar at top of bottom bar -->
      {#if batchProgress.total > 0}
        <div class="h-1 bg-muted">
          <div 
            class="h-full bg-linear-to-r from-primary to-green-500 transition-all duration-300" 
            style="width: {(batchProgress.current / batchProgress.total) * 100}%"
          ></div>
        </div>
      {/if}
      <div class="container mx-auto flex items-center justify-between p-4">
        <div class="flex items-center gap-4">
          {#if operationMessage}
            <span class="text-sm font-medium">{operationMessage}</span>
          {:else}
            <span class="text-sm text-muted-foreground">已选择 {selectedShows.size} 部剧集</span>
          {/if}
        </div>
        <div class="flex gap-2">
          <button 
            class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50" 
            disabled={isOperating}
            on:click={batchScrape}
          >
            {isOperating ? '处理中...' : '自动刮削'}
          </button>
          <button 
            class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-secondary text-secondary-foreground hover:opacity-90 disabled:opacity-50" 
            disabled={isOperating}
            on:click={batchRefresh}
          >
            刷新元数据
          </button>
          <button 
            class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-secondary text-secondary-foreground hover:opacity-90 disabled:opacity-50" 
            disabled={isOperating}
            on:click={batchRematch}
          >
            重新匹配
          </button>
        </div>
      </div>
    </div>
  {/if}
</main>

<!-- Detail Drawer -->
{#if showDetailDrawer && selectedShowForDetail}
  <div class="fixed inset-0 z-50">
    <button class="absolute inset-0 bg-black/50" on:click={closeDetailDrawer}></button>
    <div class="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-card border-l border-border overflow-y-auto">
      <div class="sticky top-0 flex items-center justify-between border-b border-border bg-card p-4">
        <h2 class="text-lg font-semibold">剧集详情</h2>
        <button class="inline-flex items-center justify-center rounded-md h-8 w-8 hover:bg-accent" on:click={closeDetailDrawer}>
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
      <div class="p-4 space-y-6">
        <div>
          <h3 class="text-xl font-bold mb-2">{selectedShowForDetail.name}</h3>
        </div>
        
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p class="text-muted-foreground">TMDB ID</p>
            <p class="font-medium">{selectedShowForDetail.tmdbId ? `#${selectedShowForDetail.tmdbId}` : '未匹配'}</p>
          </div>
          <div>
            <p class="text-muted-foreground">状态</p>
            <p class="font-medium">{getStatusBadge(selectedShowForDetail.groupStatus).label}</p>
          </div>
          <div>
            <p class="text-muted-foreground">季数</p>
            <p class="font-medium">{selectedShowForDetail.seasons.length}</p>
          </div>
          <div>
            <p class="text-muted-foreground">集数</p>
            <p class="font-medium">{selectedShowForDetail.seasons.reduce((sum, s) => sum + s.episodes.length, 0) || 24}</p>
          </div>
        </div>
        
        <div>
          <p class="text-sm text-muted-foreground mb-2">路径</p>
          <p class="font-mono text-xs bg-muted p-2 rounded">{selectedShowForDetail.path}</p>
        </div>
        
        <div>
          <p class="text-sm text-muted-foreground mb-2">完整性</p>
          <div class="flex gap-4">
            <span class="flex items-center gap-1 text-sm {selectedShowForDetail.assets?.hasPoster ? 'text-green-500' : 'text-red-500'}">
              {#if selectedShowForDetail.assets?.hasPoster}
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
              {:else}
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
              {/if}
              海报
            </span>
            <span class="flex items-center gap-1 text-sm {selectedShowForDetail.assets?.hasNfo ? 'text-green-500' : 'text-red-500'}">
              {#if selectedShowForDetail.assets?.hasNfo}
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
              {:else}
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
              {/if}
              NFO
            </span>
            <span class="flex items-center gap-1 text-sm {selectedShowForDetail.assets?.hasFanart ? 'text-green-500' : 'text-red-500'}">
              {#if selectedShowForDetail.assets?.hasFanart}
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
              {:else}
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
              {/if}
              Fanart
            </span>
          </div>
        </div>
        
        <div class="space-y-2">
          <p class="text-sm text-muted-foreground">操作</p>
          <div class="flex flex-wrap gap-2">
            <button 
              class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              disabled={isOperating}
              on:click={() => { if (selectedShowForDetail) handleScrapeShow(selectedShowForDetail); }}
            >
              {isOperating ? '处理中...' : '立即刮削'}
            </button>
            <button 
              class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-secondary text-secondary-foreground hover:opacity-90 disabled:opacity-50"
              disabled={isOperating || !selectedShowForDetail?.tmdbId}
              on:click={() => { if (selectedShowForDetail) handleRefreshShow(selectedShowForDetail); }}
            >
              刷新元数据
            </button>
            <button 
              class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-secondary text-secondary-foreground hover:opacity-90 disabled:opacity-50"
              disabled={isOperating || !selectedShowForDetail?.tmdbId}
              on:click={() => { if (selectedShowForDetail) handleFixAssets(selectedShowForDetail); }}
            >
              修复资产
            </button>
            <button class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-secondary text-secondary-foreground hover:opacity-90" on:click={() => { 
              const show = selectedShowForDetail;
              closeDetailDrawer();
              if (show) openSearchModal(show);
            }}>重新匹配</button>
          </div>
          {#if operationMessage}
            <p class="text-sm text-muted-foreground">{operationMessage}</p>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- TMDB Search Modal -->
{#if showSearchModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <button class="absolute inset-0 bg-black/50" on:click={closeSearchModal}></button>
    <div class="relative w-full max-w-xl bg-card border border-border rounded-lg shadow-lg overflow-hidden">
      <div class="flex items-center justify-between border-b border-border p-4">
        <h2 class="text-lg font-semibold">TMDB 搜索</h2>
        <button class="inline-flex items-center justify-center rounded-md h-8 w-8 hover:bg-accent" on:click={closeSearchModal}>
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
      <div class="p-4 space-y-4">
        <div class="flex gap-2">
          <input 
            type="text" 
            class="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm" 
            placeholder="输入搜索关键词..."
            bind:value={tmdbSearchQuery}
            on:keydown={(e) => e.key === 'Enter' && handleTMDBSearch()}
          />
          <button 
            class="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            on:click={handleTMDBSearch}
            disabled={isSearchingTMDB}
          >
            {isSearchingTMDB ? '搜索中...' : '搜索'}
          </button>
        </div>
        
        <div class="max-h-80 overflow-y-auto space-y-2">
          {#if tmdbSearchResults.length > 0}
            {#each tmdbSearchResults as result}
              <button 
                class="w-full flex items-center gap-4 p-3 rounded-md border border-border hover:bg-accent/50 text-left"
                on:click={() => selectTMDBResult(result)}
              >
                {#if result.posterPath}
                  <img src={result.posterPath} alt="{result.name || result.title}" class="w-10 h-14 object-cover rounded shrink-0" />
                {:else}
                  <div class="w-10 h-14 bg-muted rounded flex items-center justify-center shrink-0">
                    <svg class="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>
                  </div>
                {/if}
                <div class="flex-1 min-w-0">
                  <p class="font-medium truncate">{result.name || result.title}</p>
                  <p class="text-sm text-muted-foreground">{result.firstAirDate?.slice(0, 4) || result.releaseDate?.slice(0, 4) || '未知'}</p>
                </div>
                <span class="text-xs text-muted-foreground">TMDB#{result.id}</span>
              </button>
            {/each}
          {:else if !isSearchingTMDB}
            <p class="text-center text-muted-foreground py-8">输入关键词搜索 TMDB</p>
          {/if}
        </div>
      </div>
      <div class="flex justify-end gap-2 border-t border-border p-4">
        <button class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 border border-input bg-background hover:bg-accent" on:click={closeSearchModal}>取消</button>
      </div>
    </div>
  </div>
{/if}

<!-- Disambiguation Mode Selection Modal -->
{#if showDisambiguationModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <button class="absolute inset-0 bg-black/50" on:click={() => showDisambiguationModal = false}></button>
    <div class="relative w-full max-w-md bg-card border border-border rounded-lg shadow-lg overflow-hidden">
      <div class="flex items-center justify-between border-b border-border p-4">
        <h2 class="text-lg font-semibold">一键刮削</h2>
        <button class="inline-flex items-center justify-center rounded-md h-8 w-8 hover:bg-accent" on:click={() => showDisambiguationModal = false}>
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
      <div class="p-4 space-y-4">
        <p class="text-sm text-muted-foreground">
          选中 {pendingBatchItems.length} 部剧集，其中 {pendingBatchItems.filter(i => !i.show.tmdbId).length} 部需要匹配 TMDB。
        </p>
        
        <div class="space-y-2">
          <p class="text-sm font-medium">选择消歧方式：</p>
          <label class="flex items-start gap-3 p-3 rounded-md border border-border hover:bg-accent/50 cursor-pointer {disambiguationMode === 'manual' ? 'border-primary bg-accent/30' : ''}">
            <input type="radio" bind:group={disambiguationMode} value="manual" class="mt-0.5" />
            <div>
              <p class="font-medium">手动匹配</p>
              <p class="text-sm text-muted-foreground">逐个确认 TMDB 匹配结果，适合对准确性要求高的场景</p>
            </div>
          </label>
          <label class="flex items-start gap-3 p-3 rounded-md border border-border hover:bg-accent/50 cursor-pointer {disambiguationMode === 'ai' ? 'border-primary bg-accent/30' : ''}">
            <input type="radio" bind:group={disambiguationMode} value="ai" class="mt-0.5" />
            <div>
              <p class="font-medium flex items-center gap-2">AI 自动 <svg class="h-4 w-4 text-yellow-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2Z"/></svg></p>
              <p class="text-sm text-muted-foreground">使用 AI 自动选择最佳匹配，适合批量快速处理</p>
            </div>
          </label>
        </div>
      </div>
      <div class="flex justify-end gap-2 border-t border-border p-4">
        <button class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 border border-input bg-background hover:bg-accent" on:click={() => showDisambiguationModal = false}>取消</button>
        <button class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-primary text-primary-foreground hover:opacity-90" on:click={startBatchWithDisambiguation}>开始刮削</button>
      </div>
    </div>
  </div>
{/if}

<style lang="postcss">
  @reference "tailwindcss";
</style>
