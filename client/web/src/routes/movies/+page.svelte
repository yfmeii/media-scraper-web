<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { quintOut, cubicOut } from 'svelte/easing';
  import { fetchMovies, refreshMetadata, subscribeToProgress, type MovieInfo, type SearchResult } from '$lib/api';
  import { handleItemClick, toggleAllSelection } from '$lib/selection';
  import { createProgressHandler } from '$lib/progress';
import { formatFileSize } from '$lib/format';
import { TMDBSearchModal, BatchActionBar, TableSkeleton, PosterThumbnail, AssetIndicators, StatusBadge, SearchToolbar } from '$lib/components';
  
  let movies = $state<MovieInfo[]>([]);
  let loading = $state(true);
  let selectedMovies = $state(new Set<string>());
  
  // Filters
  let searchQuery = $state('');
  let activeTab = $state('all');
  
  // Detail drawer state
  let showDetailDrawer = $state(false);
  let selectedMovieForDetail = $state<MovieInfo | null>(null);
  let overviewExpanded = $state(false);
  
  // TMDB search modal state
  let showSearchModal = $state(false);
  
  // Operation state
  let isOperating = $state(false);
  let operationMessage = $state('');
  
  // Progress state
  let progressMap = $state(new Map<string, number>()); // path -> percent
  let processingPaths = $state(new Set<string>()); // Currently processing paths
  let unsubscribeProgress: (() => void) | null = null;
  let batchProgress = $state<{ current: number; total: number } | null>(null);
  
  const handleProgress = createProgressHandler(
    () => ({ progressMap, processingPaths, operationMessage }),
    (state) => {
      if (state.progressMap) progressMap = state.progressMap;
      if (state.processingPaths) processingPaths = state.processingPaths;
      if ('operationMessage' in state) operationMessage = state.operationMessage ?? '';
    }
  );
  
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
    overviewExpanded = false;
    selectedMovieForDetail = movie;
    showDetailDrawer = true;
  }
  
  function closeDetailDrawer() {
    showDetailDrawer = false;
    selectedMovieForDetail = null;
    overviewExpanded = false;
  }
  
  function openSearchModal(movie: MovieInfo) {
    selectedMovieForDetail = movie;
    showSearchModal = true;
  }
  
  async function handleTMDBSelect(result: SearchResult) {
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
    progressMap = new Map(progressMap);
    
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
    selectedMovies = new Set();
    
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
  const filteredMovies = $derived.by(() => (
    movies.filter(movie => {
      if (activeTab === 'scraped' && !movie.isProcessed) return false;
      if (activeTab === 'unscraped' && movie.isProcessed) return false;
      if (searchQuery && !movie.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
  ));
  
  const scrapedCount = $derived.by(() => movies.filter(m => m.isProcessed).length);
  const unscrapedCount = $derived.by(() => movies.filter(m => !m.isProcessed).length);

  const detailDelay = (i: number) => i * 60 + 200;

  function getFanartUrl(path?: string, hasFanart?: boolean): string | undefined {
    if (!path || !hasFanart) return undefined;
    return `/api/media/poster?path=${encodeURIComponent(`${path}/fanart.jpg`)}`;
  }

  function copyPath(path?: string) {
    if (!path) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(path).catch(() => {});
    }
  }

  const movieStatusBadge = $derived.by(() => 
    getGroupStatusBadge(selectedMovieForDetail?.isProcessed ? 'scraped' : 'unscraped')
  );

  const movieFanartUrl = $derived.by(() => 
    getFanartUrl(selectedMovieForDetail?.path, selectedMovieForDetail?.assets?.hasFanart)
  );

  const movieMetaItems = $derived.by(() => {
    if (!selectedMovieForDetail) return [];
    const items: string[] = [];
    if (typeof selectedMovieForDetail.voteAverage === 'number') {
      items.push(`评分 ${selectedMovieForDetail.voteAverage.toFixed(1)}`);
    }
    if (selectedMovieForDetail.year) items.push(String(selectedMovieForDetail.year));
    if (typeof selectedMovieForDetail.runtime === 'number' && selectedMovieForDetail.runtime > 0) {
      items.push(`${selectedMovieForDetail.runtime} 分钟`);
    }
    if (selectedMovieForDetail.file?.parsed?.resolution) items.push(selectedMovieForDetail.file.parsed.resolution);
    if (selectedMovieForDetail.file?.parsed?.codec) items.push(selectedMovieForDetail.file.parsed.codec);
    if (selectedMovieForDetail.file?.parsed?.source) items.push(selectedMovieForDetail.file.parsed.source);
    return items;
  });

  const movieOverview = $derived.by(() => selectedMovieForDetail?.overview?.trim() || '');
  const canExpandMovieOverview = $derived.by(() => movieOverview.length > 160);
</script>

<main class="container mx-auto px-4 py-8" class:pb-24={selectedMovies.size > 0 || isOperating}>
  <!-- Toolbar -->
  <SearchToolbar 
    searchPlaceholder="搜索电影..."
    bind:searchQuery
    tabs={[
      { id: 'all', label: '全部', count: movies.length },
      { id: 'scraped', label: '已刮削', count: scrapedCount },
      { id: 'unscraped', label: '未刮削', count: unscrapedCount }
    ]}
    bind:activeTab
  />
  
  <!-- Table -->
  <div class="rounded-lg border border-border bg-card overflow-hidden">
    {#if loading}
      <TableSkeleton rows={8} columns={5} />
    {:else if filteredMovies.length === 0}
      <div class="p-8 text-center text-muted-foreground">没有找到符合条件的电影</div>
    {:else}
      <table class="w-full">
        <thead class="bg-card">
          <tr class="border-b border-border text-xs text-muted-foreground">
            <th class="w-12 p-3 text-left"><input type="checkbox" class="h-4 w-4 rounded border-input accent-primary" checked={selectedMovies.size === filteredMovies.length && filteredMovies.length > 0} onchange={toggleAll} /></th>
            <th class="w-16 p-3 text-left font-medium">海报</th>
            <th class="p-3 text-left font-medium">电影名称</th>
            <th class="w-20 p-3 text-left font-medium">年份</th>
            <th class="w-32 p-3 text-left font-medium">状态</th>
            <th class="w-40 p-3 text-left font-medium">完整性</th>
            <th class="w-40 p-3 text-left font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredMovies as movie (movie.path)}
            <tr 
              class="border-b border-border hover:bg-accent/50 cursor-pointer {selectedMovies.has(movie.path) ? 'bg-accent/30 border-l-2 border-l-primary' : ''} transition-colors duration-150"
              onclick={(e) => toggleMovie(movie.path, e)}
              ondblclick={() => handleRowDoubleClick(movie)}
              animate:flip={{ duration: 300, easing: quintOut }}
              in:fly={{ y: 20, duration: 300, easing: cubicOut }}
            >
              <td class="p-3">
                <input 
                  type="checkbox" 
                  class="h-4 w-4 rounded border-input accent-primary" 
                  checked={selectedMovies.has(movie.path)} 
                  onclick={(e) => {
                    e.stopPropagation();
                    if (selectedMovies.has(movie.path)) {
                      selectedMovies.delete(movie.path);
                    } else {
                      selectedMovies.add(movie.path);
                    }
                    selectedMovies = new Set(selectedMovies);
                  }}
                />
              </td>
              <td class="p-3">
                <PosterThumbnail src={movie.posterPath} alt={movie.name} hasPoster={movie.assets?.hasPoster} size="sm" />
              </td>
              <td class="p-3"><div class="font-medium">{movie.name}</div></td>
              <td class="p-3 text-muted-foreground">{movie.year || '-'}</td>
              <td class="p-3">
                <StatusBadge status={movie.isProcessed ? 'scraped' : 'unscraped'} />
              </td>
              <td class="p-3">
                <AssetIndicators assets={{ hasPoster: movie.assets?.hasPoster, hasNfo: movie.assets?.hasNfo }} showLabels={true} />
              </td>
              <td class="p-3">
                <div class="flex gap-1">
                  <button 
                    class="inline-flex items-center justify-center rounded-md text-xs font-medium h-7 px-2 border border-input bg-background hover:bg-accent"
                    onclick={(e) => {
                      e.stopPropagation();
                      handleRowDoubleClick(movie);
                    }}
                  >
                    详情
                  </button>
                  <button 
                    class="inline-flex items-center justify-center rounded-md text-xs font-medium h-7 px-2 border border-input bg-background hover:bg-accent"
                    onclick={(e) => {
                      e.stopPropagation();
                      openSearchModal(movie);
                    }}
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
    {#snippet actions()}
      <button 
        class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50" 
        disabled={isOperating}
        onclick={batchRefreshMetadata}
      >
        {isOperating ? '处理中...' : '刷新元数据'}
      </button>
      <button 
        class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-secondary text-secondary-foreground hover:opacity-90 disabled:opacity-50" 
        disabled={isOperating}
        onclick={batchRematch}
      >
        重新匹配
      </button>
    {/snippet}
  </BatchActionBar>
</main>

<!-- Detail Drawer -->
{#if showDetailDrawer && selectedMovieForDetail}
  <div class="fixed inset-0 z-50">
    <button 
      class="absolute inset-0 bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60" 
      aria-label="关闭详情"
      onclick={closeDetailDrawer}
      transition:fade={{ duration: 200 }}
    ></button>
    <div 
      class="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-card border-l border-border shadow-2xl overflow-hidden"
      transition:fly={{ x: 400, duration: 400, opacity: 1, easing: quintOut }}
    >
      <div class="flex h-full flex-col">
        <div class="relative">
          <div class="relative h-60">
            <div 
              class="absolute inset-0 bg-muted bg-cover bg-center"
              style={movieFanartUrl ? `background-image: url('${movieFanartUrl}')` : ''}
            ></div>
            <div class="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent"></div>
            <button class="absolute right-4 top-4 inline-flex items-center justify-center rounded-md h-8 w-8 bg-background/70 hover:bg-background" aria-label="关闭详情" onclick={closeDetailDrawer}>
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          <div class="relative -mt-16 px-4 pb-4 flex gap-4 items-end" in:fly={{ y: 18, duration: 300, delay: detailDelay(0), easing: quintOut }}>
            <div class="h-28 w-20 rounded-lg overflow-hidden shadow-2xl shadow-black/50 bg-muted border border-border">
              {#if selectedMovieForDetail.posterPath}
                <img src={selectedMovieForDetail.posterPath} alt={selectedMovieForDetail.name} class="h-full w-full object-cover" />
              {:else}
                <div class="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground">No Poster</div>
              {/if}
            </div>
            <div class="min-w-0 pb-2">
              <h2 class="text-2xl font-semibold tracking-tight">{selectedMovieForDetail.name}</h2>
              <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {#each movieMetaItems as item}
                  <span class="rounded-full border border-border/60 bg-background/60 px-2 py-0.5">{item}</span>
                {/each}
                <span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 {movieStatusBadge.bgColor} {movieStatusBadge.border} {movieStatusBadge.color}">
                  {movieStatusBadge.label}
                </span>
              </div>
              {#if selectedMovieForDetail.tagline}
                <p class="mt-2 text-sm italic text-muted-foreground">{selectedMovieForDetail.tagline}</p>
              {/if}
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto px-4 pb-6 pt-2 space-y-6">
          <section class="space-y-2" in:fly={{ y: 18, duration: 300, delay: detailDelay(1), easing: quintOut }}>
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold">剧情简介</h3>
              {#if movieOverview && canExpandMovieOverview}
                <button class="text-xs text-muted-foreground hover:text-foreground" onclick={() => { overviewExpanded = !overviewExpanded; }}>
                  {overviewExpanded ? '收起' : '展开'}
                </button>
              {/if}
            </div>
            <p class="text-sm text-muted-foreground leading-relaxed {movieOverview && !overviewExpanded && canExpandMovieOverview ? 'line-clamp-4' : ''}">
              {movieOverview || '暂无简介'}
            </p>
          </section>

          <section class="space-y-3" in:fly={{ y: 18, duration: 300, delay: detailDelay(2), easing: quintOut }}>
            <h3 class="text-sm font-semibold">元数据</h3>
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div class="rounded-lg border border-border/60 bg-muted/30 p-3">
                <p class="text-xs text-muted-foreground">TMDB</p>
                {#if selectedMovieForDetail.tmdbId}
                  <a 
                    class="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:opacity-80"
                    href={`https://www.themoviedb.org/movie/${selectedMovieForDetail.tmdbId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    #{selectedMovieForDetail.tmdbId}
                    <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
                  </a>
                {:else}
                  <p class="mt-1 text-sm font-medium">未匹配</p>
                {/if}
              </div>
              <div class="rounded-lg border border-border/60 bg-muted/30 p-3">
                <p class="text-xs text-muted-foreground">状态</p>
                <span class="mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-xs {movieStatusBadge.bgColor} {movieStatusBadge.border} {movieStatusBadge.color}">
                  {movieStatusBadge.label}
                </span>
              </div>
              <button 
                class="col-span-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-left hover:bg-muted/50"
                title="点击复制路径"
                onclick={() => copyPath(selectedMovieForDetail?.path)}
              >
                <p class="text-xs text-muted-foreground">路径</p>
                <p class="mt-1 font-mono text-xs break-all">{selectedMovieForDetail.path}</p>
                <p class="mt-1 text-[11px] text-muted-foreground">点击复制</p>
              </button>
              <div class="col-span-2 rounded-lg border border-border/60 bg-muted/30 p-3">
                <p class="text-xs text-muted-foreground">资源完整性</p>
                <div class="mt-2 flex flex-wrap gap-3">
                  <span class="flex items-center gap-1 text-xs {selectedMovieForDetail.assets?.hasPoster ? 'text-green-500' : 'text-red-500'}">
                    {#if selectedMovieForDetail.assets?.hasPoster}
                      <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                    {:else}
                      <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                    {/if}
                    海报
                  </span>
                  <span class="flex items-center gap-1 text-xs {selectedMovieForDetail.assets?.hasNfo ? 'text-green-500' : 'text-red-500'}">
                    {#if selectedMovieForDetail.assets?.hasNfo}
                      <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                    {:else}
                      <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                    {/if}
                    NFO
                  </span>
                  <span class="flex items-center gap-1 text-xs {selectedMovieForDetail.assets?.hasFanart ? 'text-green-500' : 'text-red-500'}">
                    {#if selectedMovieForDetail.assets?.hasFanart}
                      <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                    {:else}
                      <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                    {/if}
                    Fanart
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section class="space-y-3" in:fly={{ y: 18, duration: 300, delay: detailDelay(3), easing: quintOut }}>
            <h3 class="text-sm font-semibold">文件技术信息</h3>
            <div class="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-3">
              <div>
                <p class="text-xs text-muted-foreground">文件</p>
                <p class="mt-1 text-sm font-medium break-all">{selectedMovieForDetail.file.name}</p>
              </div>
              <div class="flex flex-wrap gap-2">
                {#if selectedMovieForDetail.file.parsed.resolution}
                  <span class="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-500">
                    {selectedMovieForDetail.file.parsed.resolution}
                  </span>
                {/if}
                {#if selectedMovieForDetail.file.parsed.codec}
                  <span class="rounded-md border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-500">
                    {selectedMovieForDetail.file.parsed.codec}
                  </span>
                {/if}
                {#if selectedMovieForDetail.file.parsed.source}
                  <span class="rounded-md border border-border/60 bg-background/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {selectedMovieForDetail.file.parsed.source}
                  </span>
                {/if}
                <span class="rounded-md border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500">
                  {formatFileSize(selectedMovieForDetail.file.size)}
                </span>
              </div>
            </div>
          </section>
        </div>

        <div class="shrink-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 space-y-3">
          {#if operationMessage}
            <div class="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <svg class="h-4 w-4 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              <span>{operationMessage}</span>
            </div>
          {/if}
          <div class="flex items-center gap-2">
            <button 
              class="flex-1 inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              disabled={isOperating}
              onclick={() => { if (selectedMovieForDetail) handleScrapeMovie(selectedMovieForDetail); }}
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                <path d="M16 16h5v5"/>
              </svg>
              {isOperating ? '处理中...' : '刷新元数据'}
            </button>
            <button 
              class="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium h-10 px-4 border border-border bg-background hover:bg-accent transition-colors"
              onclick={() => { 
                const movie = selectedMovieForDetail;
                closeDetailDrawer();
                if (movie) openSearchModal(movie);
              }}
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.3-4.3"/>
              </svg>
              重新匹配
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- TMDB Search Modal -->
<TMDBSearchModal
  show={showSearchModal}
  type="movie"
  initialQuery={selectedMovieForDetail?.name || ''}
  onSelect={handleTMDBSelect}
  onClose={() => { showSearchModal = false; }}
/>

<style lang="postcss">
  @reference "tailwindcss";

  .line-clamp-4 {
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
