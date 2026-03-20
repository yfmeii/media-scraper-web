<script lang="ts">
  import { fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { quintOut, cubicOut } from 'svelte/easing';
  import { getShowMissingEpisodes, formatMissingSxEx } from '@media-scraper/shared/format';
  import type { ShowInfo } from '@media-scraper/shared/types';
  import { PosterThumbnail, AssetIndicators, StatusBadge, TableSkeleton } from '$lib/components';
  import { resolveShowEpisodeCount, resolveShowSeasonCount } from '$lib/tvDetail';

  let {
    loading,
    filteredShows,
    selectedShows,
    onToggleAll,
    onToggleShow,
    onToggleCheckbox,
    onOpenDetail,
    onOpenSearch,
  }: {
    loading: boolean;
    filteredShows: ShowInfo[];
    selectedShows: Set<string>;
    onToggleAll: () => void;
    onToggleShow: (path: string, event: MouseEvent) => void;
    onToggleCheckbox: (path: string, event: MouseEvent) => void;
    onOpenDetail: (show: ShowInfo) => void;
    onOpenSearch: (show: ShowInfo) => void;
  } = $props();
</script>

<div class="rounded-lg border border-border bg-card overflow-hidden">
  {#if loading}
    <TableSkeleton rows={8} columns={6} />
  {:else if filteredShows.length === 0}
    <div class="p-8 text-center text-muted-foreground">没有找到符合条件的剧集</div>
  {:else}
    <table class="w-full">
      <thead class="bg-card">
        <tr class="border-b border-border text-xs text-muted-foreground">
          <th class="w-12 p-3 text-left"><input type="checkbox" class="h-4 w-4 rounded border-input accent-primary" checked={selectedShows.size === filteredShows.length && filteredShows.length > 0} onchange={onToggleAll} /></th>
          <th class="w-16 p-3 text-left font-medium">海报</th>
          <th class="p-3 text-left font-medium">剧集名称</th>
          <th class="w-24 p-3 text-left font-medium">季数</th>
          <th class="w-24 p-3 text-left font-medium">集数</th>
          <th class="w-28 p-3 text-left font-medium">缺集</th>
          <th class="w-32 p-3 text-left font-medium">状态</th>
          <th class="w-40 p-3 text-left font-medium">完整性</th>
          <th class="w-40 p-3 text-left font-medium">操作</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredShows as show (show.path)}
          {@const missingInfo = getShowMissingEpisodes(show)}
          {@const totalMissing = missingInfo.reduce((sum, item) => sum + item.missing.length, 0)}
          <tr
            class="border-b border-border hover:bg-accent/50 cursor-pointer {selectedShows.has(show.path) ? 'bg-accent/30 border-l-2 border-l-primary' : ''} transition-colors duration-150"
            onclick={(event) => onToggleShow(show.path, event)}
            ondblclick={() => onOpenDetail(show)}
            animate:flip={{ duration: 300, easing: quintOut }}
            in:fly={{ y: 20, duration: 300, easing: cubicOut }}
          >
            <td class="p-3">
              <input
                type="checkbox"
                class="h-4 w-4 rounded border-input accent-primary"
                checked={selectedShows.has(show.path)}
                onclick={(event) => onToggleCheckbox(show.path, event)}
              />
            </td>
            <td class="p-3">
              <PosterThumbnail src={show.posterPath} alt={show.name} hasPoster={show.assets?.hasPoster} size="sm" />
            </td>
            <td class="p-3"><div class="font-medium">{show.name}</div></td>
            <td class="p-3 text-muted-foreground">{resolveShowSeasonCount(show)}</td>
            <td class="p-3 text-muted-foreground">{resolveShowEpisodeCount(show) || '24'}</td>
            <td class="p-3">
              {#if totalMissing > 0}
                <span class="inline-flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-500 cursor-help" title={formatMissingSxEx(missingInfo)}>
                  <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  缺 {totalMissing} 集
                </span>
              {:else}
                <span class="text-xs text-muted-foreground">—</span>
              {/if}
            </td>
            <td class="p-3">
              <StatusBadge status={show.groupStatus} />
            </td>
            <td class="p-3">
              <AssetIndicators assets={{ hasPoster: show.assets?.hasPoster, hasNfo: show.assets?.hasNfo }} showFanart={false} />
            </td>
            <td class="p-3">
              <div class="flex gap-1">
                <button
                  class="inline-flex items-center justify-center rounded-md border border-input bg-background px-2 text-xs font-medium hover:bg-accent h-7"
                  onclick={(event) => {
                    event.stopPropagation();
                    onOpenDetail(show);
                  }}
                >
                  详情
                </button>
                <button
                  class="inline-flex items-center justify-center rounded-md border border-input bg-background px-2 text-xs font-medium hover:bg-accent h-7"
                  onclick={(event) => {
                    event.stopPropagation();
                    onOpenSearch(show);
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
