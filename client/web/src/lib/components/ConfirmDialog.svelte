<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { createEventDispatcher } from 'svelte';
  
  export let show = false;
  export let title = '确认';
  export let message = '';
  export let confirmText = '确定';
  export let cancelText = '取消';
  export let confirmVariant: 'primary' | 'destructive' = 'primary';
  
  const dispatch = createEventDispatcher<{
    confirm: void;
    cancel: void;
  }>();
  
  function handleConfirm() {
    dispatch('confirm');
  }
  
  function handleCancel() {
    dispatch('cancel');
  }
</script>

{#if show}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <button 
      class="absolute inset-0 bg-black/50" 
      on:click={handleCancel}
      transition:fade={{ duration: 200 }}
    ></button>
    <div 
      class="relative z-10 w-full max-w-sm bg-background rounded-lg shadow-lg border border-border"
      transition:scale={{ duration: 200, start: 0.95, easing: quintOut }}
    >
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-2">{title}</h3>
        <p class="text-sm text-muted-foreground whitespace-pre-line">{message}</p>
      </div>
      <div class="flex justify-end gap-2 border-t border-border p-4">
        <button 
          class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 border border-input bg-background hover:bg-accent" 
          on:click={handleCancel}
        >
          {cancelText}
        </button>
        <button 
          class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 {confirmVariant === 'destructive' ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'} hover:opacity-90" 
          on:click={handleConfirm}
        >
          {confirmText}
        </button>
      </div>
    </div>
  </div>
{/if}
