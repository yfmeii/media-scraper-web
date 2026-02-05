<script lang="ts">
  import { getGroupStatusBadge } from '$lib/format';
  
  type StatusType = 'scraped' | 'unscraped' | 'supplement' | undefined;

  let {
    status,
    size = 'sm' as 'sm' | 'md'
  }: {
    status?: StatusType;
    size?: 'sm' | 'md';
  } = $props();

  const badge = $derived(getGroupStatusBadge(status));
  const sizeClass = $derived(size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm');
</script>

<span 
  class="inline-flex items-center gap-1 rounded-full border {sizeClass} {badge.bgColor} {badge.border} {badge.color}"
>
  {badge.label}
</span>
