<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import type { Snippet } from 'svelte';
  
  let {
    show = false,
    width = 'max-w-2xl',
    title = '',
    onClose,
    children,
    footer
  }: {
    show?: boolean;
    width?: string;
    title?: string;
    onClose?: () => void;
    children?: Snippet;
    footer?: Snippet;
  } = $props();
  
  let scrollEl: HTMLDivElement | undefined = $state();
  let scrollY = $state(0);
  
  // Floating top bar opacity: transparent at top, fully opaque after 160px scroll
  const topBarOpacity = $derived(Math.min(scrollY / 160, 1));
  // Title appears after scrolling past ~40% of threshold
  const titleOpacity = $derived(Math.max(0, Math.min((scrollY - 60) / 100, 1)));
  
  function handleScroll() {
    if (scrollEl) scrollY = scrollEl.scrollTop;
  }
  
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
      <div class="relative flex h-full flex-col">
        <!-- Floating top bar (always on top) -->
        <div 
          class="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 h-12 pointer-events-none"
          style="background: color-mix(in srgb, var(--color-card) {topBarOpacity * 100}%, transparent); backdrop-filter: blur({topBarOpacity * 12}px); -webkit-backdrop-filter: blur({topBarOpacity * 12}px);"
        >
          <span 
            class="text-sm font-semibold truncate pr-10"
            style="opacity: {titleOpacity}"
          >
            {title}
          </span>
          <button 
            class="pointer-events-auto inline-flex items-center justify-center rounded-md h-8 w-8 bg-background/70 hover:bg-background transition-colors shrink-0" 
            aria-label="关闭详情" 
            onclick={handleClose}
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6 6 18"/>
              <path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>
        
        <!-- Scrollable content (header + body) -->
        <div 
          class="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
          bind:this={scrollEl}
          onscroll={handleScroll}
        >
          {@render children?.()}
        </div>
        
        <!-- Fixed footer (action buttons) -->
        {#if footer}
          {@render footer()}
        {/if}
      </div>
    </div>
  </div>
{/if}
