<script lang="ts">
  import { fly, slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { formatFileSize } from '$lib/format';
  import { copyPath, detailDelay } from '$lib/mediaDetail';
  import type { ActionButton } from '$lib/components/mediaDetailActions';
  import { DetailDrawer, MediaDetailActions, MediaDetailHeader, MediaOverview } from '$lib/components';
  import { getSeasonMissingEpisodes } from '@media-scraper/shared/format';
  import type { SeasonMissingInfo, ShowInfo } from '@media-scraper/shared/types';
  import { resolveShowEpisodeCount, resolveShowSeasonCount, sortEpisodes, sortSeasons } from '$lib/tvDetail';

  type StatusBadgeView = {
    label: string;
    color: string;
    bgColor: string;
    border: string;
  };

  let {
    show,
    visible,
    showFanartUrl,
    showMetaItems,
    showStatusBadge,
    showMissingEpisodes,
    overviewExpanded = $bindable(false),
    openSeasons,
    isOperating,
    operationMessage,
    actions,
    onClose,
    onToggleSeason,
    onRefreshSeason,
    onRefreshEpisode,
    onMoveToInbox,
  }: {
    show: ShowInfo | null;
    visible: boolean;
    showFanartUrl: string;
    showMetaItems: string[];
    showStatusBadge: StatusBadgeView;
    showMissingEpisodes: SeasonMissingInfo[];
    overviewExpanded?: boolean;
    openSeasons: Set<number>;
    isOperating: boolean;
    operationMessage: string;
    actions: ActionButton[];
    onClose: () => void;
    onToggleSeason: (season: number) => void;
    onRefreshSeason: (season: number) => void;
    onRefreshEpisode: (season: number, episode: number) => void;
    onMoveToInbox: (filePath: string, fileName: string) => void;
  } = $props();

  const showOverview = $derived.by(() => show?.overview?.trim() || '');
</script>

{#if visible && show}
  <DetailDrawer show={visible} onClose={onClose} title={show.name}>
    <MediaDetailHeader
      fanartUrl={showFanartUrl}
      posterPath={show.posterPath}
      title={show.name}
      metaItems={showMetaItems}
      statusBadge={showStatusBadge}
      animationDelay={detailDelay(0)}
    />

    <div class="px-4 pb-6 pt-2 space-y-6">
      <MediaOverview
        overview={showOverview}
        maxLength={140}
        bind:expanded={overviewExpanded}
        animationDelay={detailDelay(1)}
        lineClampClass="line-clamp-3"
      />

      <section class="space-y-3" in:fly={{ y: 18, duration: 300, delay: detailDelay(2), easing: quintOut }}>
        <h3 class="text-sm font-semibold">元数据</h3>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="rounded-lg border border-border/60 bg-muted/30 p-3">
            <p class="text-xs text-muted-foreground">TMDB</p>
            {#if show.tmdbId}
              <a class="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:opacity-80" href={`https://www.themoviedb.org/tv/${show.tmdbId}`} target="_blank" rel="noreferrer">
                #{show.tmdbId}
                <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
              </a>
            {:else}
              <p class="mt-1 text-sm font-medium">未匹配</p>
            {/if}
          </div>
          <div class="rounded-lg border border-border/60 bg-muted/30 p-3">
            <p class="text-xs text-muted-foreground">状态</p>
            <span class="mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-xs {showStatusBadge.bgColor} {showStatusBadge.border} {showStatusBadge.color}">
              {showStatusBadge.label}
            </span>
          </div>
          <button class="col-span-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-left hover:bg-muted/50" title="点击复制路径" onclick={() => copyPath(show.path)}>
            <p class="text-xs text-muted-foreground">路径</p>
            <p class="mt-1 font-mono text-xs break-all">{show.path}</p>
            <p class="mt-1 text-[11px] text-muted-foreground">点击复制</p>
          </button>
          <div class="col-span-2 rounded-lg border border-border/60 bg-muted/30 p-3">
            <p class="text-xs text-muted-foreground">资源完整性</p>
            <div class="mt-2 flex flex-wrap gap-3">
              <span class="flex items-center gap-1 text-xs {show.assets?.hasPoster ? 'text-green-500' : 'text-red-500'}">
                {#if show.assets?.hasPoster}
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                {:else}
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                {/if}
                海报
              </span>
              <span class="flex items-center gap-1 text-xs {show.assets?.hasNfo ? 'text-green-500' : 'text-red-500'}">
                {#if show.assets?.hasNfo}
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                {:else}
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                {/if}
                NFO
              </span>
              <span class="flex items-center gap-1 text-xs {show.assets?.hasFanart ? 'text-green-500' : 'text-red-500'}">
                {#if show.assets?.hasFanart}
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                {:else}
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                {/if}
                Fanart
              </span>
            </div>
          </div>
        </div>
      </section>

      {#if showMissingEpisodes.length > 0}
        <section class="space-y-2" in:fly={{ y: 18, duration: 300, delay: detailDelay(3), easing: quintOut }}>
          <div class="flex items-center gap-2">
            <svg class="h-4 w-4 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <h3 class="text-sm font-semibold text-orange-500">缺集检测</h3>
          </div>
          <div class="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
            <div class="flex flex-wrap gap-1.5">
              {#each showMissingEpisodes as item}
                {#each item.missing as epNum}
                  <span class="inline-flex items-center rounded border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-xs font-mono text-orange-500">
                    S{String(item.season).padStart(2, '0')}E{String(epNum).padStart(2, '0')}
                  </span>
                {/each}
              {/each}
            </div>
            <p class="mt-2 text-[11px] text-muted-foreground">
              共缺 {showMissingEpisodes.reduce((sum, item) => sum + item.missing.length, 0)} 集，检测逻辑：每季最小集号到最大集号之间的空缺
            </p>
          </div>
        </section>
      {/if}

      <section class="space-y-3" in:fly={{ y: 18, duration: 300, delay: detailDelay(showMissingEpisodes.length > 0 ? 4 : 3), easing: quintOut }}>
        <h3 class="text-sm font-semibold">季/集文件</h3>
        <div class="space-y-3">
          {#if !show.detailLoaded}
            <div class="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
              详情按需加载中，打开条目后才会读取完整季集文件。
            </div>
          {/if}
          {#each sortSeasons(show.seasons) as seasonItem (seasonItem.season)}
            {@const seasonMissing = getSeasonMissingEpisodes(seasonItem.episodes)}
            <div class="rounded-lg border {seasonMissing.length > 0 ? 'border-orange-500/40' : 'border-border/60'} bg-muted/30">
              <div class="flex items-center justify-between gap-3 p-3 cursor-pointer hover:bg-muted/50" role="button" tabindex="0" aria-expanded={openSeasons.has(seasonItem.season)} onclick={() => onToggleSeason(seasonItem.season)} onkeydown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onToggleSeason(seasonItem.season);
                }
              }}>
                <div class="flex items-center gap-2">
                    <span class="text-sm font-medium">第 {seasonItem.season} 季</span>
                    <span class="text-xs text-muted-foreground">{seasonItem.episodes.length} 集</span>
                  {#if seasonMissing.length > 0}
                    <span class="inline-flex items-center gap-0.5 rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[11px] font-medium text-orange-500">
                      <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                      缺 {seasonMissing.length} 集
                    </span>
                  {/if}
                </div>
                <div class="flex items-center gap-2">
                  <button class="inline-flex items-center justify-center rounded h-6 w-6 hover:bg-accent text-muted-foreground hover:text-foreground" title="刷新该季元数据" disabled={isOperating || !show.tmdbId} onclick={(event) => {
                    event.stopPropagation();
                    onRefreshSeason(seasonItem.season);
                  }}>
                    <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                  </button>
                  <svg class="h-4 w-4 text-muted-foreground transition-transform {openSeasons.has(seasonItem.season) ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
              {#if openSeasons.has(seasonItem.season)}
                <div class="px-3 pb-3 space-y-1" transition:slide={{ duration: 200 }}>
                  {#each sortEpisodes(seasonItem.episodes) as ep}
                    <div class="flex items-center justify-between p-2 rounded-md hover:bg-muted/30 text-xs group/ep">
                      <div class="flex items-center gap-2 flex-1 min-w-0">
                        <span class="text-muted-foreground shrink-0">E{String(ep.parsed.episode || 0).padStart(2, '0')}</span>
                        <span class="truncate" title={ep.name}>{ep.name}</span>
                      </div>
                      <div class="flex items-center gap-1 shrink-0 ml-2">
                        <span class="text-muted-foreground mr-2">{formatFileSize(ep.size)}</span>
                        <button class="inline-flex items-center justify-center rounded h-5 w-5 opacity-0 group-hover/ep:opacity-100 hover:bg-accent text-muted-foreground hover:text-foreground transition-opacity" title="刷新该集元数据" disabled={isOperating || !show.tmdbId} onclick={() => onRefreshEpisode(seasonItem.season, ep.parsed.episode || 0)}>
                          <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                        </button>
                        <button class="inline-flex items-center justify-center rounded h-5 w-5 opacity-0 group-hover/ep:opacity-100 hover:bg-accent text-orange-500 hover:text-orange-600 transition-opacity" title="移回收件箱" disabled={isOperating} onclick={() => onMoveToInbox(ep.path, ep.name)}>
                          <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
                        </button>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
        {#if !show.detailLoaded}
          <p class="text-xs text-muted-foreground">当前列表仅展示表层统计：共 {resolveShowSeasonCount(show)} 季，{resolveShowEpisodeCount(show)} 集。</p>
        {/if}
      </section>
    </div>

    {#snippet footer()}
      <MediaDetailActions actions={actions} operationMessage={operationMessage} />
    {/snippet}
  </DetailDrawer>
{/if}

<style lang="postcss">
  @reference "tailwindcss";

  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
