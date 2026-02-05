<script lang="ts">
  type Tab = {
    id: string;
    label: string;
    count?: number;
  };

  let {
    tabs,
    activeTab = $bindable('all'),
    class: className = ''
  }: {
    tabs: Tab[];
    activeTab?: string;
    class?: string;
  } = $props();
</script>

<div class="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground {className}">
  {#each tabs as tab (tab.id)}
    <button 
      class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 {activeTab === tab.id ? 'bg-background text-foreground shadow-sm' : ''}"
      onclick={() => activeTab = tab.id}
    >
      {tab.label}
      {#if tab.count !== undefined}
        <span class="ml-1.5 text-xs text-muted-foreground">({tab.count})</span>
      {/if}
    </button>
  {/each}
</div>
