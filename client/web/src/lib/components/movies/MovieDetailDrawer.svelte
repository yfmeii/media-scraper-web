<script lang="ts">
  import { fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import type { MovieInfo } from '$lib/api';
  import { formatFileSize } from '$lib/format';
  import { copyPath, detailDelay } from '$lib/mediaDetail';
  import type { ActionButton } from '$lib/components/mediaDetailActions';
  import { DetailDrawer, MediaDetailActions, MediaDetailHeader, MediaOverview } from '$lib/components';

  type StatusBadgeView = {
    label: string;
    color: string;
    bgColor: string;
    border: string;
  };

  let {
    movie,
    visible,
    fanartUrl,
    metaItems,
    statusBadge,
    overviewExpanded = $bindable(false),
    operationMessage,
    actions,
    onClose,
  }: {
    movie: MovieInfo | null;
    visible: boolean;
    fanartUrl?: string;
    metaItems: string[];
    statusBadge: StatusBadgeView;
    overviewExpanded?: boolean;
    operationMessage: string;
    actions: ActionButton[];
    onClose: () => void;
  } = $props();

  const overview = $derived.by(() => movie?.overview?.trim() || '');
</script>

{#if visible && movie}
  <DetailDrawer show={visible} onClose={onClose} title={movie.name}>
    <MediaDetailHeader
      fanartUrl={fanartUrl}
      posterPath={movie.posterPath}
      title={movie.name}
      metaItems={metaItems}
      statusBadge={statusBadge}
      subtitle={movie.tagline}
      animationDelay={detailDelay(0)}
    />

    <div class="px-4 pb-6 pt-2 space-y-6">
      <MediaOverview
        overview={overview}
        maxLength={160}
        bind:expanded={overviewExpanded}
        animationDelay={detailDelay(1)}
        lineClampClass="line-clamp-4"
      />

      <section class="space-y-3" in:fly={{ y: 18, duration: 300, delay: detailDelay(2), easing: quintOut }}>
        <h3 class="text-sm font-semibold">元数据</h3>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="rounded-lg border border-border/60 bg-muted/30 p-3">
            <p class="text-xs text-muted-foreground">TMDB</p>
            {#if movie.tmdbId}
              <a
                class="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:opacity-80"
                href={`https://www.themoviedb.org/movie/${movie.tmdbId}`}
                target="_blank"
                rel="noreferrer"
              >
                #{movie.tmdbId}
                <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
              </a>
            {:else}
              <p class="mt-1 text-sm font-medium">未匹配</p>
            {/if}
          </div>
          <div class="rounded-lg border border-border/60 bg-muted/30 p-3">
            <p class="text-xs text-muted-foreground">状态</p>
            <span class="mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-xs {statusBadge.bgColor} {statusBadge.border} {statusBadge.color}">
              {statusBadge.label}
            </span>
          </div>
          <button
            class="col-span-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-left hover:bg-muted/50"
            title="点击复制路径"
            onclick={() => copyPath(movie.path)}
          >
            <p class="text-xs text-muted-foreground">路径</p>
            <p class="mt-1 font-mono text-xs break-all">{movie.path}</p>
            <p class="mt-1 text-[11px] text-muted-foreground">点击复制</p>
          </button>
          <div class="col-span-2 rounded-lg border border-border/60 bg-muted/30 p-3">
            <p class="text-xs text-muted-foreground">资源完整性</p>
            <div class="mt-2 flex flex-wrap gap-3">
              <span class="flex items-center gap-1 text-xs {movie.assets?.hasPoster ? 'text-green-500' : 'text-red-500'}">
                {#if movie.assets?.hasPoster}
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                {:else}
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                {/if}
                海报
              </span>
              <span class="flex items-center gap-1 text-xs {movie.assets?.hasNfo ? 'text-green-500' : 'text-red-500'}">
                {#if movie.assets?.hasNfo}
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                {:else}
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                {/if}
                NFO
              </span>
              <span class="flex items-center gap-1 text-xs {movie.assets?.hasFanart ? 'text-green-500' : 'text-red-500'}">
                {#if movie.assets?.hasFanart}
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

      {#if movie.file}
        <section class="space-y-3" in:fly={{ y: 18, duration: 300, delay: detailDelay(3), easing: quintOut }}>
          <h3 class="text-sm font-semibold">文件技术信息</h3>
          <div class="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-3">
            <div>
              <p class="text-xs text-muted-foreground">文件</p>
              <p class="mt-1 text-sm font-medium break-all">{movie.file.name}</p>
            </div>
            <div class="flex flex-wrap gap-2">
              {#if movie.file.parsed.resolution}
                <span class="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-500">
                  {movie.file.parsed.resolution}
                </span>
              {/if}
              {#if movie.file.parsed.codec}
                <span class="rounded-md border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-500">
                  {movie.file.parsed.codec}
                </span>
              {/if}
              {#if movie.file.parsed.source}
                <span class="rounded-md border border-border/60 bg-background/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {movie.file.parsed.source}
                </span>
              {/if}
              <span class="rounded-md border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500">
                {formatFileSize(movie.file.size)}
              </span>
            </div>
          </div>
        </section>
      {/if}
    </div>

    {#snippet footer()}
      <MediaDetailActions {actions} {operationMessage} />
    {/snippet}
  </DetailDrawer>
{/if}

<style lang="postcss">
  @reference "tailwindcss";

  .line-clamp-4 {
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
