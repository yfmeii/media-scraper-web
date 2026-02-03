import { describe, expect, test, beforeEach } from 'bun:test';
import { 
  createTask, 
  getTask, 
  updateTask, 
  startTask, 
  completeTask, 
  cancelTask,
  getAllTasks,
  getActiveTasks,
  getTaskStats,
  addTaskLog,
  calculateBatchProgress
} from './tasks';

describe('Task Management', () => {
  test('should create a new task', () => {
    const task = createTask('scrape', '/path/to/file.mkv');
    
    expect(task.id).toMatch(/^task_\d+_\d+$/);
    expect(task.type).toBe('scrape');
    expect(task.target).toBe('/path/to/file.mkv');
    expect(task.status).toBe('pending');
    expect(task.progress).toBe(0);
    expect(task.logs).toEqual([]);
    expect(task.createdAt).toBeGreaterThan(0);
  });

  test('should get a task by id', () => {
    const created = createTask('process', '/test/path');
    const retrieved = getTask(created.id);
    
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(created.id);
  });

  test('should update a task', () => {
    const task = createTask('scrape', '/test');
    const updated = updateTask(task.id, { progress: 50, message: 'Half done' });
    
    expect(updated?.progress).toBe(50);
    expect(updated?.message).toBe('Half done');
  });

  test('should start a task', () => {
    const task = createTask('scrape', '/test');
    const started = startTask(task.id);
    
    expect(started?.status).toBe('running');
    expect(started?.startedAt).toBeGreaterThan(0);
  });

  test('should complete a task successfully', () => {
    const task = createTask('scrape', '/test');
    startTask(task.id);
    const completed = completeTask(task.id, true, 'Done');
    
    expect(completed?.status).toBe('success');
    expect(completed?.progress).toBe(100);
    expect(completed?.message).toBe('Done');
    expect(completed?.finishedAt).toBeGreaterThan(0);
  });

  test('should complete a task with failure', () => {
    const task = createTask('scrape', '/test');
    startTask(task.id);
    updateTask(task.id, { progress: 30 });
    const completed = completeTask(task.id, false, 'Error occurred');
    
    expect(completed?.status).toBe('failed');
    expect(completed?.progress).toBe(30);
    expect(completed?.error).toBe('Error occurred');
  });

  test('should cancel a pending task', () => {
    const task = createTask('scrape', '/test');
    const cancelled = cancelTask(task.id);
    
    expect(cancelled?.status).toBe('cancelled');
    expect(cancelled?.finishedAt).toBeGreaterThan(0);
  });

  test('should not cancel a running task', () => {
    const task = createTask('scrape', '/test');
    startTask(task.id);
    const cancelled = cancelTask(task.id);
    
    expect(cancelled).toBeNull();
  });

  test('should add logs to a task', () => {
    const task = createTask('scrape', '/test');
    addTaskLog(task.id, 'Starting process');
    addTaskLog(task.id, 'Processing file');
    
    const retrieved = getTask(task.id);
    expect(retrieved?.logs.length).toBe(2);
    expect(retrieved?.logs[0]).toContain('Starting process');
    expect(retrieved?.logs[1]).toContain('Processing file');
  });

  test('should get active tasks', () => {
    createTask('scrape', '/pending');
    const running = createTask('scrape', '/running');
    startTask(running.id);
    const completed = createTask('scrape', '/completed');
    startTask(completed.id);
    completeTask(completed.id, true);
    
    const active = getActiveTasks();
    expect(active.some(t => t.status === 'pending')).toBe(true);
    expect(active.some(t => t.status === 'running')).toBe(true);
    expect(active.some(t => t.status === 'success')).toBe(false);
  });

  test('should calculate batch progress', () => {
    const progress = calculateBatchProgress(3, 1, 10);
    
    expect(progress.total).toBe(10);
    expect(progress.done).toBe(3);
    expect(progress.failed).toBe(1);
    expect(progress.percent).toBe(40);
  });

  test('should handle zero total in batch progress', () => {
    const progress = calculateBatchProgress(0, 0, 0);
    
    expect(progress.percent).toBe(0);
  });
});
