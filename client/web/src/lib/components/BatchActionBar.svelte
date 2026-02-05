<script lang="ts">
  /**
   * 批量操作栏组件
   * 固定在页面底部，显示选中数量、进度和操作按钮
   */
  import { fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  
  export let show = false;
  export let selectedCount = 0;
  export let isOperating = false;
  export let operationMessage = '';
  export let progress: { current: number; total: number } | null = null;
  export let itemLabel = '项';
</script>

{#if show}
  <div 
    class="fixed bottom-0 left-0 right-0 border-t border-border bg-card shadow-lg z-40"
    transition:fly={{ y: 100, duration: 250, easing: quintOut }}
  >
    <!-- Progress bar -->
    {#if progress && progress.total > 0}
      <div class="h-1 bg-muted">
        <div 
          class="h-full bg-gradient-to-r from-primary to-green-500 transition-all duration-300" 
          style="width: {(progress.current / progress.total) * 100}%"
        ></div>
      </div>
    {/if}
    
    <div class="container mx-auto flex items-center justify-between p-4">
      <div class="flex items-center gap-4">
        {#if operationMessage}
          <div class="flex items-center gap-2">
            {#if isOperating}
              <svg class="h-4 w-4 animate-spin text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            {/if}
            <span class="text-sm font-medium">{operationMessage}</span>
          </div>
        {:else}
          <span class="text-sm text-muted-foreground">已选择 {selectedCount} {itemLabel}</span>
        {/if}
      </div>
      
      <div class="flex gap-2">
        <slot name="actions" />
      </div>
    </div>
  </div>
{/if}
