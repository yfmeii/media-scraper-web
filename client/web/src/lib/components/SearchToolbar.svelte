<script lang="ts">
  type Tab = {
    id: string;
    label: string;
    count?: number;
  };

  let {
    searchPlaceholder = '搜索...',
    searchQuery = $bindable(''),
    tabs = [] as Tab[],
    activeTab = $bindable('all'),
    onRefresh,
    refreshDisabled = false,
    class: className = ''
  }: {
    searchPlaceholder?: string;
    searchQuery?: string;
    tabs?: Tab[];
    activeTab?: string;
    onRefresh?: () => void;
    refreshDisabled?: boolean;
    class?: string;
  } = $props();
</script>

<div class="mb-6 space-y-4 {className}">
  <div class="flex items-center justify-between flex-wrap gap-4">
    <!-- Search input -->
    <div class="relative">
      <svg 
        class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        stroke-width="2"
      >
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.3-4.3"/>
      </svg>
      <input 
        type="text" 
        placeholder={searchPlaceholder}
        class="h-9 w-64 rounded-md border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        bind:value={searchQuery}
      />
    </div>
    
    <!-- Refresh button -->
    {#if onRefresh}
      <button 
        class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 border border-input bg-background hover:bg-accent hover:text-accent-foreground disabled:opacity-50 transition-colors"
        disabled={refreshDisabled}
        onclick={onRefresh}
      >
        <svg 
          class="mr-2 h-4 w-4" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          stroke-width="2"
        >
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
          <path d="M16 16h5v5"/>
        </svg>
        刷新
      </button>
    {/if}
  </div>
  
  <!-- Filter tabs -->
  {#if tabs.length > 0}
    <div class="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
      {#each tabs as tab (tab.id)}
        <button 
          class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 {activeTab === tab.id ? 'bg-background text-foreground shadow-sm' : ''}"
          onclick={() => activeTab = tab.id}
        >
          {tab.label}
          {#if tab.count !== undefined}
            <span class="ml-1.5 text-xs text-muted-foreground">({tab.count})</span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
