<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, fly, slide } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { quintOut, cubicOut } from 'svelte/easing';
  import { fetchTVShows, refreshMetadata, autoMatch, subscribeToProgress, moveToInbox, type ShowInfo, type SearchResult } from '$lib/api';
  import type { SeasonInfo, MediaFile } from '@media-scraper/shared';
  import { handleItemClick, toggleAllSelection } from '$lib/selection';
  import { createProgressHandler } from '$lib/progress';
  import { formatFileSize } from '$lib/format';
  import { TMDBSearchModal, BatchActionBar, TableSkeleton, PosterThumbnail, AssetIndicators, StatusBadge, SearchToolbar } from '$lib/components';
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
  
  let shows = $state<ShowInfo[]>([]);
  let loading = $state(true);
  let selectedShows = $state(new Set<string>());
  
  // Filters
  let searchQuery = $state('');
  let activeTab = $state('all');
  
  // Detail drawer state
  let showDetailDrawer = $state(false);
  let selectedShowForDetail = $state<ShowInfo | null>(null);
  let overviewExpanded = $state(false);
  let openSeasons = $state(new Set<number>());
  
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
    overviewExpanded = false;
    openSeasons = new Set();
    selectedShowForDetail = show;
    showDetailDrawer = true;
  }
  
  function closeDetailDrawer() {
    showDetailDrawer = false;
    selectedShowForDetail = null;
    overviewExpanded = false;
    openSeasons = new Set();
  }
  
  function openSearchModal(show: ShowInfo) {
    selectedShowForDetail = show;
    showSearchModal = true;
  }
  
  async function handleTMDBSelect(result: SearchResult) {
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
    progressMap = new Map(progressMap);
    
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
    selectedShows = new Set();
    
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
  const filteredShows = $derived.by(() => (
    shows.filter(show => {
      // Tab filter
      if (activeTab === 'scraped' && show.groupStatus !== 'scraped') return false;
      if (activeTab === 'unscraped' && show.groupStatus !== 'unscraped') return false;
      
      // Search query
      if (searchQuery && !show.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      
      return true;
    })
  ));
  
  const scrapedCount = $derived.by(() => shows.filter(s => s.groupStatus === 'scraped').length);
  const unscrapedCount = $derived.by(() => shows.filter(s => s.groupStatus === 'unscraped').length);

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

  function toggleSeason(season: number) {
    if (openSeasons.has(season)) openSeasons.delete(season);
    else openSeasons.add(season);
    openSeasons = new Set(openSeasons);
  }

  const showStatusBadge = $derived.by(() => getGroupStatusBadge(selectedShowForDetail?.groupStatus));

  const showFanartUrl = $derived.by(() => 
    getFanartUrl(selectedShowForDetail?.path, selectedShowForDetail?.assets?.hasFanart)
  );

  const showMetaItems = $derived.by(() => {
    if (!selectedShowForDetail) return [];
    const items: string[] = [];
    if (typeof selectedShowForDetail.voteAverage === 'number') {
      items.push(`评分 ${selectedShowForDetail.voteAverage.toFixed(1)}`);
    }
    if (selectedShowForDetail.year) items.push(String(selectedShowForDetail.year));
    if (selectedShowForDetail.status) items.push(selectedShowForDetail.status);
    items.push(`${selectedShowForDetail.seasons.length} 季`);
    const episodeCount = countTotalEpisodes(selectedShowForDetail.seasons);
    if (episodeCount) items.push(`${episodeCount} 集`);
    return items;
  });

  const showOverview = $derived.by(() => selectedShowForDetail?.overview?.trim() || '');
  const canExpandShowOverview = $derived.by(() => showOverview.length > 140);
</script>

<main class="container mx-auto px-4 py-8" class:pb-24={selectedShows.size > 0 || isOperating}>
  <!-- Toolbar -->
  <SearchToolbar 
    searchPlaceholder="搜索剧集..."
    bind:searchQuery
    tabs={[
      { id: 'all', label: '全部', count: shows.length },
      { id: 'scraped', label: '已刮削', count: scrapedCount },
      { id: 'unscraped', label: '未刮削', count: unscrapedCount }
    ]}
    bind:activeTab
  />
  
  <!-- Table -->
  <div class="rounded-lg border border-border bg-card overflow-hidden">
    {#if loading}
      <TableSkeleton rows={8} columns={6} />
    {:else if filteredShows.length === 0}
      <div class="p-8 text-center text-muted-foreground">没有找到符合条件的剧集</div>
    {:else}
      <table class="w-full">
        <thead class="bg-card">
          <tr class="border-b border-border text-xs text-muted-foreground">
            <th class="w-12 p-3 text-left"><input type="checkbox" class="h-4 w-4 rounded border-input accent-primary" checked={selectedShows.size === filteredShows.length && filteredShows.length > 0} onchange={toggleAll} /></th>
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
          {#each filteredShows as show (show.path)}
            <tr 
              class="border-b border-border hover:bg-accent/50 cursor-pointer {selectedShows.has(show.path) ? 'bg-accent/30 border-l-2 border-l-primary' : ''} transition-colors duration-150"
              onclick={(e) => toggleShow(show.path, e)}
              ondblclick={() => handleRowDoubleClick(show)}
              animate:flip={{ duration: 300, easing: quintOut }}
              in:fly={{ y: 20, duration: 300, easing: cubicOut }}
            >
              <td class="p-3">
                <input 
                  type="checkbox" 
                  class="h-4 w-4 rounded border-input accent-primary" 
                  checked={selectedShows.has(show.path)} 
                  onclick={(e) => {
                    e.stopPropagation();
                    if (selectedShows.has(show.path)) {
                      selectedShows.delete(show.path);
                    } else {
                      selectedShows.add(show.path);
                    }
                    selectedShows = new Set(selectedShows);
                  }}
                />
              </td>
              <td class="p-3">
                <PosterThumbnail src={show.posterPath} alt={show.name} hasPoster={show.assets?.hasPoster} size="sm" />
              </td>
              <td class="p-3"><div class="font-medium">{show.name}</div></td>
              <td class="p-3 text-muted-foreground">{show.seasons.length}</td>
              <td class="p-3 text-muted-foreground">{countTotalEpisodes(show.seasons) || '24'}</td>
              <td class="p-3">
                <StatusBadge status={show.groupStatus} />
              </td>
              <td class="p-3">
                <AssetIndicators assets={{ hasPoster: show.assets?.hasPoster, hasNfo: show.assets?.hasNfo }} showLabels={true} />
              </td>
              <td class="p-3">
                <div class="flex gap-1">
                  <button 
                    class="inline-flex items-center justify-center rounded-md text-xs font-medium h-7 px-2 border border-input bg-background hover:bg-accent"
                    onclick={(e) => {
                      e.stopPropagation();
                      handleRowDoubleClick(show);
                    }}
                  >
                    详情
                  </button>
                  <button 
                    class="inline-flex items-center justify-center rounded-md text-xs font-medium h-7 px-2 border border-input bg-background hover:bg-accent"
                    onclick={(e) => {
                      e.stopPropagation();
                      openSearchModal(show);
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
  
  <!-- Bottom Bar (appears when items selected or operating) -->
  <BatchActionBar 
    show={selectedShows.size > 0 || isOperating}
    selectedCount={selectedShows.size}
    {isOperating}
    {operationMessage}
    progress={batchProgress}
    itemLabel="部剧集"
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
{#if showDetailDrawer && selectedShowForDetail}
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
              style={showFanartUrl ? `background-image: url('${showFanartUrl}')` : ''}
            ></div>
            <div class="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent"></div>
            <button class="absolute right-4 top-4 inline-flex items-center justify-center rounded-md h-8 w-8 bg-background/70 hover:bg-background" aria-label="关闭详情" onclick={closeDetailDrawer}>
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          <div class="relative -mt-16 px-4 pb-4 flex gap-4 items-end" in:fly={{ y: 18, duration: 300, delay: detailDelay(0), easing: quintOut }}>
            <div class="h-28 w-20 rounded-lg overflow-hidden shadow-2xl shadow-black/50 bg-muted border border-border">
              {#if selectedShowForDetail.posterPath}
                <img src={selectedShowForDetail.posterPath} alt={selectedShowForDetail.name} class="h-full w-full object-cover" />
              {:else}
                <div class="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground">No Poster</div>
              {/if}
            </div>
            <div class="min-w-0 pb-2">
              <h2 class="text-2xl font-semibold tracking-tight">{selectedShowForDetail.name}</h2>
              <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {#each showMetaItems as item}
                  <span class="rounded-full border border-border/60 bg-background/60 px-2 py-0.5">{item}</span>
                {/each}
                <span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 {showStatusBadge.bgColor} {showStatusBadge.border} {showStatusBadge.color}">
                  {showStatusBadge.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto px-4 pb-6 pt-2 space-y-6 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
          <section class="space-y-2" in:fly={{ y: 18, duration: 300, delay: detailDelay(1), easing: quintOut }}>
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold">剧情简介</h3>
              {#if showOverview && canExpandShowOverview}
                <button class="text-xs text-muted-foreground hover:text-foreground" onclick={() => { overviewExpanded = !overviewExpanded; }}>
                  {overviewExpanded ? '收起' : '展开'}
                </button>
              {/if}
            </div>
            <p class="text-sm text-muted-foreground leading-relaxed {showOverview && !overviewExpanded && canExpandShowOverview ? 'line-clamp-3' : ''}">
              {showOverview || '暂无简介'}
            </p>
          </section>

          <section class="space-y-3" in:fly={{ y: 18, duration: 300, delay: detailDelay(2), easing: quintOut }}>
            <h3 class="text-sm font-semibold">元数据</h3>
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div class="rounded-lg border border-border/60 bg-muted/30 p-3">
                <p class="text-xs text-muted-foreground">TMDB</p>
                {#if selectedShowForDetail.tmdbId}
                  <a 
                    class="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:opacity-80"
                    href={`https://www.themoviedb.org/tv/${selectedShowForDetail.tmdbId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    #{selectedShowForDetail.tmdbId}
                    <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
                  </a>
                {:else}
                  <p class="mt-1 text-sm font-medium">未匹配</p>
                {/if}
              </div>
              <div class="rounded-lg border border-border/60 bg-muted/30 p-3">
                <p class="text-xs text-muted-foreground">状态</p>
                <span class="mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-xs {showStatusBadge.bgColor} {showStatusBadge.border} {showStatusBadge.color}">
                  {showStatusBadge.label}
                </span>
              </div>
              <button 
                class="col-span-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-left hover:bg-muted/50"
                title="点击复制路径"
                onclick={() => copyPath(selectedShowForDetail?.path)}
              >
                <p class="text-xs text-muted-foreground">路径</p>
                <p class="mt-1 font-mono text-xs break-all">{selectedShowForDetail.path}</p>
                <p class="mt-1 text-[11px] text-muted-foreground">点击复制</p>
              </button>
              <div class="col-span-2 rounded-lg border border-border/60 bg-muted/30 p-3">
                <p class="text-xs text-muted-foreground">资源完整性</p>
                <div class="mt-2 flex flex-wrap gap-3">
                  <span class="flex items-center gap-1 text-xs {selectedShowForDetail.assets?.hasPoster ? 'text-green-500' : 'text-red-500'}">
                    {#if selectedShowForDetail.assets?.hasPoster}
                      <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                    {:else}
                      <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                    {/if}
                    海报
                  </span>
                  <span class="flex items-center gap-1 text-xs {selectedShowForDetail.assets?.hasNfo ? 'text-green-500' : 'text-red-500'}">
                    {#if selectedShowForDetail.assets?.hasNfo}
                      <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                    {:else}
                      <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                    {/if}
                    NFO
                  </span>
                  <span class="flex items-center gap-1 text-xs {selectedShowForDetail.assets?.hasFanart ? 'text-green-500' : 'text-red-500'}">
                    {#if selectedShowForDetail.assets?.hasFanart}
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
            <h3 class="text-sm font-semibold">季/集文件</h3>
            <div class="space-y-3">
              {#each sortSeasons(selectedShowForDetail.seasons) as seasonItem (seasonItem.season)}
                <div class="rounded-lg border border-border/60 bg-muted/30">
                  <div 
                    class="flex items-center justify-between gap-3 p-3 cursor-pointer hover:bg-muted/50"
                    role="button"
                    tabindex="0"
                    aria-expanded={openSeasons.has(seasonItem.season)}
                    onclick={() => toggleSeason(seasonItem.season)}
                    onkeydown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSeason(seasonItem.season);
                      }
                    }}
                  >
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium">第 {seasonItem.season} 季</span>
                      <span class="text-xs text-muted-foreground">{seasonItem.episodes.length} 集</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <button 
                        class="inline-flex items-center justify-center rounded h-6 w-6 hover:bg-accent text-muted-foreground hover:text-foreground"
                        title="刷新该季元数据"
                        disabled={isOperating || !selectedShowForDetail?.tmdbId}
                        onclick={(e) => {
                          e.stopPropagation();
                          handleRefreshSeason(seasonItem.season);
                        }}
                      >
                        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                      </button>
                      <svg class="h-4 w-4 text-muted-foreground transition-transform {openSeasons.has(seasonItem.season) ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                  {#if openSeasons.has(seasonItem.season)}
                    <div class="px-3 pb-3 space-y-1" transition:slide={{ duration: 200 }}>
                      {#each sortEpisodes(seasonItem.episodes) as ep}
                        <div class="flex items-center justify-between p-2 rounded-md hover:bg-muted/30 text-xs group/ep">
                          <div class="flex items-center gap-2 flex-1 min-w-0">
                            <span class="text-muted-foreground shrink-0">E{String(ep.parsed.episode || 0).padStart(2, '0')}</span>
                            <span class="truncate" title={ep.name}>{ep.name}</span>
                          </div>
                          <div class="flex items-center gap-1 shrink-0 ml-2">
                            <span class="text-muted-foreground mr-2">{formatFileSize(ep.size)}</span>
                            <button 
                              class="inline-flex items-center justify-center rounded h-5 w-5 opacity-0 group-hover/ep:opacity-100 hover:bg-accent text-muted-foreground hover:text-foreground transition-opacity"
                              title="刷新该集元数据"
                              disabled={isOperating || !selectedShowForDetail?.tmdbId}
                              onclick={() => handleRefreshEpisode(seasonItem.season, ep.parsed.episode || 0)}
                            >
                              <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                            </button>
                            <button 
                              class="inline-flex items-center justify-center rounded h-5 w-5 opacity-0 group-hover/ep:opacity-100 hover:bg-accent text-orange-500 hover:text-orange-600 transition-opacity"
                              title="移回收件箱"
                              disabled={isOperating}
                              onclick={() => handleMoveToInbox(ep.path, ep.name)}
                            >
                              <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
                            </button>
                          </div>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/each}
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
            {#if !selectedShowForDetail?.tmdbId}
              <button 
                class="flex-1 inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                disabled={isOperating}
                onclick={() => { if (selectedShowForDetail) handleScrapeShow(selectedShowForDetail); }}
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="m5 12 7-7 7 7"/>
                  <path d="M12 19V5"/>
                </svg>
                {isOperating ? '处理中...' : '自动匹配'}
              </button>
            {:else}
              <button 
                class="flex-1 inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                disabled={isOperating}
                onclick={() => { if (selectedShowForDetail) handleRefreshShow(selectedShowForDetail); }}
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                  <path d="M16 16h5v5"/>
                </svg>
                {isOperating ? '处理中...' : '刷新元数据'}
              </button>
            {/if}
            <button 
              class="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium h-10 px-4 border border-border bg-background hover:bg-accent transition-colors"
              onclick={() => { 
                const show = selectedShowForDetail;
                closeDetailDrawer();
                if (show) openSearchModal(show);
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
  type="tv"
  initialQuery={selectedShowForDetail?.name || ''}
  onSelect={handleTMDBSelect}
  onClose={() => { showSearchModal = false; }}
/>

<style lang="postcss">
  @reference "tailwindcss";

  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
