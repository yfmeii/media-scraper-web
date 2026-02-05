<script lang="ts">
  type AssetFlags = {
    hasPoster?: boolean;
    hasNfo?: boolean;
    hasFanart?: boolean;
  };

  let {
    assets,
    size = 'sm' as 'sm' | 'md',
    showLabels = true
  }: {
    assets?: AssetFlags;
    size?: 'sm' | 'md';
    showLabels?: boolean;
  } = $props();

  const iconSize = $derived(size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5');
  const textSize = $derived(size === 'sm' ? 'text-xs' : 'text-sm');
  const gap = $derived(size === 'sm' ? 'gap-2' : 'gap-3');
</script>

<div class="flex items-center flex-wrap {gap}">
  <!-- Poster -->
  <span class="flex items-center gap-1 {textSize} {assets?.hasPoster ? 'text-green-500' : 'text-red-500'}">
    {#if assets?.hasPoster}
      <svg class={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <path d="m9 11 3 3L22 4"/>
      </svg>
    {:else}
      <svg class={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="m15 9-6 6"/>
        <path d="m9 9 6 6"/>
      </svg>
    {/if}
    {#if showLabels}<span>海报</span>{/if}
  </span>
  
  <!-- NFO -->
  <span class="flex items-center gap-1 {textSize} {assets?.hasNfo ? 'text-green-500' : 'text-red-500'}">
    {#if assets?.hasNfo}
      <svg class={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <path d="m9 11 3 3L22 4"/>
      </svg>
    {:else}
      <svg class={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="m15 9-6 6"/>
        <path d="m9 9 6 6"/>
      </svg>
    {/if}
    {#if showLabels}<span>NFO</span>{/if}
  </span>
  
  <!-- Fanart -->
  <span class="flex items-center gap-1 {textSize} {assets?.hasFanart ? 'text-green-500' : 'text-red-500'}">
    {#if assets?.hasFanart}
      <svg class={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <path d="m9 11 3 3L22 4"/>
      </svg>
    {:else}
      <svg class={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="m15 9-6 6"/>
        <path d="m9 9 6 6"/>
      </svg>
    {/if}
    {#if showLabels}<span>Fanart</span>{/if}
  </span>
</div>
