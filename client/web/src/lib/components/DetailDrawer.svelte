<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import type { Snippet } from 'svelte';
  
  let {
    show = false,
    width = 'max-w-2xl',
    onClose,
    children
  }: {
    show?: boolean;
    width?: string;
    onClose?: () => void;
    children?: Snippet;
  } = $props();
  
  function handleClose() {
    onClose?.();
  }
</script>

{#if show}
  <div class="fixed inset-0 z-50">
    <button 
      class="absolute inset-0 bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60" 
      aria-label="关闭详情"
      onclick={handleClose}
      transition:fade={{ duration: 200 }}
    ></button>
    <div 
      class="absolute right-0 top-0 bottom-0 w-full {width} bg-card border-l border-border shadow-2xl overflow-hidden"
      transition:fly={{ x: 400, duration: 400, opacity: 1, easing: quintOut }}
    >
      <div class="flex h-full flex-col">
        {@render children?.()}
      </div>
    </div>
  </div>
{/if}
