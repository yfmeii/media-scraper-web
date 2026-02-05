<script lang="ts">
  let { rows = 8, columns = 6 }: { rows?: number; columns?: number } = $props();
</script>

<div class="animate-pulse">
  <!-- Header skeleton -->
  <div class="flex items-center gap-4 border-b border-border p-3 bg-muted/30">
    <div class="w-4 h-4 rounded bg-muted"></div>
    {#each Array(columns) as _, i}
      <div class="h-3 rounded bg-muted" style="width: {i === 0 ? '40px' : i === 1 ? '30%' : '60px'}"></div>
    {/each}
  </div>
  
  <!-- Row skeletons -->
  {#each Array(rows) as _, rowIndex}
    <div 
      class="flex items-center gap-4 border-b border-border p-3"
      style="animation-delay: {rowIndex * 50}ms"
    >
      <!-- Checkbox -->
      <div class="w-4 h-4 rounded bg-muted/60"></div>
      
      <!-- Poster -->
      <div class="w-10 h-14 rounded bg-muted/60 shrink-0"></div>
      
      <!-- Title -->
      <div class="flex-1 space-y-2">
        <div class="h-4 rounded bg-muted/60 w-3/4"></div>
        <div class="h-3 rounded bg-muted/40 w-1/2"></div>
      </div>
      
      <!-- Stats columns -->
      <div class="w-16 h-4 rounded bg-muted/40"></div>
      <div class="w-16 h-4 rounded bg-muted/40"></div>
      
      <!-- Status badge -->
      <div class="w-20 h-6 rounded-full bg-muted/50"></div>
      
      <!-- Action buttons -->
      <div class="flex gap-1">
        <div class="w-7 h-7 rounded bg-muted/40"></div>
        <div class="w-7 h-7 rounded bg-muted/40"></div>
      </div>
    </div>
  {/each}
</div>

<style>
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
</style>
