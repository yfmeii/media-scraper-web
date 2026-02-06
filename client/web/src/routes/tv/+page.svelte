<script lang="ts">
  import { onMount } from 'svelte';
  import { fly, slide } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { quintOut, cubicOut } from 'svelte/easing';
  import { fetchTVShows, refreshMetadata, autoMatch, moveToInbox, type ShowInfo, type SearchResult } from '$lib/api';
  import type { SeasonInfo, MediaFile } from '@media-scraper/shared';
  import { getSeasonMissingEpisodes, getShowMissingEpisodes, formatMissingSxEx } from '@media-scraper/shared';
  import { handleItemClick, toggleAllSelection } from '$lib/selection';
  import { formatFileSize, getGroupStatusBadge } from '$lib/format';
  import { TMDBSearchModal, BatchActionBar, TableSkeleton, PosterThumbnail, AssetIndicators, StatusBadge, SearchToolbar, MediaDetailHeader, MediaOverview, MediaDetailActions, DetailDrawer } from '$lib/components';
  import type { ActionButton } from '$lib/components/mediaDetailActions';
  import { confirmDialog } from '$lib/stores';
  import { copyPath, detailDelay, getFanartUrl } from '$lib/mediaDetail';
  import { runBatchRefresh } from '$lib/batchRefresh';
  
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
  let batchProgress = $state<{ current: number; total: number } | null>(null);
  
  onMount(async () => {
    try {
      shows = await fetchTVShows();
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
    
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

    const targets = selectedShowsList.map(show => ({
      path: show.path,
      name: show.name,
      tmdbId: show.tmdbId!,
    }));

    batchProgress = { current: 0, total: targets.length };
    const { successCount, failCount } = await runBatchRefresh(
      'tv',
      targets,
      refreshMetadata,
      ({ current, total, target }) => {
        operationMessage = `正在刷新 (${current}/${total}): ${target.name}`;
        batchProgress = { current, total };
      },
    );
    
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
  
  const showMissingEpisodes = $derived.by(() => 
    selectedShowForDetail ? getShowMissingEpisodes(selectedShowForDetail) : []
  );
  
  const showDetailActions = $derived.by((): ActionButton[] => {
    if (!selectedShowForDetail) return [];
    const show = selectedShowForDetail;
    const isMatched = !!show.tmdbId;
    const label = isOperating ? '处理中...' : (isMatched ? '刷新元数据' : '自动匹配');
    return [
      {
        label,
        icon: isMatched ? 'refresh' : 'upload',
        variant: 'primary',
        disabled: isOperating,
        onclick: () => {
          if (isMatched) {
            handleRefreshShow(show);
          } else {
            handleScrapeShow(show);
          }
        },
      },
      {
        label: '重新匹配',
        icon: 'search',
        variant: 'secondary',
        disabled: false,
        onclick: () => {
          const target = selectedShowForDetail;
          closeDetailDrawer();
          if (target) openSearchModal(target);
        },
      },
    ];
  });
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
            <th class="w-28 p-3 text-left font-medium">缺集</th>
            <th class="w-32 p-3 text-left font-medium">状态</th>
            <th class="w-40 p-3 text-left font-medium">完整性</th>
            <th class="w-40 p-3 text-left font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredShows as show (show.path)}
            {@const missingInfo = getShowMissingEpisodes(show)}
            {@const totalMissing = missingInfo.reduce((sum, s) => sum + s.missing.length, 0)}
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
                {#if totalMissing > 0}
                  <span 
                    class="inline-flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-500 cursor-help"
                    title={formatMissingSxEx(missingInfo)}
                  >
                    <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    缺 {totalMissing} 集
                  </span>
                {:else}
                  <span class="text-xs text-muted-foreground">—</span>
                {/if}
              </td>
              <td class="p-3">
                <StatusBadge status={show.groupStatus} />
              </td>
              <td class="p-3">
                <AssetIndicators assets={{ hasPoster: show.assets?.hasPoster, hasNfo: show.assets?.hasNfo }} showFanart={false} />
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
  <DetailDrawer show={showDetailDrawer} onClose={closeDetailDrawer} title={selectedShowForDetail.name}>
    <MediaDetailHeader
      fanartUrl={showFanartUrl}
      posterPath={selectedShowForDetail.posterPath}
      title={selectedShowForDetail.name}
      metaItems={showMetaItems}
      statusBadge={showStatusBadge}
      animationDelay={detailDelay(0)}
    />

    <div class="px-4 pb-6 pt-2 space-y-6">
      <MediaOverview
        overview={showOverview}
        maxLength={140}
        bind:expanded={overviewExpanded}
        animationDelay={detailDelay(1)}
        lineClampClass="line-clamp-3"
      />

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

      {#if showMissingEpisodes.length > 0}
        <section class="space-y-2" in:fly={{ y: 18, duration: 300, delay: detailDelay(3), easing: quintOut }}>
          <div class="flex items-center gap-2">
            <svg class="h-4 w-4 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <h3 class="text-sm font-semibold text-orange-500">缺集检测</h3>
          </div>
          <div class="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
            <div class="flex flex-wrap gap-1.5">
              {#each showMissingEpisodes as item}
                {#each item.missing as epNum}
                  <span class="inline-flex items-center rounded border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-xs font-mono text-orange-500">
                    S{String(item.season).padStart(2, '0')}E{String(epNum).padStart(2, '0')}
                  </span>
                {/each}
              {/each}
            </div>
            <p class="mt-2 text-[11px] text-muted-foreground">
              共缺 {showMissingEpisodes.reduce((sum, s) => sum + s.missing.length, 0)} 集，检测逻辑：每季最小集号到最大集号之间的空缺
            </p>
          </div>
        </section>
      {/if}

      <section class="space-y-3" in:fly={{ y: 18, duration: 300, delay: detailDelay(showMissingEpisodes.length > 0 ? 4 : 3), easing: quintOut }}>
        <h3 class="text-sm font-semibold">季/集文件</h3>
        <div class="space-y-3">
          {#each sortSeasons(selectedShowForDetail.seasons) as seasonItem (seasonItem.season)}
            {@const seasonMissing = getSeasonMissingEpisodes(seasonItem.episodes)}
            <div class="rounded-lg border {seasonMissing.length > 0 ? 'border-orange-500/40' : 'border-border/60'} bg-muted/30">
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
                  {#if seasonMissing.length > 0}
                    <span class="inline-flex items-center gap-0.5 rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[11px] font-medium text-orange-500">
                      <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                      缺 {seasonMissing.length} 集
                    </span>
                  {/if}
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

    {#snippet footer()}
      <MediaDetailActions actions={showDetailActions} operationMessage={operationMessage} />
    {/snippet}
  </DetailDrawer>
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
