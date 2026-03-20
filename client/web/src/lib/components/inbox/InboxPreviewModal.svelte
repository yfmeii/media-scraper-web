<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import type { PreviewAction, PreviewPlan } from '$lib/api';

  let {
    show = false,
    isLoading = false,
    actions = [],
    summary = null,
    onClose,
    onConfirm,
  }: {
    show?: boolean;
    isLoading?: boolean;
    actions?: PreviewAction[];
    summary?: PreviewPlan['impactSummary'] | null;
    onClose?: () => void;
    onConfirm?: () => void;
  } = $props();
</script>

{#if show}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" transition:fade={{ duration: 200 }}>
    <div class="w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-lg max-h-[80vh] flex flex-col" transition:scale={{ duration: 200, start: 0.95, easing: quintOut }}>
      <h3 class="text-lg font-semibold mb-4">移动预览</h3>
      {#if isLoading}
        <div class="flex-1 flex items-center justify-center py-8">
          <svg class="h-6 w-6 animate-spin text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          <span class="ml-2 text-muted-foreground">加载中...</span>
        </div>
      {:else if actions.length === 0}
        <div class="flex-1 flex items-center justify-center py-8 text-muted-foreground">无法生成预览</div>
      {:else}
        {#if summary}
          <div class="flex gap-4 mb-4 text-xs">
            <span class="text-muted-foreground">移动: <span class="text-foreground font-medium">{summary.filesMoving}</span></span>
            <span class="text-muted-foreground">创建 NFO: <span class="text-foreground font-medium">{summary.nfoCreating}</span></span>
            {#if summary.nfoOverwriting > 0}
              <span class="text-yellow-500">覆盖 NFO: <span class="font-medium">{summary.nfoOverwriting}</span></span>
            {/if}
          </div>
        {/if}

        <div class="flex-1 overflow-y-auto space-y-2 mb-4">
          {#each actions as action}
            <div class="p-3 rounded-lg border border-border text-xs">
              <div class="flex items-center gap-2 mb-1">
                {#if action.type === 'move'}
                  <svg class="h-4 w-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  <span class="text-green-500 font-medium">移动</span>
                {:else if action.type === 'create-nfo'}
                  <svg class="h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                  <span class="text-blue-500 font-medium">创建 NFO</span>
                {:else if action.type === 'create-dir'}
                  <svg class="h-4 w-4 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M12 10v6"/><path d="m9 13 3-3 3 3"/></svg>
                  <span class="text-purple-500 font-medium">创建目录</span>
                {:else if action.type === 'download-poster'}
                  <svg class="h-4 w-4 text-cyan-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                  <span class="text-cyan-500 font-medium">下载海报</span>
                {/if}
                {#if action.willOverwrite}
                  <span class="text-[10px] text-yellow-500 border border-yellow-500/50 rounded px-1">覆盖</span>
                {/if}
              </div>
              {#if action.source}
                <div class="font-mono text-muted-foreground truncate">{action.source}</div>
                <div class="flex items-center gap-1 my-1">
                  <svg class="h-3 w-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
                </div>
              {/if}
              <div class="font-mono truncate">{action.destination}</div>
            </div>
          {/each}
        </div>
      {/if}
      <div class="flex justify-end gap-2 pt-4 border-t border-border">
        <button class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 border border-input bg-background hover:bg-accent" onclick={onClose}>关闭</button>
        <button class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50" disabled={actions.length === 0 || isLoading} onclick={onConfirm}>确认执行</button>
      </div>
    </div>
  </div>
{/if}
