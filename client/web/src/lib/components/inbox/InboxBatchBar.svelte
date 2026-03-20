<script lang="ts">
  let {
    isOperating = false,
    operationMessage = '',
    batchProgress = { current: 0, total: 0 },
    selectedCount = 0,
    onBatchAuto,
    onBatchAI,
  }: {
    isOperating?: boolean;
    operationMessage?: string;
    batchProgress?: { current: number; total: number };
    selectedCount?: number;
    onBatchAuto?: () => void;
    onBatchAI?: () => void;
  } = $props();
</script>

<div class="border-t border-border bg-card">
  <div class="flex items-center gap-2 px-4 py-2 flex-wrap">
    {#if isOperating}
      <div class="flex items-center gap-2 flex-1">
        <svg class="h-4 w-4 animate-spin text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        <span class="text-xs font-medium">{operationMessage}</span>
        {#if batchProgress.total > 0}
          <span class="text-xs text-muted-foreground">({batchProgress.current}/{batchProgress.total})</span>
        {/if}
      </div>
    {:else}
      <span class="text-xs text-muted-foreground">已选 {selectedCount} 个文件</span>
      <button class="inline-flex items-center justify-center rounded-md text-xs font-medium h-8 px-3 border border-border bg-background hover:bg-muted disabled:opacity-50" disabled={selectedCount === 0} onclick={onBatchAuto}>
        📂 一键匹配入库
      </button>
      <button class="inline-flex items-center justify-center rounded-md text-xs font-medium h-8 px-3 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50" disabled={selectedCount === 0} onclick={onBatchAI}>
        🤖 一键 AI 识别入库
      </button>
    {/if}
  </div>
</div>
