<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchMovieDetail, fetchMovies, refreshMetadata, type MovieInfo, type SearchResult } from '$lib/api';
  import { handleItemClick, toggleAllSelection } from '$lib/selection';
  import { getGroupStatusBadge } from '$lib/format';
  import { TMDBSearchModal, BatchActionBar, SearchToolbar, MovieTable, MovieDetailDrawer } from '$lib/components';
  import type { ActionButton } from '$lib/components/mediaDetailActions';
  import { getFanartUrl } from '$lib/mediaDetail';
  import { buildMovieMetaItems, countMoviesByProcessed, filterMovies } from '$lib/moviePage';
  import {
    buildBatchRefreshPlan,
    buildMissingTmdbMessage,
    buildRefreshCompletedMessage,
    executeBatchRefresh,
  } from '$lib/libraryBatch';
  import {
    buildErrorMessage,
    buildMatchFailureMessage,
    buildMatchStartMessage,
    buildRefreshResultMessage,
    reloadLibraryItems,
    withClearedMessage,
  } from '$lib/libraryDetailOps';
  
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
  let batchProgress = $state<{ current: number; total: number } | null>(null);
  
  onMount(async () => {
    try {
      movies = await fetchMovies();
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
    
  });
  
  // 使用通用选择逻辑
  function toggleMovie(path: string, event: MouseEvent) {
    selectedMovies = handleItemClick(path, event, selectedMovies, filteredMovies, m => m.path);
  }
  
  function toggleAll() {
    selectedMovies = toggleAllSelection(selectedMovies, filteredMovies, m => m.path);
  }

  function toggleMovieSelection(path: string, event: MouseEvent) {
    event.stopPropagation();
    const nextSelected = new Set(selectedMovies);
    if (nextSelected.has(path)) {
      nextSelected.delete(path);
    } else {
      nextSelected.add(path);
    }
    selectedMovies = nextSelected;
  }
  
  async function handleRowDoubleClick(movie: MovieInfo) {
    overviewExpanded = false;
    selectedMovieForDetail = movie.detailLoaded ? movie : (await fetchMovieDetail(movie.path)) || movie;
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
    operationMessage = buildMatchStartMessage(result);
    
    try {
      const res = await refreshMetadata('movie', moviePath, result.id);
      
      if (res.success) {
        operationMessage = '匹配成功，已创建元数据';
        loading = true;
        movies = [];
        movies = await reloadLibraryItems(fetchMovies);
        loading = false;
      } else {
        operationMessage = buildMatchFailureMessage(res.message);
      }
    } catch (e) {
      operationMessage = buildErrorMessage(e);
    }
    
    isOperating = false;
    
    withClearedMessage(() => { operationMessage = ''; });
  }
  
  // Batch operations - 批量刷新元数据
  async function batchRefreshMetadata() {
    if (isOperating) return;

    const plan = buildBatchRefreshPlan(movies, selectedMovies);
    if (plan.missingTmdbCount > 0) {
      operationMessage = buildMissingTmdbMessage(plan.missingTmdbCount, '部电影');
      withClearedMessage(() => { operationMessage = ''; });
      return;
    }

    isOperating = true;
    operationMessage = '正在刷新元数据...';

    batchProgress = { current: 0, total: plan.targets.length };
    const { successCount, failCount } = await executeBatchRefresh('movie', plan.targets, refreshMetadata, ({ current, total, message }) => {
      operationMessage = message;
      batchProgress = { current, total };
    });
    
    // Refresh data
    movies = await reloadLibraryItems(fetchMovies);
    
    operationMessage = buildRefreshCompletedMessage(successCount, failCount);
    isOperating = false;
    selectedMovies = new Set();
    
    withClearedMessage(() => { 
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
      withClearedMessage(() => { operationMessage = ''; }, 5000);
      return;
    }
    
    isOperating = true;
    operationMessage = '正在刷新元数据...';
    
    try {
      const result = await refreshMetadata('movie', movie.path, movie.tmdbId);
      operationMessage = buildRefreshResultMessage(result, '刷新成功');
      
      movies = await reloadLibraryItems(fetchMovies);
    } catch (e) {
      operationMessage = buildErrorMessage(e);
    }
    
    isOperating = false;
    withClearedMessage(() => { operationMessage = ''; });
  }
  
  
  // Filtered movies
  const filteredMovies = $derived.by(() => filterMovies(movies, activeTab, searchQuery));
  const movieCounts = $derived.by(() => countMoviesByProcessed(movies));
  const scrapedCount = $derived.by(() => movieCounts.scraped);
  const unscrapedCount = $derived.by(() => movieCounts.unscraped);

  const movieStatusBadge = $derived.by(() => 
    getGroupStatusBadge(selectedMovieForDetail?.isProcessed ? 'scraped' : 'unscraped')
  );

  const movieFanartUrl = $derived.by(() => 
    getFanartUrl(selectedMovieForDetail?.path, selectedMovieForDetail?.assets?.hasFanart)
  );

  const movieMetaItems = $derived.by(() => buildMovieMetaItems(selectedMovieForDetail));

  const movieOverview = $derived.by(() => selectedMovieForDetail?.overview?.trim() || '');
  
  const movieDetailActions = $derived.by((): ActionButton[] => {
    if (!selectedMovieForDetail) return [];
    const movie = selectedMovieForDetail;
    const label = isOperating ? '处理中...' : '刷新元数据';
    return [
      {
        label,
        icon: 'refresh',
        variant: 'primary',
        disabled: isOperating,
        onclick: () => handleScrapeMovie(movie),
      },
      {
        label: '重新匹配',
        icon: 'search',
        variant: 'secondary',
        disabled: false,
        onclick: () => {
          const target = selectedMovieForDetail;
          closeDetailDrawer();
          if (target) openSearchModal(target);
        },
      },
    ];
  });
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
  <MovieTable
    {loading}
    {filteredMovies}
    {selectedMovies}
    onToggleAll={toggleAll}
    onToggleMovie={toggleMovie}
    onToggleCheckbox={toggleMovieSelection}
    onOpenDetail={handleRowDoubleClick}
    onOpenSearch={openSearchModal}
  />
  
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

<MovieDetailDrawer
  movie={selectedMovieForDetail}
  visible={showDetailDrawer}
  fanartUrl={movieFanartUrl}
  metaItems={movieMetaItems}
  statusBadge={movieStatusBadge}
  bind:overviewExpanded
  {operationMessage}
  actions={movieDetailActions}
  onClose={closeDetailDrawer}
/>

<!-- TMDB Search Modal -->
<TMDBSearchModal
  show={showSearchModal}
  type="movie"
  initialQuery={selectedMovieForDetail?.name || ''}
  onSelect={handleTMDBSelect}
  onClose={() => { showSearchModal = false; }}
/>
