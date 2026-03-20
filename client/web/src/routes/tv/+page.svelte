<script lang="ts">
  import { onMount } from 'svelte';
  import { getShowMissingEpisodes } from '@media-scraper/shared/format';
  import { fetchTVShowDetail, fetchTVShows, refreshMetadata, autoMatch, moveToInbox, type ShowInfo, type SearchResult } from '$lib/api';
  import { handleItemClick, toggleAllSelection } from '$lib/selection';
  import { getGroupStatusBadge } from '$lib/format';
  import { TMDBSearchModal, BatchActionBar, SearchToolbar } from '$lib/components';
  import type { ActionButton } from '$lib/components/mediaDetailActions';
  import { confirmDialog } from '$lib/stores';
  import { getFanartUrl } from '$lib/mediaDetail';
  import {
    buildBatchRefreshPlan,
    buildMissingTmdbMessage,
    buildRefreshCompletedMessage,
    executeBatchRefresh,
  } from '$lib/libraryBatch';
  import { buildShowMetaItems } from '$lib/tvDetail';
  import { buildShowPrimaryActionLabel, countShowsByStatus, filterShows, toggleSeasonSet } from '$lib/tvPage';
  import TVShowTable from '$lib/components/tv/TVShowTable.svelte';
  import TVShowDetailDrawer from '$lib/components/tv/TVShowDetailDrawer.svelte';
  
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

  function toggleShowSelection(path: string) {
    const nextSelected = new Set(selectedShows);
    if (nextSelected.has(path)) {
      nextSelected.delete(path);
    } else {
      nextSelected.add(path);
    }
    selectedShows = nextSelected;
  }

  async function loadShows({ syncDetail = true } = {}) {
    const nextShows = [...await fetchTVShows()];
    shows = nextShows;
    if (syncDetail) {
      selectedShowForDetail = selectedShowForDetail
        ? nextShows.find(item => item.path === selectedShowForDetail?.path) || null
        : null;
    }
  }

  function clearOperationMessage(delay = 3000) {
    return setTimeout(() => {
      operationMessage = '';
    }, delay);
  }

  function getRefreshResultMessage(result: { success: boolean; message?: string }, successMessage: string) {
    return result.success ? successMessage : `失败: ${result.message || '未知错误'}`;
  }
  
  // 使用通用选择逻辑
  function toggleShow(path: string, event: MouseEvent) {
    selectedShows = handleItemClick(path, event, selectedShows, filteredShows, s => s.path);
  }
  
  function toggleAll() {
    selectedShows = toggleAllSelection(selectedShows, filteredShows, s => s.path);
  }

  function toggleShowCheckbox(path: string, event: MouseEvent) {
    event.stopPropagation();
    toggleShowSelection(path);
  }
  
  async function handleRowDoubleClick(show: ShowInfo) {
    overviewExpanded = false;
    openSeasons = new Set();
    selectedShowForDetail = show.detailLoaded ? show : (await fetchTVShowDetail(show.path)) || show;
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
        await loadShows();
        loading = false;
        operationMessage = '匹配成功';
      } else {
        operationMessage = `匹配失败: ${res.message || '未知错误'}`;
      }
    } catch (e) {
      operationMessage = `错误: ${e}`;
    }
    
    isOperating = false;
    
    clearOperationMessage();
  }
  
  // Batch operations - 批量刷新元数据
  async function batchRefreshMetadata() {
    if (isOperating) return;

    const plan = buildBatchRefreshPlan(shows, selectedShows);
    if (plan.missingTmdbCount > 0) {
      operationMessage = buildMissingTmdbMessage(plan.missingTmdbCount, '个剧集');
      clearOperationMessage();
      return;
    }

    isOperating = true;
    operationMessage = '正在刷新元数据...';

    batchProgress = { current: 0, total: plan.targets.length };
    const { successCount, failCount } = await executeBatchRefresh('tv', plan.targets, refreshMetadata, ({ current, total, message }) => {
      operationMessage = message;
      batchProgress = { current, total };
    });
    
    // Refresh data
    await loadShows();
    
    operationMessage = buildRefreshCompletedMessage(successCount, failCount);
    isOperating = false;
    selectedShows = new Set();
    
    setTimeout(() => {
      operationMessage = '';
      batchProgress = null;
    }, 2000);
  }
  
  function batchRematch() {
    // For batch rematch, show modal with first selected show
    const firstPath = selectedShows.values().next().value;
    const show = firstPath ? shows.find(item => item.path === firstPath) || null : null;
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
        const matchResult = await autoMatch(show.path, show.name);
        
        if (matchResult.matched && matchResult.result) {
          // 自动匹配成功，执行刮削
          operationMessage = `匹配成功: ${matchResult.result.name}，正在创建元数据...`;
          const result = await refreshMetadata('tv', show.path, matchResult.result.id);
          operationMessage = getRefreshResultMessage(result, '元数据创建成功');
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
          clearOperationMessage();
          openSearchModal(show);
          return;
        }
      } catch (err) {
        operationMessage = `匹配失败: ${String(err) || '未知错误'}`;
      }
      
      isOperating = false;
      await loadShows();
      clearOperationMessage();
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
    operationMessage = getRefreshResultMessage(result, '刷新成功');
    isOperating = false;
    
    // Refresh shows
    await loadShows();
    
    clearOperationMessage();
  }
  
  // 刷新指定季的元数据
  async function handleRefreshSeason(season: number) {
    if (isOperating || !selectedShowForDetail?.tmdbId) return;
    isOperating = true;
    operationMessage = `正在刷新第 ${season} 季元数据...`;
    
    const result = await refreshMetadata('tv', selectedShowForDetail.path, selectedShowForDetail.tmdbId, { season });
    operationMessage = getRefreshResultMessage(result, `第 ${season} 季刷新成功`);
    isOperating = false;
    
    // Refresh shows
    await loadShows();
    
    clearOperationMessage();
  }
  
  // 刷新指定集的元数据
  async function handleRefreshEpisode(season: number, episode: number) {
    if (isOperating || !selectedShowForDetail?.tmdbId) return;
    isOperating = true;
    operationMessage = `正在刷新 S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')} 元数据...`;
    
    const result = await refreshMetadata('tv', selectedShowForDetail.path, selectedShowForDetail.tmdbId, { season, episode });
    operationMessage = getRefreshResultMessage(result, `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')} 刷新成功`);
    isOperating = false;
    
    clearOperationMessage();
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
        operationMessage = getRefreshResultMessage(result, '已移回收件箱');
        isOperating = false;
        
        // Refresh shows
        await loadShows();
        
        clearOperationMessage();
      }
    });
  }
  
  // Filtered shows based on current filters
  const filteredShows = $derived.by(() => filterShows(shows, activeTab, searchQuery));
  const showCounts = $derived.by(() => countShowsByStatus(shows));
  const scrapedCount = $derived.by(() => showCounts.scraped);
  const unscrapedCount = $derived.by(() => showCounts.unscraped);

  function toggleSeason(season: number) {
    openSeasons = toggleSeasonSet(openSeasons, season);
  }

  const showStatusBadge = $derived.by(() => getGroupStatusBadge(selectedShowForDetail?.groupStatus));

  const showFanartUrl = $derived.by(() => 
    getFanartUrl(selectedShowForDetail?.path, selectedShowForDetail?.assets?.hasFanart)
  );

  const showMetaItems = $derived.by(() => {
    return buildShowMetaItems(selectedShowForDetail);
  });

  const showOverview = $derived.by(() => selectedShowForDetail?.overview?.trim() || '');
  
  const showMissingEpisodes = $derived.by(() => 
    selectedShowForDetail ? getShowMissingEpisodes(selectedShowForDetail) : []
  );
  
  const showDetailActions = $derived.by((): ActionButton[] => {
    if (!selectedShowForDetail) return [];
    const show = selectedShowForDetail;
    const isMatched = !!show.tmdbId;
    const label = buildShowPrimaryActionLabel(show.tmdbId, isOperating);
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
  <TVShowTable
    {loading}
    {filteredShows}
    {selectedShows}
    onToggleAll={toggleAll}
    onToggleShow={toggleShow}
    onToggleCheckbox={toggleShowCheckbox}
    onOpenDetail={handleRowDoubleClick}
    onOpenSearch={openSearchModal}
  />
  
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
<TVShowDetailDrawer
  show={selectedShowForDetail}
  visible={showDetailDrawer}
  showFanartUrl={showFanartUrl || ''}
  {showMetaItems}
  {showStatusBadge}
  {showMissingEpisodes}
  bind:overviewExpanded
  {openSeasons}
  {isOperating}
  {operationMessage}
  actions={showDetailActions}
  onClose={closeDetailDrawer}
  onToggleSeason={toggleSeason}
  onRefreshSeason={handleRefreshSeason}
  onRefreshEpisode={handleRefreshEpisode}
  onMoveToInbox={handleMoveToInbox}
/>

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
</style>
