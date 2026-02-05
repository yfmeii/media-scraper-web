<script lang="ts">
  import { fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  let {
    overview = '',
    maxLength = 160,
    expanded = $bindable(false),
    animationDelay = 260,
    lineClampClass = 'line-clamp-4'
  }: {
    overview?: string;
    maxLength?: number;
    expanded?: boolean;
    animationDelay?: number;
    lineClampClass?: string;
  } = $props();

  const canExpand = $derived(overview.length > maxLength);
</script>

<section 
  class="space-y-2" 
  in:fly={{ y: 18, duration: 300, delay: animationDelay, easing: quintOut }}
>
  <div class="flex items-center justify-between">
    <h3 class="text-sm font-semibold">剧情简介</h3>
    {#if overview && canExpand}
      <button 
        class="text-xs text-muted-foreground hover:text-foreground transition-colors" 
        onclick={() => { expanded = !expanded; }}
      >
        {expanded ? '收起' : '展开'}
      </button>
    {/if}
  </div>
  <p class="text-sm text-muted-foreground leading-relaxed {overview && !expanded && canExpand ? lineClampClass : ''}">
    {overview || '暂无简介'}
  </p>
</section>
