// 任务中心管理模块

export type TaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
export type TaskType = 'scrape' | 'process' | 'refresh' | 'supplement' | 'fix-assets';

export interface TaskItem {
  id: string;
  type: TaskType;
  target: string;
  status: TaskStatus;
  progress: number; // 0-100
  message?: string;
  eta?: number; // 预计剩余秒数
  logs: string[];
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
}

export interface ScrapeStatus {
  total: number;
  done: number;
  failed: number;
  percent: number;
}

export interface ScrapePlan {
  actions: ScrapePlanAction[];
  impactSummary: {
    filesMoving: number;
    nfoCreating: number;
    nfoOverwriting: number;
    postersDownloading: number;
    directoriesCreating: string[];
  };
}

export interface ScrapePlanAction {
  type: 'move' | 'create-nfo' | 'download-poster' | 'create-dir';
  source?: string;
  destination: string;
  willOverwrite: boolean;
}

// 内存任务存储（可扩展为持久化）
const tasks: Map<string, TaskItem> = new Map();
let taskIdCounter = 0;

// 生成唯一任务 ID
export function generateTaskId(): string {
  return `task_${Date.now()}_${++taskIdCounter}`;
}

// 创建任务
export function createTask(type: TaskType, target: string): TaskItem {
  const task: TaskItem = {
    id: generateTaskId(),
    type,
    target,
    status: 'pending',
    progress: 0,
    logs: [],
    createdAt: Date.now(),
  };
  tasks.set(task.id, task);
  return task;
}

// 更新任务状态
export function updateTask(id: string, updates: Partial<TaskItem>): TaskItem | null {
  const task = tasks.get(id);
  if (!task) return null;
  
  Object.assign(task, updates);
  return task;
}

// 添加任务日志
export function addTaskLog(id: string, message: string): void {
  const task = tasks.get(id);
  if (task) {
    task.logs.push(`[${new Date().toISOString().slice(11, 19)}] ${message}`);
  }
}

// 开始任务
export function startTask(id: string): TaskItem | null {
  return updateTask(id, {
    status: 'running',
    startedAt: Date.now(),
  });
}

// 完成任务
export function completeTask(id: string, success: boolean, message?: string): TaskItem | null {
  const task = tasks.get(id);
  return updateTask(id, {
    status: success ? 'success' : 'failed',
    progress: success ? 100 : (task?.progress || 0),
    finishedAt: Date.now(),
    message,
    error: success ? undefined : message,
  });
}

// 获取任务
export function getTask(id: string): TaskItem | undefined {
  return tasks.get(id);
}

// 获取所有任务
export function getAllTasks(): TaskItem[] {
  return Array.from(tasks.values()).sort((a, b) => b.createdAt - a.createdAt);
}

// 获取活跃任务
export function getActiveTasks(): TaskItem[] {
  return getAllTasks().filter(t => t.status === 'pending' || t.status === 'running');
}

// 获取任务统计
export function getTaskStats(): { pending: number; running: number; success: number; failed: number; total: number } {
  const all = getAllTasks();
  return {
    pending: all.filter(t => t.status === 'pending').length,
    running: all.filter(t => t.status === 'running').length,
    success: all.filter(t => t.status === 'success').length,
    failed: all.filter(t => t.status === 'failed').length,
    total: all.length,
  };
}

// 清理已完成任务（保留最近 N 条）
export function cleanupTasks(keepRecent = 50): void {
  const sorted = getAllTasks();
  const completed = sorted.filter(t => t.status === 'success' || t.status === 'failed' || t.status === 'cancelled');
  
  if (completed.length > keepRecent) {
    const toRemove = completed.slice(keepRecent);
    for (const task of toRemove) {
      tasks.delete(task.id);
    }
  }
}

// 取消任务
export function cancelTask(id: string): TaskItem | null {
  const task = tasks.get(id);
  if (!task || task.status !== 'pending') return null;
  
  return updateTask(id, {
    status: 'cancelled',
    finishedAt: Date.now(),
    message: 'Task cancelled by user',
  });
}

// 计算批量任务进度
export function calculateBatchProgress(completed: number, failed: number, total: number): ScrapeStatus {
  return {
    total,
    done: completed,
    failed,
    percent: total > 0 ? Math.round(((completed + failed) / total) * 100) : 0,
  };
}
