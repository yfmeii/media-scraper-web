<script lang="ts">
  import { fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { quintOut, cubicOut } from 'svelte/easing';
  import type { MovieInfo } from '$lib/api';
  import { AssetIndicators, PosterThumbnail, StatusBadge, TableSkeleton } from '$lib/components';

  let {
    loading,
    filteredMovies,
    selectedMovies,
    onToggleAll,
    onToggleMovie,
    onToggleCheckbox,
    onOpenDetail,
    onOpenSearch,
  }: {
    loading: boolean;
    filteredMovies: MovieInfo[];
    selectedMovies: Set<string>;
    onToggleAll: () => void;
    onToggleMovie: (path: string, event: MouseEvent) => void;
    onToggleCheckbox: (path: string, event: MouseEvent) => void;
    onOpenDetail: (movie: MovieInfo) => void;
    onOpenSearch: (movie: MovieInfo) => void;
  } = $props();
</script>

<div class="rounded-lg border border-border bg-card overflow-hidden">
  {#if loading}
    <TableSkeleton rows={8} columns={5} />
  {:else if filteredMovies.length === 0}
    <div class="p-8 text-center text-muted-foreground">没有找到符合条件的电影</div>
  {:else}
    <table class="w-full">
      <thead class="bg-card">
        <tr class="border-b border-border text-xs text-muted-foreground">
          <th class="w-12 p-3 text-left"><input type="checkbox" class="h-4 w-4 rounded border-input accent-primary" checked={selectedMovies.size === filteredMovies.length && filteredMovies.length > 0} onchange={onToggleAll} /></th>
          <th class="w-16 p-3 text-left font-medium">海报</th>
          <th class="p-3 text-left font-medium">电影名称</th>
          <th class="w-20 p-3 text-left font-medium">年份</th>
          <th class="w-32 p-3 text-left font-medium">状态</th>
          <th class="w-40 p-3 text-left font-medium">完整性</th>
          <th class="w-40 p-3 text-left font-medium">操作</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredMovies as movie (movie.path)}
          <tr
            class="border-b border-border hover:bg-accent/50 cursor-pointer {selectedMovies.has(movie.path) ? 'bg-accent/30 border-l-2 border-l-primary' : ''} transition-colors duration-150"
            onclick={(event) => onToggleMovie(movie.path, event)}
            ondblclick={() => onOpenDetail(movie)}
            animate:flip={{ duration: 300, easing: quintOut }}
            in:fly={{ y: 20, duration: 300, easing: cubicOut }}
          >
            <td class="p-3">
              <input
                type="checkbox"
                class="h-4 w-4 rounded border-input accent-primary"
                checked={selectedMovies.has(movie.path)}
                onclick={(event) => onToggleCheckbox(movie.path, event)}
              />
            </td>
            <td class="p-3">
              <PosterThumbnail src={movie.posterPath} alt={movie.name} hasPoster={movie.assets?.hasPoster} size="sm" />
            </td>
            <td class="p-3"><div class="font-medium">{movie.name}</div></td>
            <td class="p-3 text-muted-foreground">{movie.year || '-'}</td>
            <td class="p-3">
              <StatusBadge status={movie.isProcessed ? 'scraped' : 'unscraped'} />
            </td>
            <td class="p-3">
              <AssetIndicators assets={{ hasPoster: movie.assets?.hasPoster, hasNfo: movie.assets?.hasNfo }} showFanart={false} />
            </td>
            <td class="p-3">
              <div class="flex gap-1">
                <button
                  class="inline-flex items-center justify-center rounded-md text-xs font-medium h-7 px-2 border border-input bg-background hover:bg-accent"
                  onclick={(event) => {
                    event.stopPropagation();
                    onOpenDetail(movie);
                  }}
                >
                  详情
                </button>
                <button
                  class="inline-flex items-center justify-center rounded-md text-xs font-medium h-7 px-2 border border-input bg-background hover:bg-accent"
                  onclick={(event) => {
                    event.stopPropagation();
                    onOpenSearch(movie);
                  }}
                >
                  匹配
                </button>
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>
