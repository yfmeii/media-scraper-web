<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { backOut } from 'svelte/easing';
  
  let {
    show = false,
    title = '确认',
    message = '',
    confirmText = '确定',
    cancelText = '取消',
    confirmVariant = 'primary',
    onConfirm,
    onCancel
  }: {
    show?: boolean;
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    confirmVariant?: 'primary' | 'destructive';
    onConfirm?: () => void;
    onCancel?: () => void;
  } = $props();
  
  function handleConfirm() {
    onConfirm?.();
  }
  
  function handleCancel() {
    onCancel?.();
  }
</script>

{#if show}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <button 
      class="absolute inset-0 bg-black/50 backdrop-blur-sm" 
      onclick={handleCancel}
      transition:fade={{ duration: 200 }}
    ></button>
    <div 
      class="relative z-10 w-full max-w-sm bg-background rounded-lg shadow-lg border border-border"
      transition:scale={{ duration: 300, start: 0.9, easing: backOut }}
    >
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-2">{title}</h3>
        <p class="text-sm text-muted-foreground whitespace-pre-line">{message}</p>
      </div>
      <div class="flex justify-end gap-2 border-t border-border p-4">
        <button 
          class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 border border-input bg-background hover:bg-accent transition-colors active:scale-95 duration-100" 
          onclick={handleCancel}
        >
          {cancelText}
        </button>
        <button 
          class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 {confirmVariant === 'destructive' ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'} hover:opacity-90 transition-all active:scale-95 duration-100 shadow-sm" 
          onclick={handleConfirm}
        >
          {confirmText}
        </button>
      </div>
    </div>
  </div>
{/if}
