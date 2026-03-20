<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import type { MediaFile, PathRecognizeResult, SearchResult } from '$lib/api';

  let {
    show = false,
    detailFile = null,
    selectedCandidate = null,
    targetPath = '',
    isLoadingTargetPath = false,
    isOperating = false,
    manualSearchQuery = '',
    isSearchingTMDB = false,
    isAIRecognizing = false,
    editSeason = 1,
    editEpisode = 1,
    aiRecognizeResult = null,
    matchCandidates = [],
    inferCandidateMediaType,
    onClose,
    onOutroEnd,
    onShowPreview,
    onProcess,
    onManualSearch,
    onAIRecognize,
    onManualSearchQueryChange,
    onSelectCandidate,
    onEditSeasonChange,
    onEditEpisodeChange,
  }: {
    show?: boolean;
    detailFile?: MediaFile | null;
    selectedCandidate?: SearchResult | null;
    targetPath?: string;
    isLoadingTargetPath?: boolean;
    isOperating?: boolean;
    manualSearchQuery?: string;
    isSearchingTMDB?: boolean;
    isAIRecognizing?: boolean;
    editSeason?: number;
    editEpisode?: number;
    aiRecognizeResult?: PathRecognizeResult | null;
    matchCandidates?: SearchResult[];
    inferCandidateMediaType: (candidate: SearchResult | null) => 'tv' | 'movie';
    onClose?: () => void;
    onOutroEnd?: () => void;
    onShowPreview?: () => void;
    onProcess?: () => void;
    onManualSearch?: () => void;
    onAIRecognize?: () => void;
    onManualSearchQueryChange?: (value: string) => void;
    onSelectCandidate?: (candidate: SearchResult) => void;
    onEditSeasonChange?: (value: number) => void;
    onEditEpisodeChange?: (value: number) => void;
  } = $props();

  function toPositiveNumber(value: string, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  }
</script>

{#if show && detailFile}
  <div class="fixed inset-0 z-50 flex items-center justify-center" transition:fade={{ duration: 200 }} onoutroend={onOutroEnd}>
    <button type="button" class="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-label="关闭详情" onclick={onClose}></button>
    <div class="relative bg-card w-full max-w-4xl max-h-[85vh] rounded-xl shadow-2xl overflow-hidden flex flex-col border border-border ring-1 ring-white/10" transition:scale={{ duration: 250, start: 0.96, easing: quintOut }}>
      <div class="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
        <h3 class="text-base font-semibold flex items-center gap-2">
          <div class="p-1.5 rounded-md bg-primary/10 text-primary">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          </div>
          <span>文件入库详情</span>
        </h3>
        <button type="button" class="h-8 w-8 rounded-full hover:bg-accent flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground" aria-label="关闭详情" onclick={onClose}>
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 15-6-6-6 6"/></svg>
        </button>
      </div>

      <div class="flex-1 overflow-hidden flex">
        <div class="w-[320px] flex flex-col border-r border-border bg-muted/10 p-5 gap-6 overflow-y-auto custom-scrollbar">
          <div class="space-y-3">
            <div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">原始文件</div>
            <div class="p-3 rounded-lg bg-card border border-border shadow-sm space-y-2">
              <div class="font-medium text-sm break-all leading-snug" title={detailFile.name}>{detailFile.name}</div>
              <div class="flex flex-wrap gap-1.5">
                {#if detailFile.kind !== 'unknown'}<span class="px-1.5 py-0.5 rounded-md bg-primary/10 text-[10px] text-primary font-medium border border-primary/20 uppercase">{detailFile.kind}</span>{/if}
                {#if detailFile.parsed.resolution}<span class="px-1.5 py-0.5 rounded-md bg-muted text-[10px] text-muted-foreground border border-border">{detailFile.parsed.resolution}</span>{/if}
                {#if detailFile.parsed.codec}<span class="px-1.5 py-0.5 rounded-md bg-muted text-[10px] text-muted-foreground border border-border">{detailFile.parsed.codec}</span>{/if}
                {#if detailFile.parsed.year}<span class="px-1.5 py-0.5 rounded-md bg-muted text-[10px] text-muted-foreground border border-border">{detailFile.parsed.year}</span>{/if}
                {#if detailFile.parsed.season !== undefined}<span class="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-500 text-[10px] border border-blue-500/20 font-medium">S{String(detailFile.parsed.season).padStart(2, '0')}</span>{/if}
                {#if detailFile.parsed.episode !== undefined}<span class="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-500 text-[10px] border border-blue-500/20 font-medium">E{String(detailFile.parsed.episode).padStart(2, '0')}</span>{/if}
              </div>
            </div>
          </div>

          <div class="flex-1 flex flex-col min-h-0 space-y-2">
            <div class="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>入库预览</span>
              {#if selectedCandidate}
                <span class="text-[10px] text-green-500 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>已匹配</span>
              {/if}
            </div>
            <div class="p-3 rounded-lg bg-muted/30 border border-border text-xs font-mono break-all flex-1 relative group">
              {#if targetPath}
                <div class="text-foreground leading-relaxed">{targetPath}</div>
              {:else if isLoadingTargetPath}
                <div class="absolute inset-0 flex items-center justify-center text-muted-foreground/60 italic text-center px-4">计算中...</div>
              {:else}
                <div class="absolute inset-0 flex items-center justify-center text-muted-foreground/50 italic text-center px-4">请在右侧选择匹配结果</div>
              {/if}
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 mt-auto pt-2">
            <button class="inline-flex items-center justify-center rounded-lg text-xs font-medium h-10 px-3 border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-all active:scale-[0.98]" disabled={!selectedCandidate} onclick={onShowPreview}>预览计划</button>
            <button class="inline-flex items-center justify-center rounded-lg text-xs font-medium h-10 px-3 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-sm" disabled={!selectedCandidate || isOperating} onclick={onProcess}>
              {#if isOperating}
                <svg class="h-3.5 w-3.5 animate-spin mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                处理中...
              {:else}
                立即入库
              {/if}
            </button>
          </div>
        </div>

        <div class="flex-1 flex flex-col min-w-0 bg-background">
          <div class="p-4 border-b border-border space-y-3 bg-card/50">
            <div class="flex gap-2">
              <div class="relative flex-1 group">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg class="h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </div>
                <input
                  type="text"
                  class="w-full h-10 rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                  value={manualSearchQuery}
                  placeholder="搜索电影或剧集..."
                  oninput={(e) => onManualSearchQueryChange?.((e.currentTarget as HTMLInputElement).value)}
                  onkeydown={(e) => e.key === 'Enter' && onManualSearch?.()}
                />
              </div>
              <button class="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all active:scale-[0.98] shadow-sm" onclick={onManualSearch} disabled={isSearchingTMDB}>{isSearchingTMDB ? '...' : '搜索'}</button>
            </div>

            <div class="flex items-center justify-between gap-4">
              <button class="h-8 px-3 rounded-md bg-purple-500/10 text-purple-600 border border-purple-500/20 text-xs font-medium hover:bg-purple-500/20 transition-all active:scale-[0.98] flex items-center gap-1.5" disabled={isAIRecognizing} onclick={onAIRecognize}>
                {#if isAIRecognizing}
                  <svg class="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                {:else}
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/></svg>
                {/if}
                AI 智能识别
              </button>

              {#if inferCandidateMediaType(selectedCandidate) === 'tv'}
                <div class="flex items-center gap-3 text-xs bg-muted/30 px-3 py-1.5 rounded-md border border-border/50">
                  <span class="text-muted-foreground font-medium">手动修正:</span>
                  <div class="flex items-center gap-2">
                    <label class="flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors">
                      <span>第</span>
                      <input type="number" min="1" class="w-10 h-6 rounded border border-input bg-background text-center focus:ring-1 focus:ring-primary text-xs" value={editSeason} oninput={(e) => onEditSeasonChange?.(toPositiveNumber((e.currentTarget as HTMLInputElement).value, editSeason))} />
                      <span>季</span>
                    </label>
                    <span class="text-border">|</span>
                    <label class="flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors">
                      <span>第</span>
                      <input type="number" min="1" class="w-10 h-6 rounded border border-input bg-background text-center focus:ring-1 focus:ring-primary text-xs" value={editEpisode} oninput={(e) => onEditEpisodeChange?.(toPositiveNumber((e.currentTarget as HTMLInputElement).value, editEpisode))} />
                      <span>集</span>
                    </label>
                  </div>
                </div>
              {/if}
            </div>
          </div>

          {#if aiRecognizeResult}
            <div class="px-4 pt-4">
              <div class="flex items-start gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20 text-xs animate-in slide-in-from-top-2 duration-300">
                <div class="p-1 rounded-full bg-green-500/10 text-green-600 mt-0.5">
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between mb-1">
                    <span class="font-medium text-foreground">AI 推荐结果</span>
                    <span class="text-[10px] text-green-600/80 font-medium">{(aiRecognizeResult.confidence * 100).toFixed(0)}% 置信度</span>
                  </div>
                  <div class="text-muted-foreground truncate">
                    {aiRecognizeResult.title}
                    {#if aiRecognizeResult.season}S{String(aiRecognizeResult.season).padStart(2, '0')}{/if}
                    {#if aiRecognizeResult.episode}E{String(aiRecognizeResult.episode).padStart(2, '0')}{/if}
                  </div>
                </div>
              </div>
            </div>
          {/if}

          <div class="flex-1 overflow-y-auto custom-scrollbar p-4 min-h-0">
            {#if matchCandidates.length > 0}
              <div class="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-4 content-start">
                {#each matchCandidates as candidate}
                  <button class="group relative flex flex-col gap-2 p-2 rounded-xl border-2 text-left transition-all hover:shadow-md active:scale-[0.98] {selectedCandidate?.id === candidate.id ? 'border-primary' : 'border-transparent hover:border-primary/50 hover:bg-accent/30'}" onclick={() => onSelectCandidate?.(candidate)}>
                    <div class="aspect-2/3 w-full bg-muted rounded-lg overflow-hidden relative shadow-sm">
                      {#if candidate.posterPath}
                        <img src={candidate.posterPath} alt={candidate.name || candidate.title} class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      {:else}
                        <div class="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2 p-2 text-center">
                          <svg class="h-8 w-8 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                          <span class="text-[10px] opacity-50">无海报</span>
                        </div>
                      {/if}
                      <div class="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-[8px] text-white font-medium backdrop-blur-sm shadow-sm">{inferCandidateMediaType(candidate) === 'movie' ? '电影' : '剧集'}</div>
                      {#if candidate.releaseDate || candidate.firstAirDate}
                        <div class="absolute bottom-0 left-0 right-0 p-1.5 bg-linear-to-t from-black/80 to-transparent">
                          <div class="text-[10px] text-white font-medium text-center">{candidate.releaseDate?.slice(0, 4) || candidate.firstAirDate?.slice(0, 4)}</div>
                        </div>
                      {/if}
                    </div>
                    <div class="space-y-1 px-1 pb-1">
                      <div class="font-medium text-xs leading-tight line-clamp-2" title={candidate.name || candidate.title}>{candidate.name || candidate.title}</div>
                      <div class="text-[10px] text-muted-foreground font-mono opacity-70">ID: {candidate.id}</div>
                    </div>
                  </button>
                {/each}
              </div>
            {:else if manualSearchQuery}
              <div class="h-full flex flex-col items-center justify-center text-muted-foreground space-y-3 opacity-60">
                <div class="p-4 rounded-full bg-muted/50">
                  <svg class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6M8 11h6"/></svg>
                </div>
                <span class="text-sm">未找到相关结果</span>
              </div>
            {:else}
              <div class="h-full flex flex-col items-center justify-center text-muted-foreground space-y-3 opacity-40">
                <div class="p-4 rounded-full bg-muted/50">
                  <svg class="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </div>
                <div class="text-center space-y-1">
                  <span class="text-sm block">输入关键词开始搜索</span>
                  <span class="text-xs block">或使用 AI 智能识别</span>
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
