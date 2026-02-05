/**
 * 格式化工具函数
 */

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return '?';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

/**
 * 格式化时间戳
 */
export function formatTime(dateValue: string | number | Date): string {
  const date = new Date(dateValue);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * 格式化日期
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * 格式化季数
 */
export function formatSeason(season: number): string {
  return `Season ${String(season).padStart(2, '0')}`;
}

/**
 * 格式化集数
 */
export function formatEpisode(episode: number): string {
  return `E${String(episode).padStart(2, '0')}`;
}

/**
 * 格式化季集号
 */
export function formatSeasonEpisode(season: number, episode: number): string {
  return `S${String(season).padStart(2, '0')}${formatEpisode(episode)}`;
}

/**
 * 任务状态显示
 */
export function getStatusDisplay(status: string): { icon: string; text: string; class: string } {
  switch (status) {
    case 'success': return { icon: '✅', text: '完成', class: 'text-green-500' };
    case 'completed': return { icon: '✅', text: '完成', class: 'text-green-500' };
    case 'running': return { icon: '⏳', text: '进行中', class: 'text-yellow-500' };
    case 'failed': return { icon: '❌', text: '失败', class: 'text-red-500' };
    case 'cancelled': return { icon: '🚫', text: '已取消', class: 'text-muted-foreground' };
    case 'pending': return { icon: '⏸', text: '等待', class: 'text-muted-foreground' };
    default: return { icon: '❓', text: status, class: 'text-muted-foreground' };
  }
}

/**
 * 任务类型显示
 */
export function getTypeDisplay(type: string): string {
  switch (type) {
    case 'scrape': return '刮削';
    case 'refresh': return '刷新';
    case 'process': return '处理';
    case 'supplement': return '补刮';
    case 'fix-assets': return '修复资产';
    case 'ingest': return '入库';
    case 'scan': return '扫描';
    case 'batch': return '批量';
    default: return type;
  }
}

/**
 * 刮削状态显示
 */
export function getScrapedStatus(scraped: boolean): { icon: string; text: string; class: string } {
  return scraped
    ? { icon: '✅', text: '已刮削', class: 'text-green-500' }
    : { icon: '⚠️', text: '未刮削', class: 'text-yellow-500' };
}
