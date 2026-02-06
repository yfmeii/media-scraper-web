<script lang="ts">
  import { fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  type StatusBadge = {
    label: string;
    color: string;
    border: string;
    bgColor?: string;
  };

  let {
    fanartUrl,
    posterPath,
    title,
    metaItems = [] as string[],
    statusBadge,
    subtitle,
    animationDelay = 200
  }: {
    fanartUrl?: string;
    posterPath?: string;
    title: string;
    metaItems?: string[];
    statusBadge: StatusBadge;
    subtitle?: string;
    animationDelay?: number;
  } = $props();
</script>

<div class="relative">
  <!-- Fanart Background -->
  <div class="relative h-60">
    <div 
      class="absolute inset-0 bg-muted bg-cover bg-center"
      style={fanartUrl ? `background-image: url('${fanartUrl}')` : ''}
    ></div>
    <div class="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent"></div>
  </div>
  
  <!-- Poster & Title -->
  <div 
    class="relative -mt-16 px-4 pb-4 flex gap-4 items-end" 
    in:fly={{ y: 18, duration: 300, delay: animationDelay, easing: quintOut }}
  >
    <div class="h-28 w-20 rounded-lg overflow-hidden shadow-2xl shadow-black/50 bg-muted border border-border">
      {#if posterPath}
        <img src={posterPath} alt={title} class="h-full w-full object-cover" />
      {:else}
        <div class="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground">No Poster</div>
      {/if}
    </div>
    <div class="min-w-0 pb-2">
      <h2 class="text-2xl font-semibold tracking-tight">{title}</h2>
      <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {#each metaItems as item}
          <span class="rounded-full border border-border/60 bg-background/60 px-2 py-0.5">{item}</span>
        {/each}
        <span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 {statusBadge.bgColor || ''} {statusBadge.border} {statusBadge.color}">
          {statusBadge.label}
        </span>
      </div>
      {#if subtitle}
        <p class="mt-2 text-sm italic text-muted-foreground">{subtitle}</p>
      {/if}
    </div>
  </div>
</div>
