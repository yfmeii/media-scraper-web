<script lang="ts">
  let {
    isOperating = false,
    message = '',
    progress = null
  }: {
    isOperating?: boolean;
    message?: string;
    progress?: { current: number; total: number } | null;
  } = $props();
</script>

{#if isOperating || message}
  <div class="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
    <div class="bg-card rounded-lg shadow-lg border border-border px-4 py-3 flex items-center gap-3">
      {#if isOperating}
        <svg class="h-5 w-5 animate-spin text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      {/if}
      
      <div class="text-sm">
        {message}
      </div>
      
      {#if progress && progress.total > 0}
        <div class="flex items-center gap-2">
          <div class="w-24 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              class="h-full bg-primary rounded-full transition-all"
              style="width: {(progress.current / progress.total) * 100}%"
            />
          </div>
          <span class="text-xs text-muted-foreground">
            {progress.current}/{progress.total}
          </span>
        </div>
      {/if}
    </div>
  </div>
{/if}
