<script lang="ts">
  import { searchTMDB, type SearchResult } from '$lib/api';
  
  let {
    show = false,
    type: initialType = 'tv',
    initialQuery = '',
    onSelect,
    onClose
  }: {
    show?: boolean;
    type?: 'tv' | 'movie';
    initialQuery?: string;
    onSelect?: (result: SearchResult) => void;
    onClose?: () => void;
  } = $props();
  
  let type = $state<'tv' | 'movie'>(initialType);
  let query = $state('');
  let results = $state<SearchResult[]>([]);
  let isSearching = $state(false);
  
  $effect(() => {
    if (show && initialQuery) {
      query = initialQuery;
      void handleSearch();
    }
  });
  
  async function handleSearch() {
    if (!query.trim()) return;
    isSearching = true;
    try {
      results = await searchTMDB(type, query);
    } catch (e) {
      console.error(e);
      results = [];
    } finally {
      isSearching = false;
    }
  }
  
  function handleSelect(result: SearchResult) {
    onSelect?.(result);
  }
  
  function handleClose() {
    results = [];
    onClose?.();
  }
  
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleClose();
    } else if (e.key === 'Enter') {
      handleSearch();
    }
  }
</script>

{#if show}
  <div 
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    onclick={(e) => {
      if (e.target === e.currentTarget) handleClose();
    }}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
  >
    <div class="bg-card rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
      <!-- Header -->
      <div class="p-4 border-b border-border flex items-center justify-between">
        <h3 class="font-semibold">TMDB 搜索</h3>
        <button 
          class="h-8 w-8 rounded-md hover:bg-accent flex items-center justify-center"
          onclick={handleClose}
        >
          ✕
        </button>
      </div>
      
      <!-- Search Input -->
      <div class="p-4 border-b border-border">
        <div class="flex gap-2">
          <select 
            class="h-9 rounded-md border border-input bg-background px-3 text-sm"
            bind:value={type}
          >
            <option value="tv">剧集</option>
            <option value="movie">电影</option>
          </select>
          <input 
            type="text"
            class="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
            placeholder="输入搜索关键词..."
            bind:value={query}
            onkeydown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button 
            class="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
            disabled={isSearching}
            onclick={handleSearch}
          >
            {isSearching ? '搜索中...' : '搜索'}
          </button>
        </div>
      </div>
      
      <!-- Results -->
      <div class="flex-1 overflow-y-auto p-4">
        {#if results.length > 0}
          <div class="space-y-2">
            {#each results as result}
              <button 
                class="w-full flex items-start gap-3 p-3 rounded-md border border-border hover:bg-accent text-left"
                onclick={() => handleSelect(result)}
              >
                {#if result.posterPath}
                  <img 
                    src={result.posterPath} 
                    alt={result.name || result.title}
                    class="w-16 h-24 object-cover rounded"
                  />
                {:else}
                  <div class="w-16 h-24 bg-muted rounded flex items-center justify-center text-muted-foreground">
                    ?
                  </div>
                {/if}
                <div class="flex-1 min-w-0">
                  <div class="font-medium truncate">
                    {result.name || result.title}
                  </div>
                  {#if result.originalName && result.originalName !== result.name}
                    <div class="text-sm text-muted-foreground truncate">
                      {result.originalName}
                    </div>
                  {/if}
                  <div class="text-sm text-muted-foreground">
                    {result.firstAirDate?.slice(0, 4) || result.releaseDate?.slice(0, 4) || '?'}
                    <span class="mx-1">·</span>
                    ID: {result.id}
                  </div>
                  {#if result.overview}
                    <div class="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {result.overview}
                    </div>
                  {/if}
                </div>
              </button>
            {/each}
          </div>
        {:else if isSearching}
          <div class="text-center py-8 text-muted-foreground">
            搜索中...
          </div>
        {:else if query}
          <div class="text-center py-8 text-muted-foreground">
            未找到结果
          </div>
        {:else}
          <div class="text-center py-8 text-muted-foreground">
            输入关键词开始搜索
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
