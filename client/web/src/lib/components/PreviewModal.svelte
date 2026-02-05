<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let show = false;
  export let loading = false;
  export let title = '预览移动计划';
  export let actions: Array<{
    type: string;
    source?: string;
    destination: string;
    willOverwrite?: boolean;
  }> = [];
  export let summary: {
    filesMoving: number;
    nfoCreating: number;
    nfoOverwriting: number;
  } | null = null;
  
  const dispatch = createEventDispatcher<{
    confirm: void;
    close: void;
  }>();
  
  function handleConfirm() {
    dispatch('confirm');
  }
  
  function handleClose() {
    show = false;
    dispatch('close');
  }
  
  function getActionIcon(type: string): string {
    switch (type) {
      case 'create-dir': return '📁';
      case 'move': return '📦';
      case 'create-nfo': return '📄';
      case 'download-poster': return '🖼️';
      default: return '❓';
    }
  }
  
  function getActionLabel(type: string): string {
    switch (type) {
      case 'create-dir': return '创建目录';
      case 'move': return '移动文件';
      case 'create-nfo': return '创建 NFO';
      case 'download-poster': return '下载海报';
      default: return type;
    }
  }
</script>

{#if show}
  <div 
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    on:click|self={handleClose}
    role="dialog"
    aria-modal="true"
  >
    <div class="bg-card rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
      <!-- Header -->
      <div class="p-4 border-b border-border flex items-center justify-between">
        <h3 class="font-semibold">{title}</h3>
        <button 
          class="h-8 w-8 rounded-md hover:bg-accent flex items-center justify-center"
          on:click={handleClose}
        >
          ✕
        </button>
      </div>
      
      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4">
        {#if loading}
          <div class="text-center py-8 text-muted-foreground">
            <svg class="h-8 w-8 animate-spin mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            加载中...
          </div>
        {:else if actions.length > 0}
          <div class="space-y-2">
            {#each actions as action}
              <div class="p-3 rounded-md bg-muted/50 text-sm">
                <div class="flex items-center gap-2 mb-1">
                  <span>{getActionIcon(action.type)}</span>
                  <span class="font-medium">{getActionLabel(action.type)}</span>
                  {#if action.willOverwrite}
                    <span class="text-xs text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded">
                      覆盖
                    </span>
                  {/if}
                </div>
                {#if action.source}
                  <div class="text-xs text-muted-foreground font-mono truncate">
                    从: {action.source}
                  </div>
                {/if}
                <div class="text-xs text-muted-foreground font-mono truncate">
                  到: {action.destination}
                </div>
              </div>
            {/each}
          </div>
          
          {#if summary}
            <div class="mt-4 p-3 rounded-md bg-primary/10 text-sm">
              <div class="font-medium mb-1">摘要</div>
              <div class="text-muted-foreground">
                移动 {summary.filesMoving} 个文件，
                创建 {summary.nfoCreating} 个 NFO
                {#if summary.nfoOverwriting > 0}
                  ，覆盖 {summary.nfoOverwriting} 个 NFO
                {/if}
              </div>
            </div>
          {/if}
        {:else}
          <div class="text-center py-8 text-muted-foreground">
            暂无操作
          </div>
        {/if}
      </div>
      
      <!-- Footer -->
      <div class="p-4 border-t border-border flex justify-end gap-2">
        <button 
          class="h-9 px-4 rounded-md border border-input bg-background hover:bg-accent text-sm font-medium"
          on:click={handleClose}
        >
          取消
        </button>
        <button 
          class="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          disabled={loading || actions.length === 0}
          on:click={handleConfirm}
        >
          确认执行
        </button>
      </div>
    </div>
  </div>
{/if}
