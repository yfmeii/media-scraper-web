<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let show = false;
  
  const dispatch = createEventDispatcher<{
    select: 'ai' | 'manual';
    close: void;
  }>();
  
  function handleSelect(mode: 'ai' | 'manual') {
    dispatch('select', mode);
  }
  
  function handleClose() {
    show = false;
    dispatch('close');
  }
</script>

{#if show}
  <div 
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    on:click|self={handleClose}
    role="dialog"
    aria-modal="true"
  >
    <div class="bg-card rounded-lg shadow-lg w-full max-w-md mx-4">
      <!-- Header -->
      <div class="p-4 border-b border-border flex items-center justify-between">
        <h3 class="font-semibold">选择处理模式</h3>
        <button 
          class="h-8 w-8 rounded-md hover:bg-accent flex items-center justify-center"
          on:click={handleClose}
        >
          ✕
        </button>
      </div>
      
      <!-- Options -->
      <div class="p-4 space-y-3">
        <button 
          class="w-full p-4 rounded-md border border-border hover:border-primary hover:bg-accent/50 text-left transition-colors"
          on:click={() => handleSelect('ai')}
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
          on:click={() => handleSelect('manual')}
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
          on:click={handleClose}
        >
          取消
        </button>
      </div>
    </div>
  </div>
{/if}
