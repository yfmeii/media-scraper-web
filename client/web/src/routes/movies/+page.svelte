<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { fetchMovies, refreshMetadata, subscribeToProgress, type MovieInfo, type SearchResult, type ProgressEvent } from '$lib/api';
  import { handleItemClick, toggleAllSelection } from '$lib/selection';
  import { formatFileSize, getScrapedStatus } from '$lib/format';
  import { TMDBSearchModal, DetailDrawer, BatchActionBar } from '$lib/components';
  
  let movies: MovieInfo[] = [];
  let loading = true;
  let selectedMovies = new Set<string>();
  
  // Filters
  let searchQuery = '';
  let activeTab = 'all';
  
  // Detail drawer state
  let showDetailDrawer = false;
  let selectedMovieForDetail: MovieInfo | null = null;
  
  // TMDB search modal state
  let showSearchModal = false;
  
  // Operation state
  let isOperating = false;
  let operationMessage = '';
  
  // Progress state
  let progressMap = new Map<string, number>(); // path -> percent
  let processingPaths = new Set<string>(); // Currently processing paths
  let unsubscribeProgress: (() => void) | null = null;
  let batchProgress: { current: number; total: number } | null = null;
  
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
  
  // 使用通用选择逻辑
  function toggleMovie(path: string, event: MouseEvent) {
    selectedMovies = handleItemClick(path, event, selectedMovies, filteredMovies, m => m.path);
  }
  
  function toggleAll() {
    selectedMovies = toggleAllSelection(selectedMovies, filteredMovies, m => m.path);
  }
  
  function handleRowDoubleClick(movie: MovieInfo) {
    selectedMovieForDetail = movie;
    showDetailDrawer = true;
  }
  
  function closeDetailDrawer() {
    showDetailDrawer = false;
    selectedMovieForDetail = null;
  }
  
  function openSearchModal(movie: MovieInfo) {
    selectedMovieForDetail = movie;
    showSearchModal = true;
  }
  
  async function handleTMDBSelect(event: CustomEvent<SearchResult>) {
    const result = event.detail;
    if (!selectedMovieForDetail || isOperating) return;
    
    const moviePath = selectedMovieForDetail.path;
    showSearchModal = false;
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
    
    setTimeout(() => { operationMessage = ''; }, 3000);
  }
  
  // Batch operations - 批量刷新元数据
  async function batchRefreshMetadata() {
    if (isOperating) return;
    
    const paths = Array.from(selectedMovies);
    const selectedMoviesList = paths.map(p => movies.find(m => m.path === p)).filter((m): m is MovieInfo => m !== undefined);
    
    // Check if any movies don't have TMDB ID
    const needsMatching = selectedMoviesList.filter(m => !m.tmdbId);
    if (needsMatching.length > 0) {
      operationMessage = `${needsMatching.length} 部电影没有 TMDB ID，请先手动匹配`;
      setTimeout(() => { operationMessage = ''; }, 3000);
      return;
    }
    
    isOperating = true;
    operationMessage = '正在刷新元数据...';
    
    let successCount = 0;
    let failCount = 0;
    
    // Initialize progress
    batchProgress = { current: 0, total: paths.length };
    for (const path of paths) {
      progressMap.set(path, 0);
    }
    progressMap = progressMap;
    
    for (const movie of selectedMoviesList) {
      operationMessage = `正在刷新 (${batchProgress.current + 1}/${batchProgress.total}): ${movie.name}`;
      const result = await refreshMetadata('movie', movie.path, movie.tmdbId!);
      if (result.success) successCount++;
      else failCount++;
      
      batchProgress.current++;
      batchProgress = { ...batchProgress };
    }
    
    // Refresh data
    const updatedMovies = await fetchMovies();
    movies = [...updatedMovies];
    
    operationMessage = `完成: ${successCount} 成功, ${failCount} 失败`;
    isOperating = false;
    selectedMovies.clear();
    selectedMovies = selectedMovies;
    
    setTimeout(() => { 
      operationMessage = '';
      batchProgress = null;
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
  
  
  // Filtered movies
  $: filteredMovies = movies.filter(movie => {
    if (activeTab === 'scraped' && !movie.isProcessed) return false;
    if (activeTab === 'unscraped' && movie.isProcessed) return false;
    if (searchQuery && !movie.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });
  
  $: scrapedCount = movies.filter(m => m.isProcessed).length;
  $: unscrapedCount = movies.filter(m => !m.isProcessed).length;
</script>

<main class="container mx-auto px-4 py-8" class:pb-24={selectedMovies.size > 0 || isOperating}>
  <!-- Toolbar -->
  <div class="mb-6 space-y-4">
    <div class="flex items-center justify-between flex-wrap gap-4">
      <div class="flex items-center gap-4 flex-wrap">
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" placeholder="搜索电影..." class="h-9 w-64 rounded-md border border-input bg-background pl-9 pr-3 text-sm" bind:value={searchQuery} />
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
  <BatchActionBar 
    show={selectedMovies.size > 0 || isOperating}
    selectedCount={selectedMovies.size}
    {isOperating}
    {operationMessage}
    progress={batchProgress}
    itemLabel="部电影"
  >
    <svelte:fragment slot="actions">
      <button 
        class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50" 
        disabled={isOperating}
        on:click={batchRefreshMetadata}
      >
        {isOperating ? '处理中...' : '刷新元数据'}
      </button>
      <button 
        class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-secondary text-secondary-foreground hover:opacity-90 disabled:opacity-50" 
        disabled={isOperating}
        on:click={batchRematch}
      >
        重新匹配
      </button>
    </svelte:fragment>
  </BatchActionBar>
</main>

<!-- Detail Drawer -->
{#if showDetailDrawer && selectedMovieForDetail}
  <div class="fixed inset-0 z-50">
    <button 
      class="absolute inset-0 bg-black/50" 
      on:click={closeDetailDrawer}
      transition:fade={{ duration: 200 }}
    ></button>
    <div 
      class="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-card border-l border-border overflow-y-auto"
      transition:fly={{ x: 400, duration: 300, easing: quintOut }}
    >
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
<TMDBSearchModal
  bind:show={showSearchModal}
  type="movie"
  initialQuery={selectedMovieForDetail?.name || ''}
  on:select={handleTMDBSelect}
  on:close={() => showSearchModal = false}
/>

<style lang="postcss">
  @reference "tailwindcss";
</style>
