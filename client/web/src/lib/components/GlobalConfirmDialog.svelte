<script lang="ts">
  /**
   * 全局确认对话框组件
   * 使用 confirmDialog store，只需在根 layout 中引入一次
   */
  import { fade, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { confirmDialog } from '$lib/stores';
</script>

{#if $confirmDialog.show}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <button 
      class="absolute inset-0 bg-black/50" 
      type="button"
      aria-label="关闭确认对话框"
      onclick={() => confirmDialog.cancel()}
      transition:fade={{ duration: 200 }}
    ></button>
    <div 
      class="relative z-10 w-full max-w-sm bg-background rounded-lg shadow-lg border border-border"
      transition:scale={{ duration: 200, start: 0.95, easing: quintOut }}
    >
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-2">{$confirmDialog.title}</h3>
        <p class="text-sm text-muted-foreground whitespace-pre-line">{$confirmDialog.message}</p>
      </div>
      <div class="flex justify-end gap-2 border-t border-border p-4">
        <button 
          class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 border border-input bg-background hover:bg-accent" 
          onclick={() => confirmDialog.cancel()}
        >
          {$confirmDialog.cancelText}
        </button>
        <button 
          class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 {$confirmDialog.confirmVariant === 'destructive' ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'} hover:opacity-90" 
          onclick={() => confirmDialog.confirm()}
        >
          {$confirmDialog.confirmText}
        </button>
      </div>
    </div>
  </div>
{/if}
