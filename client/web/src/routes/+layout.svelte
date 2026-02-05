<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { GlobalConfirmDialog } from '$lib/components';
  
  $: currentPath = $page.url.pathname;
</script>

<div class="min-h-screen bg-background">
  <header class="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
    <div class="container mx-auto px-4 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <svg class="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect width="18" height="18" x="3" y="3" rx="2"/>
          <path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/>
          <path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/>
        </svg>
        <h1 class="text-xl font-semibold">MediaScraper</h1>
      </div>
      
      <nav class="hidden md:flex items-center gap-6">
        <a href="/" class="text-sm font-medium transition-colors {currentPath === '/' ? 'text-foreground' : 'text-muted-foreground hover:text-primary'}">首页</a>
        <a href="/inbox" class="text-sm font-medium transition-colors {currentPath === '/inbox' ? 'text-foreground' : 'text-muted-foreground hover:text-primary'}">收件箱</a>
        <a href="/tv" class="text-sm font-medium transition-colors {currentPath === '/tv' ? 'text-foreground' : 'text-muted-foreground hover:text-primary'}">电视剧</a>
        <a href="/movies" class="text-sm font-medium transition-colors {currentPath === '/movies' ? 'text-foreground' : 'text-muted-foreground hover:text-primary'}">电影</a>
      </nav>
    </div>
  </header>
  
  <slot />
</div>

<!-- 全局确认对话框 -->
<GlobalConfirmDialog />
