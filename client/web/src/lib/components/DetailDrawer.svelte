<script lang="ts">
  /**
   * 通用详情抽屉组件
   * 提供统一的抽屉容器，内容通过 slot 传入
   */
  import { fade, fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import type { Snippet } from 'svelte';
  
  let {
    show = false,
    title = '详情',
    width = 'max-w-lg',
    onClose,
    children
  }: {
    show?: boolean;
    title?: string;
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
      class="absolute inset-0 bg-black/50" 
      onclick={handleClose}
      transition:fade={{ duration: 200 }}
    ></button>
    <div 
      class="absolute right-0 top-0 bottom-0 w-full {width} bg-card border-l border-border overflow-y-auto"
      transition:fly={{ x: 400, duration: 300, easing: quintOut }}
    >
      <div class="sticky top-0 flex items-center justify-between border-b border-border bg-card p-4 z-10">
        <h2 class="text-lg font-semibold">{title}</h2>
        <button 
          class="inline-flex items-center justify-center rounded-md h-8 w-8 hover:bg-accent" 
          onclick={handleClose}
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        </button>
      </div>
      <div class="p-4">
        {@render children?.()}
      </div>
    </div>
  </div>
{/if}
