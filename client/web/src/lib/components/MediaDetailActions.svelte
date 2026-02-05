<script lang="ts">
  type ActionButton = {
    label: string;
    icon?: 'refresh' | 'search' | 'upload';
    variant?: 'primary' | 'secondary';
    disabled?: boolean;
    onclick: () => void;
  };

  let {
    actions,
    operationMessage = '',
    class: className = ''
  }: {
    actions: ActionButton[];
    operationMessage?: string;
    class?: string;
  } = $props();

  const icons = {
    refresh: `<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>`,
    search: `<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>`,
    upload: `<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>`
  };
</script>

<div class="shrink-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 space-y-3 {className}">
  {#if operationMessage}
    <div class="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
      <svg class="h-4 w-4 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      <span>{operationMessage}</span>
    </div>
  {/if}
  <div class="flex items-center gap-2">
    {#each actions as action, i}
      {@const isPrimary = action.variant === 'primary' || i === 0}
      <button 
        class="{isPrimary ? 'flex-1' : ''} inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium h-10 px-4 transition-colors disabled:opacity-50 {isPrimary ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border border-border bg-background hover:bg-accent'}"
        disabled={action.disabled}
        onclick={action.onclick}
      >
        {#if action.icon}
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            {@html icons[action.icon]}
          </svg>
        {/if}
        {action.label}
      </button>
    {/each}
  </div>
</div>
