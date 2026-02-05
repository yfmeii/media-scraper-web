import { describe, expect, test } from 'bun:test';
import { 
  createTask, 
  getTask, 
  updateTask, 
  startTask, 
  completeTask, 
  cancelTask,
  getActiveTasks,
  getTaskStats,
  addTaskLog,
  calculateBatchProgress,
  cleanupTasks,
} from './tasks';

describe('任务管理', () => {
  test('🆕 创建任务包含基础字段', () => {
    const task = createTask('scrape', '/path/to/file.mkv');
    expect(task.id).toMatch(/^task_\d+_\d+$/);
    expect(task.type).toBe('scrape');
    expect(task.target).toBe('/path/to/file.mkv');
    expect(task.status).toBe('pending');
    expect(task.progress).toBe(0);
    expect(task.logs).toEqual([]);
    expect(task.createdAt).toBeGreaterThan(0);
  });

  test('🔍 根据 ID 获取任务', () => {
    const created = createTask('process', '/test/path');
    const retrieved = getTask(created.id);
    expect(retrieved?.id).toBe(created.id);
  });

  test('✏️ 更新任务进度与消息', () => {
    const task = createTask('scrape', '/test');
    const updated = updateTask(task.id, { progress: 50, message: 'Half done' });
    expect(updated?.progress).toBe(50);
    expect(updated?.message).toBe('Half done');
  });

  test('▶️ 启动任务进入运行中', () => {
    const task = createTask('scrape', '/test');
    const started = startTask(task.id);
    expect(started?.status).toBe('running');
    expect(started?.startedAt).toBeGreaterThan(0);
  });

  test('✅ 成功完成任务进度为 100', () => {
    const task = createTask('scrape', '/test');
    startTask(task.id);
    const completed = completeTask(task.id, true, 'Done');
    expect(completed?.status).toBe('success');
    expect(completed?.progress).toBe(100);
    expect(completed?.message).toBe('Done');
    expect(completed?.finishedAt).toBeGreaterThan(0);
  });

  test('❌ 失败完成任务保留已有进度', () => {
    const task = createTask('scrape', '/test');
    startTask(task.id);
    updateTask(task.id, { progress: 30 });
    const completed = completeTask(task.id, false, 'Error occurred');
    expect(completed?.status).toBe('failed');
    expect(completed?.progress).toBe(30);
    expect(completed?.error).toBe('Error occurred');
  });

  test('🛑 仅允许取消待处理任务', () => {
    const task = createTask('scrape', '/test');
    const cancelled = cancelTask(task.id);
    expect(cancelled?.status).toBe('cancelled');

    const running = createTask('scrape', '/running');
    startTask(running.id);
    const cancelledRunning = cancelTask(running.id);
    expect(cancelledRunning).toBeNull();
  });

  test('🧾 任务日志追加带时间戳', () => {
    const task = createTask('scrape', '/test');
    addTaskLog(task.id, 'Starting process');
    const retrieved = getTask(task.id);
    expect(retrieved?.logs.length).toBe(1);
    expect(retrieved?.logs[0]).toMatch(/\[\d{2}:\d{2}:\d{2}\] Starting process/);
  });

  test('📌 活跃任务仅包含 pending/running', () => {
    const pending = createTask('scrape', '/pending');
    const running = createTask('scrape', '/running');
    startTask(running.id);
    const completed = createTask('scrape', '/completed');
    startTask(completed.id);
    completeTask(completed.id, true);

    const active = getActiveTasks();
    expect(active.some(t => t.id === pending.id)).toBe(true);
    expect(active.some(t => t.id === running.id)).toBe(true);
    expect(active.some(t => t.id === completed.id)).toBe(false);
  });

  test('📊 统计增量符合预期', () => {
    const before = getTaskStats();
    const pending = createTask('scrape', '/stats/pending');
    const running = createTask('scrape', '/stats/running');
    startTask(running.id);
    const after = getTaskStats();
    expect(after.pending - before.pending).toBeGreaterThanOrEqual(1);
    expect(after.running - before.running).toBeGreaterThanOrEqual(1);
    expect(getTask(pending.id)).toBeDefined();
  });

  test('🧹 清理已完成任务', () => {
    const task = createTask('scrape', '/cleanup');
    startTask(task.id);
    completeTask(task.id, true);
    cleanupTasks(0);
    expect(getTask(task.id)).toBeUndefined();
  });

  test('🧮 批量进度计算正确', () => {
    const progress = calculateBatchProgress(3, 1, 10);
    expect(progress.total).toBe(10);
    expect(progress.done).toBe(3);
    expect(progress.failed).toBe(1);
    expect(progress.percent).toBe(40);
  });

  test('🧯 总数为 0 时百分比为 0', () => {
    const progress = calculateBatchProgress(0, 0, 0);
    expect(progress.percent).toBe(0);
  });
});
