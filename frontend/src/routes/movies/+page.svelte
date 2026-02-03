<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fetchMovies, searchTMDB, refreshMetadata, fixAssets, autoMatch, batchScrapeWithDisambiguation, subscribeToProgress, type MovieInfo, type SearchResult, type BatchScrapeItem, type ProgressEvent } from '$lib/api';
  
  let movies: MovieInfo[] = [];
  let loading = true;
  let selectedMovies = new Set<string>();
  
  // Filters
  let statusFilter = 'all';
  let searchQuery = '';
  let activeTab = 'all';
  
  // Detail drawer state
  let showDetailDrawer = false;
  let selectedMovieForDetail: MovieInfo | null = null;
  
  // TMDB search modal state
  let showSearchModal = false;
  let tmdbSearchQuery = '';
  let tmdbSearchResults: SearchResult[] = [];
  let isSearchingTMDB = false;
  
  // Disambiguation modal state
  let showDisambiguationModal = false;
  let disambiguationMode: 'manual' | 'ai' = 'manual';
  let pendingBatchItems: { movie: MovieInfo; match?: any }[] = [];
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
      progressMap = progressMap;
      operationMessage = event.message || '';
    }
    
    if (event.type === 'complete' && processingPaths.size > 0) {
      setTimeout(() => {
        progressMap.clear();
        progressMap = progressMap;
        processingPaths.clear();
      }, 2000);
    }
  }
  
  onMount(async () => {
    try {
      movies = await fetchMovies();
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
    
    unsubscribeProgress = subscribeToProgress(handleProgress);
  });
  
  onDestroy(() => {
    if (unsubscribeProgress) unsubscribeProgress();
  });
  
  function toggleMovie(path: string, event: MouseEvent) {
    if (event.shiftKey && selectedMovies.size > 0) {
      const paths = filteredMovies.map(m => m.path);
      const lastSelected = Array.from(selectedMovies).pop()!;
      const lastIdx = paths.indexOf(lastSelected);
      const currentIdx = paths.indexOf(path);
      const [start, end] = lastIdx < currentIdx ? [lastIdx, currentIdx] : [currentIdx, lastIdx];
      for (let i = start; i <= end; i++) {
        selectedMovies.add(paths[i]);
      }
    } else if (event.ctrlKey || event.metaKey) {
      if (selectedMovies.has(path)) selectedMovies.delete(path);
      else selectedMovies.add(path);
    } else {
      selectedMovies.clear();
      selectedMovies.add(path);
    }
    selectedMovies = selectedMovies;
  }
  
  function toggleAll() {
    if (selectedMovies.size === filteredMovies.length) {
      selectedMovies.clear();
    } else {
      filteredMovies.forEach(m => selectedMovies.add(m.path));
    }
    selectedMovies = selectedMovies;
  }
  
  function handleRowDoubleClick(movie: MovieInfo) {
    selectedMovieForDetail = movie;
    showDetailDrawer = true;
  }
  
  function closeDetailDrawer() {
    showDetailDrawer = false;
    selectedMovieForDetail = null;
  }
  
  async function handleTMDBSearch() {
    if (!tmdbSearchQuery.trim()) return;
    isSearchingTMDB = true;
    try {
      tmdbSearchResults = await searchTMDB('movie', tmdbSearchQuery);
    } catch (e) {
      console.error(e);
    } finally {
      isSearchingTMDB = false;
    }
  }
  
  function openSearchModal(movie: MovieInfo) {
    selectedMovieForDetail = movie;
    tmdbSearchQuery = movie.name;
    showSearchModal = true;
    handleTMDBSearch();
  }
  
  function closeSearchModal() {
    showSearchModal = false;
    tmdbSearchResults = [];
  }
  
  async function selectTMDBResult(result: SearchResult) {
    if (!selectedMovieForDetail || isOperating) return;
    
    // Check if we're in batch manual matching mode
    if (pendingBatchItems.length > 0 && currentMatchIndex < pendingBatchItems.length) {
      pendingBatchItems[currentMatchIndex].match = { id: result.id, name: result.title || result.name };
      closeSearchModal();
      currentMatchIndex++;
      await matchNextItem();
      return;
    }
    
    // Normal single-item matching
    const moviePath = selectedMovieForDetail.path;
    isOperating = true;
    operationMessage = `正在匹配 ${result.title || result.name}...`;
    
    try {
      const res = await refreshMetadata('movie', moviePath, result.id);
      
      if (res.success) {
        operationMessage = '匹配成功，已创建元数据';
        loading = true;
        movies = [];
        const newMovies = await fetchMovies();
        movies = [...newMovies];
        loading = false;
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
  
  // Batch operations
  function batchScrape() {
    if (isOperating) return;
    
    const paths = Array.from(selectedMovies);
    const selectedMoviesList = paths.map(p => movies.find(m => m.path === p)).filter((m): m is MovieInfo => m !== undefined);
    
    const needsMatching = selectedMoviesList.some(m => !m.tmdbId);
    
    if (needsMatching) {
      pendingBatchItems = selectedMoviesList.map(m => ({ movie: m }));
      showDisambiguationModal = true;
    } else {
      executeBatchRefresh();
    }
  }
  
  async function executeBatchRefresh() {
    isOperating = true;
    operationMessage = '正在刷新元数据...';
    
    const paths = Array.from(selectedMovies);
    let successCount = 0;
    let failCount = 0;
    
    // Initialize progress
    batchProgress = { current: 0, total: paths.length };
    for (const path of paths) {
      progressMap.set(path, 0);
    }
    progressMap = progressMap;
    
    for (const path of paths) {
      const movie = movies.find(m => m.path === path);
      if (!movie || !movie.tmdbId) {
        failCount++;
        batchProgress.current++;
        batchProgress = batchProgress;
        progressMap.set(path, 100);
        progressMap = progressMap;
        continue;
      }
      
      operationMessage = `正在刷新 (${batchProgress.current + 1}/${batchProgress.total}): ${movie.name}`;
      const result = await refreshMetadata('movie', movie.path, movie.tmdbId);
      if (result.success) successCount++;
      else failCount++;
      
      batchProgress.current++;
      batchProgress = batchProgress;
      
      // Refresh data to show updated state
      const updatedMovies = await fetchMovies();
      movies = [...updatedMovies];
    }
    
    operationMessage = '';
    isOperating = false;
    selectedMovies.clear();
    selectedMovies = selectedMovies;
    
    setTimeout(() => { 
      batchProgress = { current: 0, total: 0 };
    }, 2000);
  }
  
  async function startBatchWithDisambiguation() {
    showDisambiguationModal = false;
    
    if (disambiguationMode === 'ai') {
      await executeBatchWithAI();
    } else {
      currentMatchIndex = 0;
      await matchNextItem();
    }
  }
  
  async function executeBatchWithAI() {
    isOperating = true;
    operationMessage = '正在使用 AI 自动匹配并刮削...';
    
    const items: BatchScrapeItem[] = [];
    
    for (const { movie } of pendingBatchItems) {
      if (movie.tmdbId) {
        items.push({
          sourcePath: movie.path,
          kind: 'movie',
          tmdbId: movie.tmdbId,
        });
      } else {
        const match = await autoMatch(movie.path, 'movie', movie.name, movie.year);
        if (match.matched && match.result) {
          items.push({
            sourcePath: movie.path,
            kind: 'movie',
            tmdbId: match.result.id,
          });
        } else if (match.candidates.length > 0) {
          items.push({
            sourcePath: movie.path,
            kind: 'movie',
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
    
    const newMovies = await fetchMovies();
    movies = [...newMovies];
    selectedMovies.clear();
    selectedMovies = selectedMovies;
    pendingBatchItems = [];
    
    setTimeout(() => { operationMessage = ''; }, 3000);
  }
  
  async function matchNextItem() {
    if (currentMatchIndex >= pendingBatchItems.length) {
      await executeMatchedBatch();
      return;
    }
    
    const item = pendingBatchItems[currentMatchIndex];
    
    if (item.movie.tmdbId) {
      item.match = { id: item.movie.tmdbId };
      currentMatchIndex++;
      await matchNextItem();
      return;
    }
    
    selectedMovieForDetail = item.movie;
    tmdbSearchQuery = item.movie.name + (item.movie.year ? ` ${item.movie.year}` : '');
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
    for (const { movie } of pendingBatchItems) {
      progressMap.set(movie.path, 0);
    }
    progressMap = progressMap;
    
    for (const { movie, match } of pendingBatchItems) {
      if (!match?.id) {
        failCount++;
        batchProgress.current++;
        batchProgress = batchProgress;
        progressMap.set(movie.path, 100);
        progressMap = progressMap;
        continue;
      }
      
      operationMessage = `正在刮削 (${batchProgress.current + 1}/${batchProgress.total}): ${movie.name}`;
      const result = await refreshMetadata('movie', movie.path, match.id);
      if (result.success) successCount++;
      else failCount++;
      
      batchProgress.current++;
      batchProgress = batchProgress;
      
      // Refresh data to show updated state
      const updatedMovies = await fetchMovies();
      movies = [...updatedMovies];
    }
    
    operationMessage = '';
    isOperating = false;
    selectedMovies.clear();
    selectedMovies = selectedMovies;
    pendingBatchItems = [];
    
    setTimeout(() => { 
      batchProgress = { current: 0, total: 0 };
    }, 2000);
  }
  
  function batchRematch() {
    const firstPath = Array.from(selectedMovies)[0];
    const movie = movies.find(m => m.path === firstPath);
    if (movie) {
      openSearchModal(movie);
    }
  }
  
  // Single movie operations
  async function handleScrapeMovie(movie: MovieInfo) {
    if (isOperating) return;
    
    if (!movie.tmdbId) {
      operationMessage = '未刮削电影需要先匹配 TMDB，请点击"重新匹配"';
      setTimeout(() => { operationMessage = ''; }, 5000);
      return;
    }
    
    isOperating = true;
    operationMessage = '正在刷新元数据...';
    
    try {
      const result = await refreshMetadata('movie', movie.path, movie.tmdbId);
      operationMessage = result.success ? '刷新成功' : `失败: ${result.message}`;
      
      const newMovies = await fetchMovies();
      movies = [...newMovies];
    } catch (e) {
      operationMessage = `错误: ${e}`;
    }
    
    isOperating = false;
    setTimeout(() => { operationMessage = ''; }, 3000);
  }
  
  async function handleFixAssets(movie: MovieInfo) {
    if (isOperating || !movie.tmdbId) return;
    isOperating = true;
    operationMessage = '正在修复资产...';
    
    const result = await fixAssets('movie', movie.path, movie.tmdbId);
    operationMessage = result.success ? '修复成功' : `失败: ${result.message}`;
    isOperating = false;
    
    const newMovies = await fetchMovies();
    movies = [...newMovies];
    
    setTimeout(() => { operationMessage = ''; }, 3000);
  }
  
  // Filtered movies
  $: filteredMovies = movies.filter(movie => {
    if (activeTab === 'scraped' && !movie.isProcessed) return false;
    if (activeTab === 'unscraped' && movie.isProcessed) return false;
    if (statusFilter === 'scraped' && !movie.isProcessed) return false;
    if (statusFilter === 'unscraped' && movie.isProcessed) return false;
    if (searchQuery && !movie.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });
  
  $: scrapedCount = movies.filter(m => m.isProcessed).length;
  $: unscrapedCount = movies.filter(m => !m.isProcessed).length;
</script>

<main class="container mx-auto px-4 py-8">
  <!-- Toolbar -->
  <div class="mb-6 space-y-4">
    <div class="flex items-center justify-between flex-wrap gap-4">
      <div class="flex items-center gap-4 flex-wrap">
        <select class="h-9 w-32 rounded-md border border-input bg-background px-3 text-sm" bind:value={statusFilter}>
          <option value="all">全部状态</option>
          <option value="scraped">已刮削</option>
          <option value="unscraped">未刮削</option>
        </select>
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" placeholder="搜索电影..." class="h-9 w-48 rounded-md border border-input bg-background pl-9 pr-3 text-sm" bind:value={searchQuery} />
        </div>
      </div>
      <div class="flex gap-2 items-center">
        {#if operationMessage && selectedMovies.size === 0}
          <span class="text-sm text-muted-foreground">{operationMessage}</span>
        {/if}
      </div>
    </div>
    
    <div class="flex items-center justify-between flex-wrap gap-4">
      <div class="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
        <button class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all {activeTab === 'all' ? 'bg-background text-foreground shadow-sm' : ''}" on:click={() => activeTab = 'all'}>全部 ({movies.length})</button>
        <button class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all {activeTab === 'scraped' ? 'bg-background text-foreground shadow-sm' : ''}" on:click={() => activeTab = 'scraped'}>已刮削 ({scrapedCount})</button>
        <button class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all {activeTab === 'unscraped' ? 'bg-background text-foreground shadow-sm' : ''}" on:click={() => activeTab = 'unscraped'}>未刮削 ({unscrapedCount})</button>
      </div>
    </div>
  </div>
  
  <!-- Table -->
  <div class="rounded-lg border border-border bg-card overflow-hidden">
    {#if loading}
      <div class="p-8 text-center text-muted-foreground">加载中...</div>
    {:else if filteredMovies.length === 0}
      <div class="p-8 text-center text-muted-foreground">没有找到符合条件的电影</div>
    {:else}
      <table class="w-full">
        <thead class="bg-card">
          <tr class="border-b border-border text-xs text-muted-foreground">
            <th class="w-12 p-3 text-left"><input type="checkbox" class="h-4 w-4 rounded border-input accent-primary" checked={selectedMovies.size === filteredMovies.length && filteredMovies.length > 0} on:change={toggleAll} /></th>
            <th class="w-16 p-3 text-left font-medium">海报</th>
            <th class="p-3 text-left font-medium">电影名称</th>
            <th class="w-20 p-3 text-left font-medium">年份</th>
            <th class="w-32 p-3 text-left font-medium">状态</th>
            <th class="w-40 p-3 text-left font-medium">完整性</th>
            <th class="w-40 p-3 text-left font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredMovies as movie}
            <tr 
              class="border-b border-border hover:bg-accent/50 cursor-pointer {selectedMovies.has(movie.path) ? 'bg-accent/30 border-l-2 border-l-primary' : ''}"
              on:click={(e) => toggleMovie(movie.path, e)}
              on:dblclick={() => handleRowDoubleClick(movie)}
            >
              <td class="p-3">
                <input 
                  type="checkbox" 
                  class="h-4 w-4 rounded border-input accent-primary" 
                  checked={selectedMovies.has(movie.path)} 
                  on:click|stopPropagation={() => {
                    if (selectedMovies.has(movie.path)) {
                      selectedMovies.delete(movie.path);
                    } else {
                      selectedMovies.add(movie.path);
                    }
                    selectedMovies = selectedMovies;
                  }}
                />
              </td>
              <td class="p-3">
                {#if movie.posterPath}
                  <img src={movie.posterPath} alt="{movie.name}" class="h-12 w-9 object-cover rounded" />
                {:else if movie.assets?.hasPoster}
                  <div class="flex h-12 w-9 items-center justify-center rounded bg-primary/10">
                    <svg class="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                  </div>
                {:else}
                  <div class="flex h-12 w-9 items-center justify-center rounded bg-muted">
                    <svg class="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                  </div>
                {/if}
              </td>
              <td class="p-3"><div class="font-medium">{movie.name}</div></td>
              <td class="p-3 text-muted-foreground">{movie.year || '-'}</td>
              <td class="p-3">
                <span class="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold {movie.isProcessed ? 'text-green-500 border-green-500/50' : 'text-red-500 border-red-500/50'}">
                  {#if movie.isProcessed}
                    <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                    已刮削
                  {:else}
                    <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                    未刮削
                  {/if}
                </span>
              </td>
              <td class="p-3">
                <div class="flex items-center gap-2">
                  <span class="flex items-center gap-1 text-xs {movie.assets?.hasPoster ? 'text-green-500' : 'text-red-500'}">
                    {#if movie.assets?.hasPoster}
                      <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                    {:else}
                      <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                    {/if}
                    海报
                  </span>
                  <span class="flex items-center gap-1 text-xs {movie.assets?.hasNfo ? 'text-green-500' : 'text-red-500'}">
                    {#if movie.assets?.hasNfo}
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
                    on:click|stopPropagation={() => handleRowDoubleClick(movie)}
                  >
                    详情
                  </button>
                  <button 
                    class="inline-flex items-center justify-center rounded-md text-xs font-medium h-7 px-2 border border-input bg-background hover:bg-accent"
                    on:click|stopPropagation={() => openSearchModal(movie)}
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
  
  <!-- Bottom Bar -->
  {#if selectedMovies.size > 0 || isOperating}
    <div class="fixed bottom-0 left-0 right-0 border-t border-border bg-card shadow-lg z-40">
      <!-- Progress bar at top of bottom bar -->
      {#if batchProgress.total > 0}
        <div class="h-1 bg-muted">
          <div 
            class="h-full bg-gradient-to-r from-primary to-green-500 transition-all duration-300" 
            style="width: {(batchProgress.current / batchProgress.total) * 100}%"
          ></div>
        </div>
      {/if}
      <div class="container mx-auto flex items-center justify-between p-4">
        <div class="flex items-center gap-4">
          {#if operationMessage}
            <span class="text-sm font-medium">{operationMessage}</span>
          {:else}
            <span class="text-sm text-muted-foreground">已选择 {selectedMovies.size} 部电影</span>
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
            on:click={executeBatchRefresh}
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
{#if showDetailDrawer && selectedMovieForDetail}
  <div class="fixed inset-0 z-50">
    <button class="absolute inset-0 bg-black/50" on:click={closeDetailDrawer}></button>
    <div class="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-card border-l border-border overflow-y-auto">
      <div class="sticky top-0 flex items-center justify-between border-b border-border bg-card p-4">
        <h2 class="text-lg font-semibold">电影详情</h2>
        <button class="inline-flex items-center justify-center rounded-md h-8 w-8 hover:bg-accent" on:click={closeDetailDrawer}>
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
      <div class="p-4 space-y-6">
        <div>
          <h3 class="text-xl font-bold mb-2">{selectedMovieForDetail.name}</h3>
          <p class="text-muted-foreground">{selectedMovieForDetail.year || '未知年份'}</p>
        </div>
        
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p class="text-muted-foreground">TMDB ID</p>
            <p class="font-medium">{selectedMovieForDetail.tmdbId ? `#${selectedMovieForDetail.tmdbId}` : '未匹配'}</p>
          </div>
          <div>
            <p class="text-muted-foreground">状态</p>
            <p class="font-medium">{selectedMovieForDetail.isProcessed ? '已刮削' : '未刮削'}</p>
          </div>
        </div>
        
        <div>
          <p class="text-sm text-muted-foreground mb-2">路径</p>
          <p class="font-mono text-xs bg-muted p-2 rounded">{selectedMovieForDetail.path}</p>
        </div>
        
        <div>
          <p class="text-sm text-muted-foreground mb-2">完整性</p>
          <div class="flex gap-4">
            <span class="flex items-center gap-1 text-sm {selectedMovieForDetail.assets?.hasPoster ? 'text-green-500' : 'text-red-500'}">
              {#if selectedMovieForDetail.assets?.hasPoster}
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
              {:else}
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
              {/if}
              海报
            </span>
            <span class="flex items-center gap-1 text-sm {selectedMovieForDetail.assets?.hasNfo ? 'text-green-500' : 'text-red-500'}">
              {#if selectedMovieForDetail.assets?.hasNfo}
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
              {:else}
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
              {/if}
              NFO
            </span>
          </div>
        </div>
        
        <div class="space-y-2">
          <p class="text-sm text-muted-foreground">操作</p>
          <div class="flex flex-wrap gap-2">
            <button 
              class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              disabled={isOperating}
              on:click={() => { if (selectedMovieForDetail) handleScrapeMovie(selectedMovieForDetail); }}
            >
              {isOperating ? '处理中...' : '刷新元数据'}
            </button>
            <button 
              class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-secondary text-secondary-foreground hover:opacity-90 disabled:opacity-50"
              disabled={isOperating || !selectedMovieForDetail?.tmdbId}
              on:click={() => { if (selectedMovieForDetail) handleFixAssets(selectedMovieForDetail); }}
            >
              修复资产
            </button>
            <button class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-secondary text-secondary-foreground hover:opacity-90" on:click={() => { 
              const movie = selectedMovieForDetail;
              closeDetailDrawer();
              if (movie) openSearchModal(movie);
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
                  <img src={result.posterPath} alt="{result.title || result.name}" class="w-10 h-14 object-cover rounded shrink-0" />
                {:else}
                  <div class="w-10 h-14 bg-muted rounded flex items-center justify-center shrink-0">
                    <svg class="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>
                  </div>
                {/if}
                <div class="flex-1 min-w-0">
                  <p class="font-medium truncate">{result.title || result.name}</p>
                  <p class="text-sm text-muted-foreground">{result.releaseDate?.slice(0, 4) || result.firstAirDate?.slice(0, 4) || '未知'}</p>
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
          选中 {pendingBatchItems.length} 部电影，其中 {pendingBatchItems.filter(i => !i.movie.tmdbId).length} 部需要匹配 TMDB。
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
