<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { fetchTVShows, searchTMDB, refreshMetadata, autoMatch, subscribeToProgress, moveToInbox, type ShowInfo, type SearchResult, type ProgressEvent } from '$lib/api';
  import type { SeasonInfo, MediaFile } from '@media-scraper/shared';
  import { handleItemClick, toggleAllSelection } from '$lib/selection';
  import { formatFileSize, getGroupStatusBadge } from '$lib/format';
  import { TMDBSearchModal, DetailDrawer, BatchActionBar } from '$lib/components';
  import { confirmDialog } from '$lib/stores';
  
  // Helper functions for typed array operations
  function countTotalEpisodes(seasons: SeasonInfo[]): number {
    return seasons.reduce((sum, s) => sum + s.episodes.length, 0);
  }
  
  function sortSeasons(seasons: SeasonInfo[]): SeasonInfo[] {
    return [...seasons].sort((a, b) => a.season - b.season);
  }
  
  function sortEpisodes(episodes: MediaFile[]): MediaFile[] {
    return [...episodes].sort((a, b) => (a.parsed.episode || 0) - (b.parsed.episode || 0));
  }
  
  let shows: ShowInfo[] = [];
  let loading = true;
  let selectedShows = new Set<string>();
  
  // Filters
  let searchQuery = '';
  let activeTab = 'all';
  
  // Detail drawer state
  let showDetailDrawer = false;
  let selectedShowForDetail: ShowInfo | null = null;
  
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
  
  // 使用通用选择逻辑
  function toggleShow(path: string, event: MouseEvent) {
    selectedShows = handleItemClick(path, event, selectedShows, filteredShows, s => s.path);
  }
  
  function toggleAll() {
    selectedShows = toggleAllSelection(selectedShows, filteredShows, s => s.path);
  }
  
  function handleRowDoubleClick(show: ShowInfo) {
    selectedShowForDetail = show;
    showDetailDrawer = true;
  }
  
  function closeDetailDrawer() {
    showDetailDrawer = false;
    selectedShowForDetail = null;
  }
  
  function openSearchModal(show: ShowInfo) {
    selectedShowForDetail = show;
    showSearchModal = true;
  }
  
  async function handleTMDBSelect(event: CustomEvent<SearchResult>) {
    const result = event.detail;
    if (!selectedShowForDetail || isOperating) return;
    
    const showPath = selectedShowForDetail.path;
    showSearchModal = false;
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
    
    setTimeout(() => { operationMessage = ''; }, 3000);
  }
  
  // Batch operations - 批量刷新元数据
  async function batchRefreshMetadata() {
    if (isOperating) return;
    
    const paths = Array.from(selectedShows);
    const selectedShowsList = paths.map(p => shows.find(s => s.path === p)).filter((s): s is ShowInfo => s !== undefined);
    
    // Check if any shows don't have TMDB ID
    const needsMatching = selectedShowsList.filter(s => !s.tmdbId);
    if (needsMatching.length > 0) {
      operationMessage = `${needsMatching.length} 个剧集没有 TMDB ID，请先手动匹配`;
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
    
    for (const show of selectedShowsList) {
      operationMessage = `正在刷新 (${batchProgress.current + 1}/${batchProgress.total}): ${show.name}`;
      const result = await refreshMetadata('tv', show.path, show.tmdbId!);
      if (result.success) successCount++;
      else failCount++;
      
      batchProgress.current++;
      batchProgress = { ...batchProgress };
    }
    
    // Refresh data
    const updatedShows = await fetchTVShows();
    shows = [...updatedShows];
    
    operationMessage = `完成: ${successCount} 成功, ${failCount} 失败`;
    isOperating = false;
    selectedShows.clear();
    selectedShows = selectedShows;
    
    setTimeout(() => { 
      operationMessage = '';
      batchProgress = null;
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
  
  // Single show operations - 匹配 TMDB 或刷新元数据
  async function handleScrapeShow(show: ShowInfo) {
    if (isOperating) return;
    
    // 如果未刮削/无 TMDB ID → 自动匹配
    if (!show.tmdbId) {
      // 尝试自动匹配
      isOperating = true;
      operationMessage = '正在自动匹配...';
      
      try {
        const matchResult = await autoMatch(show.path, 'tv', show.name);
        
        if (matchResult.matched && matchResult.result) {
          // 自动匹配成功，执行刮削
          operationMessage = `匹配成功: ${matchResult.result.name}，正在创建元数据...`;
          const result = await refreshMetadata('tv', show.path, matchResult.result.id);
          operationMessage = result.success ? '元数据创建成功' : `失败: ${result.message}`;
        } else if (matchResult.candidates && matchResult.candidates.length > 0) {
          // 有多个候选，打开搜索模态框
          isOperating = false;
          operationMessage = '';
          openSearchModal(show);
          return;
        } else {
          // 无匹配结果
          isOperating = false;
          operationMessage = '未找到匹配结果，请手动搜索';
          setTimeout(() => { operationMessage = ''; }, 3000);
          openSearchModal(show);
          return;
        }
      } catch (err) {
        operationMessage = `匹配失败: ${err}`;
      }
      
      isOperating = false;
      shows = await fetchTVShows();
      if (selectedShowForDetail) {
        selectedShowForDetail = shows.find(s => s.path === selectedShowForDetail!.path) || null;
      }
      setTimeout(() => { operationMessage = ''; }, 3000);
      return;
    }
    
    // 已有 TMDB ID，刷新元数据
    await handleRefreshShow(show);
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
  
  // 刷新指定季的元数据
  async function handleRefreshSeason(season: number) {
    if (isOperating || !selectedShowForDetail?.tmdbId) return;
    isOperating = true;
    operationMessage = `正在刷新第 ${season} 季元数据...`;
    
    const result = await refreshMetadata('tv', selectedShowForDetail.path, selectedShowForDetail.tmdbId, { season });
    operationMessage = result.success ? `第 ${season} 季刷新成功` : `失败: ${result.message}`;
    isOperating = false;
    
    // Refresh shows
    shows = await fetchTVShows();
    if (selectedShowForDetail) {
      selectedShowForDetail = shows.find(s => s.path === selectedShowForDetail!.path) || null;
    }
    
    setTimeout(() => { operationMessage = ''; }, 3000);
  }
  
  // 刷新指定集的元数据
  async function handleRefreshEpisode(season: number, episode: number) {
    if (isOperating || !selectedShowForDetail?.tmdbId) return;
    isOperating = true;
    operationMessage = `正在刷新 S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')} 元数据...`;
    
    const result = await refreshMetadata('tv', selectedShowForDetail.path, selectedShowForDetail.tmdbId, { season, episode });
    operationMessage = result.success ? `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')} 刷新成功` : `失败: ${result.message}`;
    isOperating = false;
    
    setTimeout(() => { operationMessage = ''; }, 3000);
  }
  
  // 移回收件箱
  async function handleMoveToInbox(filePath: string, fileName: string) {
    if (isOperating) return;
    
    confirmDialog.show({
      title: '移回收件箱',
      message: `确定将「${fileName}」移回收件箱？`,
      onConfirm: async () => {
        isOperating = true;
        operationMessage = `正在移动: ${fileName}`;
        
        const result = await moveToInbox(filePath);
        operationMessage = result.success ? `已移回收件箱` : `失败: ${result.message}`;
        isOperating = false;
        
        // Refresh shows
        shows = await fetchTVShows();
        if (selectedShowForDetail) {
          selectedShowForDetail = shows.find(s => s.path === selectedShowForDetail!.path) || null;
        }
        
        setTimeout(() => { operationMessage = ''; }, 3000);
      }
    });
  }
  
  // Filtered shows based on current filters
  $: filteredShows = shows.filter(show => {
    // Tab filter
    if (activeTab === 'scraped' && show.groupStatus !== 'scraped') return false;
    if (activeTab === 'unscraped' && show.groupStatus !== 'unscraped') return false;
    
    // Search query
    if (searchQuery && !show.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    
    return true;
  });
  
  $: scrapedCount = shows.filter(s => s.groupStatus === 'scraped').length;
  $: unscrapedCount = shows.filter(s => s.groupStatus === 'unscraped').length;
</script>

<main class="container mx-auto px-4 py-8" class:pb-24={selectedShows.size > 0 || isOperating}>
  <!-- Toolbar -->
  <div class="mb-6 space-y-4">
    <div class="flex items-center justify-between flex-wrap gap-4">
      <div class="flex items-center gap-4 flex-wrap">
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" placeholder="搜索剧集..." class="h-9 w-64 rounded-md border border-input bg-background pl-9 pr-3 text-sm" bind:value={searchQuery} />
        </div>
      </div>
    </div>
    
    <div class="flex items-center justify-between flex-wrap gap-4">
      <!-- Tabs -->
      <div class="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
        <button class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all {activeTab === 'all' ? 'bg-background text-foreground shadow-sm' : ''}" on:click={() => activeTab = 'all'}>全部 ({shows.length})</button>
        <button class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all {activeTab === 'scraped' ? 'bg-background text-foreground shadow-sm' : ''}" on:click={() => activeTab = 'scraped'}>已刮削 ({scrapedCount})</button>
        <button class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all {activeTab === 'unscraped' ? 'bg-background text-foreground shadow-sm' : ''}" on:click={() => activeTab = 'unscraped'}>未刮削 ({unscrapedCount})</button>
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
            {@const badge = getGroupStatusBadge(show.groupStatus)}
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
              <td class="p-3 text-muted-foreground">{countTotalEpisodes(show.seasons) || '24'}</td>
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
  <BatchActionBar 
    show={selectedShows.size > 0 || isOperating}
    selectedCount={selectedShows.size}
    {isOperating}
    {operationMessage}
    progress={batchProgress}
    itemLabel="部剧集"
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
{#if showDetailDrawer && selectedShowForDetail}
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
            <p class="font-medium">{getGroupStatusBadge(selectedShowForDetail.groupStatus).label}</p>
          </div>
          <div>
            <p class="text-muted-foreground">季数</p>
            <p class="font-medium">{selectedShowForDetail.seasons.length}</p>
          </div>
          <div>
            <p class="text-muted-foreground">集数</p>
            <p class="font-medium">{countTotalEpisodes(selectedShowForDetail.seasons) || 24}</p>
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
        
        <!-- 季/集分组展示 -->
        <div>
          <p class="text-sm text-muted-foreground mb-2">季/集文件</p>
          <div class="space-y-2 max-h-80 overflow-y-auto">
            {#each sortSeasons(selectedShowForDetail.seasons) as seasonItem}
              <details class="group">
                <summary class="flex items-center justify-between cursor-pointer p-2 rounded-md bg-muted/50 hover:bg-muted">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium">第 {seasonItem.season} 季</span>
                    <span class="text-xs text-muted-foreground">{seasonItem.episodes.length} 集</span>
                  </div>
                  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                  <div class="flex items-center gap-1" on:click|stopPropagation>
                    <button 
                      class="inline-flex items-center justify-center rounded h-6 w-6 hover:bg-accent text-muted-foreground hover:text-foreground"
                      title="刷新该季元数据"
                      disabled={isOperating || !selectedShowForDetail?.tmdbId}
                      on:click={() => handleRefreshSeason(seasonItem.season)}
                    >
                      <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                    </button>
                  </div>
                </summary>
                <div class="mt-1 ml-4 space-y-1">
                  {#each sortEpisodes(seasonItem.episodes) as ep}
                    <div class="flex items-center justify-between p-2 rounded-md hover:bg-muted/30 text-xs group/ep">
                      <div class="flex items-center gap-2 flex-1 min-w-0">
                        <span class="text-muted-foreground shrink-0">E{String(ep.parsed.episode || 0).padStart(2, '0')}</span>
                        <span class="truncate" title={ep.name}>{ep.name}</span>
                      </div>
                      <div class="flex items-center gap-1 shrink-0 ml-2">
                        <span class="text-muted-foreground mr-2">{(ep.size / 1024 / 1024 / 1024).toFixed(2)} GB</span>
                        <button 
                          class="inline-flex items-center justify-center rounded h-5 w-5 opacity-0 group-hover/ep:opacity-100 hover:bg-accent text-muted-foreground hover:text-foreground transition-opacity"
                          title="刷新该集元数据"
                          disabled={isOperating || !selectedShowForDetail?.tmdbId}
                          on:click={() => handleRefreshEpisode(seasonItem.season, ep.parsed.episode || 0)}
                        >
                          <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                        </button>
                        <button 
                          class="inline-flex items-center justify-center rounded h-5 w-5 opacity-0 group-hover/ep:opacity-100 hover:bg-accent text-orange-500 hover:text-orange-600 transition-opacity"
                          title="移回收件箱"
                          disabled={isOperating}
                          on:click={() => handleMoveToInbox(ep.path, ep.name)}
                        >
                          <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
                        </button>
                      </div>
                    </div>
                  {/each}
                </div>
              </details>
            {/each}
          </div>
        </div>
        
        <div class="space-y-2">
          <p class="text-sm text-muted-foreground">操作</p>
          <div class="flex flex-wrap gap-2">
            {#if !selectedShowForDetail?.tmdbId}
              <button 
                class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                disabled={isOperating}
                on:click={() => { if (selectedShowForDetail) handleScrapeShow(selectedShowForDetail); }}
              >
                {isOperating ? '处理中...' : '自动匹配'}
              </button>
            {:else}
              <button 
                class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                disabled={isOperating}
                on:click={() => { if (selectedShowForDetail) handleRefreshShow(selectedShowForDetail); }}
              >
                {isOperating ? '处理中...' : '刷新元数据'}
              </button>
            {/if}
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
<TMDBSearchModal
  bind:show={showSearchModal}
  type="tv"
  initialQuery={selectedShowForDetail?.name || ''}
  on:select={handleTMDBSelect}
  on:close={() => showSearchModal = false}
/>

<style lang="postcss">
  @reference "tailwindcss";
</style>
