<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchStats, fetchTasks, fetchTaskStats, cancelTaskApi, type Stats, type TaskItem, type TaskStats } from '$lib/api';
  import { formatTime, getStatusDisplay, getTypeDisplay } from '$lib/format';
  
  let stats: Stats | null = null;
  let tasks: TaskItem[] = [];
  let taskStats: TaskStats | null = null;
  let loading = true;
  
  onMount(async () => {
    try {
      const [statsData, tasksData] = await Promise.all([
        fetchStats(),
        fetchTasks(10),
      ]);
      stats = statsData;
      tasks = tasksData.tasks;
      taskStats = tasksData.stats;
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  });
  
  async function handleCancelTask(id: string) {
    const success = await cancelTaskApi(id);
    if (success) {
      // Refresh tasks
      const tasksData = await fetchTasks(10);
      tasks = tasksData.tasks;
      taskStats = tasksData.stats;
    }
  }
  
  function viewTask(id: string) {
    // TODO: Open task detail modal
    console.log('View task:', id);
  }
</script>

<main class="container mx-auto px-4 py-8 space-y-8">
  <!-- Stats Overview -->
  <section>
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <div class="rounded-lg border border-border bg-card p-4">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-sm text-muted-foreground">剧集</p>
            <p class="text-2xl font-bold">{loading ? '...' : stats?.tvShows || 0}</p>
            <p class="text-xs text-muted-foreground">未刮削: {loading ? '...' : (stats?.tvShows || 0) - (stats?.tvProcessed || 0)}</p>
          </div>
          <svg class="h-6 w-6 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="15" x="2" y="7" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>
        </div>
      </div>
      <div class="rounded-lg border border-border bg-card p-4">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-sm text-muted-foreground">集数</p>
            <p class="text-2xl font-bold">{loading ? '...' : stats?.tvEpisodes || 0}</p>
            <p class="text-xs text-muted-foreground">&nbsp;</p>
          </div>
          <svg class="h-6 w-6 text-cyan-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11"/><rect width="14" height="14" x="2" y="5" rx="2"/></svg>
        </div>
      </div>
      <div class="rounded-lg border border-border bg-card p-4">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-sm text-muted-foreground">电影数</p>
            <p class="text-2xl font-bold">{loading ? '...' : stats?.movies || 0}</p>
            <p class="text-xs text-muted-foreground">已处理: {loading ? '...' : stats?.moviesProcessed || 0}</p>
          </div>
          <svg class="h-6 w-6 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/></svg>
        </div>
      </div>
      <div class="rounded-lg border border-border bg-card p-4">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-sm text-muted-foreground">收件箱</p>
            <p class="text-2xl font-bold">{loading ? '...' : stats?.inbox || 0}</p>
            <p class="text-xs text-muted-foreground">待处理</p>
          </div>
          <svg class="h-6 w-6 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
        </div>
      </div>
      <div class="rounded-lg border border-border bg-card p-4">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-sm text-muted-foreground">处理中</p>
            <p class="text-2xl font-bold">{loading ? '...' : taskStats?.running || 0}</p>
            <p class="text-xs text-muted-foreground">活动任务</p>
          </div>
          <svg class="h-6 w-6 text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
      </div>
      <div class="rounded-lg border border-border bg-card p-4">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-sm text-muted-foreground">失败</p>
            <p class="text-2xl font-bold">{loading ? '...' : taskStats?.failed || 0}</p>
            <p class="text-xs text-muted-foreground">需要关注</p>
          </div>
          <svg class="h-6 w-6 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
        </div>
      </div>
    </div>
  </section>
  
  <!-- Quick Actions -->
  <section>
    <h2 class="text-lg font-semibold mb-4">快速入口</h2>
    <div class="flex flex-wrap gap-3">
      <a href="/inbox" class="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 bg-primary text-primary-foreground hover:opacity-90">
        → 进入收件箱 ({stats?.inbox || 0})
      </a>
      <a href="/tv" class="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 bg-secondary text-secondary-foreground hover:opacity-90">
        → 剧集库
      </a>
      <a href="/movies" class="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 bg-secondary text-secondary-foreground hover:opacity-90">
        → 电影库
      </a>
      <button class="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 bg-secondary text-secondary-foreground hover:opacity-90">
        → 查看任务/进度
      </button>
    </div>
  </section>
  
  <!-- Recent Tasks -->
  <section>
    <h2 class="text-lg font-semibold mb-4">最近任务</h2>
    <div class="rounded-lg border border-border bg-card overflow-hidden">
      {#if tasks.length > 0}
        <table class="w-full text-sm">
          <thead class="bg-muted/50">
            <tr class="border-b border-border">
              <th class="p-3 text-left font-medium text-muted-foreground">时间</th>
              <th class="p-3 text-left font-medium text-muted-foreground">类型</th>
              <th class="p-3 text-left font-medium text-muted-foreground">名称/目录</th>
              <th class="p-3 text-left font-medium text-muted-foreground">状态</th>
              <th class="p-3 text-left font-medium text-muted-foreground">操作</th>
            </tr>
          </thead>
          <tbody>
            {#each tasks as task}
              {@const statusInfo = getStatusDisplay(task.status)}
              <tr class="border-b border-border hover:bg-accent/50">
                <td class="p-3 font-mono text-xs">{formatTime(task.createdAt)}</td>
                <td class="p-3">{getTypeDisplay(task.type)}</td>
                <td class="p-3 font-mono text-xs truncate max-w-[300px]">{task.target}</td>
                <td class="p-3">
                  <span class="inline-flex items-center gap-1 {statusInfo.class}">
                    {statusInfo.icon} {statusInfo.text}
                  </span>
                </td>
                <td class="p-3">
                  <div class="flex gap-1">
                    <button 
                      class="inline-flex items-center justify-center rounded-md text-xs font-medium h-7 px-2 border border-input bg-background hover:bg-accent"
                      on:click={() => viewTask(task.id)}
                    >
                      查看
                    </button>
                    {#if task.status === 'running' || task.status === 'pending'}
                      <button 
                        class="inline-flex items-center justify-center rounded-md text-xs font-medium h-7 px-2 bg-destructive text-destructive-foreground hover:opacity-90"
                        on:click={() => handleCancelTask(task.id)}
                      >
                        取消
                      </button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <div class="p-8 text-center text-muted-foreground">
          <p>暂无任务</p>
        </div>
      {/if}
    </div>
  </section>
</main>

<style lang="postcss">
  @reference "tailwindcss";
</style>
