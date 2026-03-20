/**
 * 格式化工具函数
 *
 * Common formatting utilities are re-exported from @media-scraper/shared.
 * Only web-specific helpers (task UI styles, etc.) are defined here.
 */
import { TASK_STATUS_LABELS, TASK_TYPE_LABELS } from '@media-scraper/shared/constants';
import type { TaskStatus, TaskType } from '@media-scraper/shared/types';

// Re-export shared formatting utilities so existing import paths continue to work
export {
  formatFileSize,
  formatDate,
  formatSeason,
  formatEpisode,
  formatSeasonEpisode,
  formatRating,
  formatRuntime,
  getMediaKindLabel,
  normalizeMediaKind,
} from '@media-scraper/shared/format';

const TASK_STATUS_STYLES: Record<TaskStatus, { icon: string; class: string }> = {
  success: { icon: '✅', class: 'text-green-500' },
  running: { icon: '⏳', class: 'text-yellow-500' },
  failed: { icon: '❌', class: 'text-red-500' },
  cancelled: { icon: '🚫', class: 'text-muted-foreground' },
  pending: { icon: '⏸', class: 'text-muted-foreground' },
};

const TASK_STATUS_ALIASES: Record<string, TaskStatus> = {
  completed: 'success',
};

/**
 * 格式化时间（仅时分）- Web 专用
 */
export function formatTime(dateValue: string | number | Date): string {
  const date = new Date(dateValue);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * 任务状态显示
 */
export function getStatusDisplay(status: TaskStatus | string): { icon: string; text: string; class: string } {
  const normalized = TASK_STATUS_ALIASES[status] ?? status;
  const text = (TASK_STATUS_LABELS as Record<string, string>)[normalized];
  if (text) {
    const style = TASK_STATUS_STYLES[normalized as TaskStatus];
    return { icon: style.icon, text, class: style.class };
  }
  return { icon: '❓', text: status, class: 'text-muted-foreground' };
}

/**
 * 任务类型显示
 */
export function getTypeDisplay(type: TaskType | string): string {
  return (TASK_TYPE_LABELS as Record<string, string>)[type] || type;
}

/**
 * 刮削状态显示
 */
export function getScrapedStatus(scraped: boolean): { icon: string; text: string; class: string } {
  return scraped
    ? { icon: '✅', text: '已刮削', class: 'text-green-500' }
    : { icon: '⚠️', text: '未刮削', class: 'text-yellow-500' };
}

/**
 * 状态徽章配置
 */
export type GroupStatusType = 'scraped' | 'unscraped' | 'supplement' | 'processing' | 'success' | 'failed';

export interface StatusBadge {
  label: string;
  color: string;
  border: string;
  bgColor: string;
}

/**
 * 获取分组状态徽章样式
 * 用于 TV/Movies 列表的状态显示
 */
export function getGroupStatusBadge(status: GroupStatusType | string | undefined): StatusBadge {
  switch (status) {
    case 'scraped':
    case 'success':
      return { 
        label: status === 'success' ? '成功' : '已刮削', 
        color: 'text-green-500', 
        border: 'border-green-500/50',
        bgColor: 'bg-green-500/10'
      };
    case 'unscraped':
    case 'failed':
      return { 
        label: status === 'failed' ? '失败' : '未刮削', 
        color: 'text-red-500', 
        border: 'border-red-500/50',
        bgColor: 'bg-red-500/10'
      };
    case 'supplement':
      return { 
        label: '待处理', 
        color: 'text-yellow-500', 
        border: 'border-yellow-500/50',
        bgColor: 'bg-yellow-500/10'
      };
    case 'processing':
      return { 
        label: '处理中', 
        color: 'text-primary', 
        border: 'border-primary/50',
        bgColor: 'bg-primary/10'
      };
    default:
      return { 
        label: '未知', 
        color: 'text-muted-foreground', 
        border: 'border-border',
        bgColor: 'bg-muted/40'
      };
  }
}
