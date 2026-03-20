<script lang="ts">
  import type { DirectoryGroup } from '$lib/api';

  let {
    loading = false,
    directories = [],
    currentDir = '',
    allFilesCount = 0,
    onSelect,
  }: {
    loading?: boolean;
    directories?: DirectoryGroup[];
    currentDir?: string;
    allFilesCount?: number;
    onSelect?: (dir: DirectoryGroup | null) => void;
  } = $props();
</script>

<div class="w-72 flex flex-col border-r border-border bg-card">
  <div class="border-b border-border p-3">
    <h2 class="text-sm font-medium">目录</h2>
  </div>
  <div class="flex-1 overflow-y-auto">
    {#if loading}
      <div class="p-2 space-y-2">
        {#each Array(8) as _}
          <div class="h-8 rounded-md bg-muted/40 animate-pulse"></div>
        {/each}
      </div>
    {:else if directories.length === 0}
      <div class="p-4 text-center text-muted-foreground text-sm">暂无文件</div>
    {:else}
      <button
        class="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-accent/50 {currentDir === '' ? 'bg-accent/30 border-l-2 border-l-primary' : ''}"
        onclick={() => onSelect?.(null)}
      >
        <svg class="h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg>
        <span class="flex-1">全部</span>
        <span class="text-xs text-muted-foreground">({allFilesCount})</span>
      </button>
      <div class="border-t border-border/50 my-1"></div>
      {#each directories as dir}
        <button
          class="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-accent/50 {currentDir === dir.path ? 'bg-accent/30 border-l-2 border-l-primary' : ''}"
          onclick={() => onSelect?.(dir)}
        >
          <svg class="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
          <span class="flex-1 truncate">{dir.name}</span>
          <span class="text-xs text-muted-foreground">({dir.files.length})</span>
        </button>
      {/each}
    {/if}
  </div>
</div>
