<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { getScrapedStatus } from '$lib/format';
  
  export let name: string;
  export let poster: string | null = null;
  export let year: string | number | null = null;
  export let subtitle: string | null = null;  // 如 "3 季" 或分辨率
  export let scraped = false;
  export let selected = false;
  export let progress: number | null = null;  // 0-100
  
  const dispatch = createEventDispatcher<{
    click: MouseEvent;
    dblclick: void;
  }>();
  
  const status = getScrapedStatus(scraped);
</script>

<button
  class="group relative w-full text-left rounded-lg border border-border bg-card overflow-hidden transition-all hover:shadow-md"
  class:ring-2={selected}
  class:ring-primary={selected}
  on:click={(e) => dispatch('click', e)}
  on:dblclick={() => dispatch('dblclick')}
>
  <!-- Poster -->
  <div class="aspect-[2/3] bg-muted relative">
    {#if poster}
      <img 
        src={poster} 
        alt={name}
        class="w-full h-full object-cover"
        loading="lazy"
      />
    {:else}
      <div class="w-full h-full flex items-center justify-center text-muted-foreground">
        <svg class="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect width="18" height="18" x="3" y="3" rx="2"/>
          <path d="m9 8 6 4-6 4z"/>
        </svg>
      </div>
    {/if}
    
    <!-- Selection indicator -->
    {#if selected}
      <div class="absolute top-2 left-2">
        <div class="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
          <svg class="h-4 w-4 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
      </div>
    {/if}
    
    <!-- Progress bar -->
    {#if progress !== null}
      <div class="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
        <div 
          class="h-full bg-primary transition-all"
          style="width: {progress}%"
        />
      </div>
    {/if}
  </div>
  
  <!-- Info -->
  <div class="p-3">
    <h3 class="font-medium text-sm truncate" title={name}>
      {name}
    </h3>
    <div class="flex items-center justify-between mt-1 text-xs text-muted-foreground">
      <span>
        {#if year}
          {year}
        {/if}
        {#if subtitle}
          {#if year} · {/if}
          {subtitle}
        {/if}
      </span>
      <span class={status.class}>
        {status.icon}
      </span>
    </div>
  </div>
</button>
