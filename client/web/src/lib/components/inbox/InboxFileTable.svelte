<script lang="ts">
  import { flip } from 'svelte/animate';
  import { fly, scale } from 'svelte/transition';
  import { cubicOut, quintOut } from 'svelte/easing';
  import type { MediaFile } from '$lib/api';

  type FileProcessStatus = 'processing' | 'success' | 'failed';

  let {
    loading = false,
    filteredFiles = [],
    selectedFiles = new Set<string>(),
    fileStatus = new Map<string, FileProcessStatus>(),
    onToggleAll,
    onToggleFile,
    onToggleFileSelection,
    onDoubleClick,
  }: {
    loading?: boolean;
    filteredFiles?: MediaFile[];
    selectedFiles?: Set<string>;
    fileStatus?: Map<string, FileProcessStatus>;
    onToggleAll?: () => void;
    onToggleFile?: (path: string, event: MouseEvent) => void;
    onToggleFileSelection?: (path: string, event: MouseEvent) => void;
    onDoubleClick?: (file: MediaFile) => void;
  } = $props();
</script>

<div class="flex-1 overflow-y-auto custom-scrollbar">
  {#if loading}
    <div class="p-4 space-y-3">
      <div class="h-8 bg-muted/40 rounded animate-pulse w-full"></div>
      {#each Array(10) as _}
        <div class="h-12 bg-muted/30 rounded animate-pulse w-full border-b border-border/50"></div>
      {/each}
    </div>
  {:else}
    <table class="w-full text-sm">
      <thead class="sticky top-0 bg-card border-b border-border">
        <tr>
          <th class="w-10 p-2 text-left">
            <input type="checkbox" class="h-4 w-4 rounded border-input accent-primary" checked={selectedFiles.size === filteredFiles.length && filteredFiles.length > 0} onchange={onToggleAll} />
          </th>
          <th class="p-2 text-left font-medium text-muted-foreground text-xs">文件名</th>
          <th class="p-2 text-left font-medium text-muted-foreground text-xs">解析结果</th>
          <th class="w-24 p-2 text-left font-medium text-muted-foreground text-xs">状态</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredFiles as file (file.path)}
          <tr
            class="border-b border-border hover:bg-accent/50 cursor-pointer {selectedFiles.has(file.path) ? 'bg-accent/30 border-l-2 border-l-primary' : 'border-l-2 border-l-transparent'} transition-all duration-200 active:scale-[0.995]"
            onclick={(e) => onToggleFile?.(file.path, e)}
            ondblclick={() => onDoubleClick?.(file)}
            animate:flip={{ duration: 300, easing: quintOut }}
            in:fly={{ y: 20, duration: 300, easing: cubicOut }}
          >
            <td class="p-2 w-10 text-center" onclick={(e) => e.stopPropagation()}>
              <label class="flex items-center justify-center w-full h-full p-1 -m-1 cursor-pointer">
                <input
                  type="checkbox"
                  class="h-4 w-4 rounded border-input accent-primary transition-all duration-200 cursor-pointer"
                  checked={selectedFiles.has(file.path)}
                  onclick={(e) => {
                    e.stopPropagation();
                    onToggleFileSelection?.(file.path, e);
                  }}
                />
              </label>
            </td>
            <td class="p-2">
              <div class="flex items-center gap-2">
                {#if file.kind !== 'unknown'}
                  <svg class="h-4 w-4 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/></svg>
                {:else}
                  <svg class="h-4 w-4 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                {/if}
                <span class="font-mono text-xs truncate max-w-[400px]" title={file.relativePath}>{file.name}</span>
              </div>
            </td>
            <td class="p-2">
              {#if file.parsed.title}
                <div class="flex items-center gap-2 text-xs">
                  <span>{file.parsed.title}</span>
                  {#if file.parsed.season !== undefined}
                    <span class="text-muted-foreground">S{String(file.parsed.season).padStart(2, '0')}</span>
                  {/if}
                  {#if file.parsed.episode !== undefined}
                    <span class="text-muted-foreground">E{String(file.parsed.episode).padStart(2, '0')}</span>
                  {/if}
                  {#if file.parsed.resolution}
                    <span class="rounded bg-secondary px-1 py-0.5 text-[10px]">{file.parsed.resolution}</span>
                  {/if}
                  {#if file.parsed.codec}
                    <span class="rounded bg-secondary px-1 py-0.5 text-[10px]">{file.parsed.codec}</span>
                  {/if}
                </div>
              {:else}
                <span class="text-xs text-muted-foreground">-</span>
              {/if}
            </td>
            <td class="p-2">
              {#if fileStatus.get(file.path) === 'processing'}
                <span class="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] text-primary" in:scale>
                  <svg class="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  处理中
                </span>
              {:else if fileStatus.get(file.path) === 'failed'}
                <span class="inline-flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-500" in:scale>
                  失败
                </span>
              {:else if fileStatus.get(file.path) === 'success' || file.isProcessed}
                <span class="inline-flex items-center gap-1 rounded border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[10px] text-green-500" in:scale>
                  已处理
                </span>
              {:else}
                <span class="inline-flex items-center gap-1 rounded border border-muted-foreground/20 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                  未处理
                </span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>
