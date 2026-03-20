<script lang="ts">
  let {
    currentDirLabel,
    filterStatus = $bindable('all'),
    searchQuery = $bindable(''),
    onRefresh,
  }: {
    currentDirLabel: string;
    filterStatus?: string;
    searchQuery?: string;
    onRefresh: () => void;
  } = $props();
</script>

<div class="flex items-center gap-4 border-b border-border bg-card px-4 py-2">
  <h2 class="text-sm font-medium">当前目录: {currentDirLabel}</h2>
  <div class="ml-auto flex items-center gap-2">
    <span class="text-xs text-muted-foreground">过滤:</span>
    <select class="h-8 rounded-md border border-input bg-background px-2 text-xs" bind:value={filterStatus}>
      <option value="all">全部</option>
      <option value="unprocessed">未处理</option>
      <option value="processed">已处理</option>
    </select>
    <span class="text-xs text-muted-foreground">搜索:</span>
    <input type="text" class="h-8 w-32 rounded-md border border-input bg-background px-2 text-xs" bind:value={searchQuery} />
    <button
      class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent h-8"
      onclick={onRefresh}
    >
      刷新
    </button>
  </div>
</div>
