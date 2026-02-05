<script lang="ts">
  type Size = 'sm' | 'md' | 'lg';
  
  let {
    src,
    alt = '',
    hasPoster = false,
    size = 'sm' as Size,
    class: className = ''
  }: {
    src?: string;
    alt?: string;
    hasPoster?: boolean;
    size?: Size;
    class?: string;
  } = $props();

  const sizeClasses: Record<Size, string> = {
    sm: 'h-12 w-9',
    md: 'h-20 w-14',
    lg: 'h-28 w-20'
  };
  
  const sizeClass = $derived(sizeClasses[size]);
</script>

{#if src}
  <img 
    {src} 
    {alt}
    class="object-cover rounded {sizeClass} {className}"
  />
{:else if hasPoster}
  <div class="flex items-center justify-center rounded bg-primary/10 {sizeClass} {className}">
    <svg class="h-5 w-5 text-primary/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
      <circle cx="9" cy="9" r="2"/>
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
    </svg>
  </div>
{:else}
  <div class="flex items-center justify-center rounded bg-muted text-muted-foreground {sizeClass} {className}">
    <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
      <circle cx="9" cy="9" r="2"/>
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
    </svg>
  </div>
{/if}
