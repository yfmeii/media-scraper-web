import { Hono } from 'hono';
import { 
  getAllTasks, 
  getTaskStats, 
  cancelTask
} from '../lib/tasks';

export const taskRoutes = new Hono();

// 获取所有任务
taskRoutes.get('/', (c) => {
  const status = c.req.query('status');
  const limit = parseInt(c.req.query('limit') || '50');
  
  let tasks = getAllTasks();
  
  // 按状态过滤
  if (status) {
    tasks = tasks.filter(t => t.status === status);
  }
  
  // 限制数量
  tasks = tasks.slice(0, limit);
  
  return c.json({
    success: true,
    data: tasks,
    total: tasks.length,
    stats: getTaskStats(),
  });
});

// 获取任务统计
taskRoutes.get('/stats', (c) => {
  return c.json({
    success: true,
    data: getTaskStats(),
  });
});

// 取消任务
taskRoutes.post('/:id/cancel', (c) => {
  const id = c.req.param('id');
  const task = cancelTask(id);
  
  if (!task) {
    return c.json({ success: false, error: 'Cannot cancel task (not found or already started)' }, 400);
  }
  
  return c.json({
    success: true,
    data: task,
  });
});
