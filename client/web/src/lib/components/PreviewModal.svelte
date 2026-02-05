<script lang="ts">
  
  let {
    show = false,
    loading = false,
    title = '预览移动计划',
    actions = [],
    summary = null,
    onConfirm,
    onClose
  }: {
    show?: boolean;
    loading?: boolean;
    title?: string;
    actions?: Array<{
      type: string;
      source?: string;
      destination: string;
      willOverwrite?: boolean;
    }>;
    summary?: {
      filesMoving: number;
      nfoCreating: number;
      nfoOverwriting: number;
    } | null;
    onConfirm?: () => void;
    onClose?: () => void;
  } = $props();
  
  function handleConfirm() {
    onConfirm?.();
  }
  
  function handleClose() {
    onClose?.();
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
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    transition:fade={{ duration: 200 }}
    onclick={(e) => {
      if (e.target === e.currentTarget) handleClose();
    }}
    role="dialog"
    aria-modal="true"
  >
    <div 
      class="bg-card rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col"
      transition:scale={{ duration: 300, start: 0.95, easing: backOut }}
    >
      <!-- Header -->
      <div class="p-4 border-b border-border flex items-center justify-between">
        <h3 class="font-semibold">{title}</h3>
        <button 
          class="h-8 w-8 rounded-md hover:bg-accent flex items-center justify-center transition-colors"
          onclick={handleClose}
        >
          ✕
        </button>
      </div>
      
      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {#if loading}
          <div class="text-center py-8 text-muted-foreground" in:fade>
            <svg class="h-8 w-8 animate-spin mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            加载中...
          </div>
        {:else if actions.length > 0}
          <div class="space-y-2">
            {#each actions as action, i}
              <div 
                class="p-3 rounded-md bg-muted/50 text-sm hover:bg-muted transition-colors"
                in:fly={{ y: 10, duration: 200, delay: i * 30 }}
              >
                <div class="flex items-center gap-2 mb-1">
                  <span>{getActionIcon(action.type)}</span>
                  <span class="font-medium">{getActionLabel(action.type)}</span>
                  {#if action.willOverwrite}
                    <span class="text-xs text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded animate-pulse">
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
            <div class="mt-4 p-3 rounded-md bg-primary/10 text-sm" in:scale={{ duration: 200, delay: 200 }}>
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
          class="h-9 px-4 rounded-md border border-input bg-background hover:bg-accent text-sm font-medium transition-colors active:scale-95 duration-100"
          onclick={handleClose}
        >
          取消
        </button>
        <button 
          class="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all active:scale-95 duration-100 shadow-sm"
          disabled={loading || actions.length === 0}
          onclick={handleConfirm}
        >
          确认执行
        </button>
      </div>
    </div>
  </div>
{/if}
