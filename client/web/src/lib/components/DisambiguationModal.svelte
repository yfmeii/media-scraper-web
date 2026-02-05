<script lang="ts">
  
  let {
    show = false,
    onSelect,
    onClose
  }: {
    show?: boolean;
    onSelect?: (mode: 'ai' | 'manual') => void;
    onClose?: () => void;
  } = $props();
  
  function handleSelect(mode: 'ai' | 'manual') {
    onSelect?.(mode);
  }
  
  function handleClose() {
    onClose?.();
  }
</script>

{#if show}
  <div class="fixed inset-0 z-50 flex items-center justify-center relative">
    <button
      type="button"
      class="absolute inset-0 bg-black/50"
      aria-label="关闭对话框"
      onclick={handleClose}
    ></button>
    <div 
      class="relative z-10 bg-card rounded-lg shadow-lg w-full max-w-md mx-4"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <!-- Header -->
      <div class="p-4 border-b border-border flex items-center justify-between">
        <h3 class="font-semibold">选择处理模式</h3>
        <button 
          class="h-8 w-8 rounded-md hover:bg-accent flex items-center justify-center"
          type="button"
          aria-label="关闭对话框"
          onclick={handleClose}
        >
          ✕
        </button>
      </div>
      
      <!-- Options -->
      <div class="p-4 space-y-3">
        <button 
          class="w-full p-4 rounded-md border border-border hover:border-primary hover:bg-accent/50 text-left transition-colors"
          onclick={() => handleSelect('ai')}
        >
          <div class="flex items-center gap-3">
            <span class="text-2xl">🤖</span>
            <div>
              <div class="font-medium">AI 自动处理</div>
              <div class="text-sm text-muted-foreground">
                使用 AI 自动选择最佳匹配，适合批量处理
              </div>
            </div>
          </div>
        </button>
        
        <button 
          class="w-full p-4 rounded-md border border-border hover:border-primary hover:bg-accent/50 text-left transition-colors"
          onclick={() => handleSelect('manual')}
        >
          <div class="flex items-center gap-3">
            <span class="text-2xl">👤</span>
            <div>
              <div class="font-medium">手动确认</div>
              <div class="text-sm text-muted-foreground">
                逐个确认每个匹配结果，更加精确
              </div>
            </div>
          </div>
        </button>
      </div>
      
      <!-- Footer -->
      <div class="p-4 border-t border-border">
        <button 
          class="w-full h-9 rounded-md border border-input bg-background hover:bg-accent text-sm font-medium"
          type="button"
          onclick={handleClose}
        >
          取消
        </button>
      </div>
    </div>
  </div>
{/if}
