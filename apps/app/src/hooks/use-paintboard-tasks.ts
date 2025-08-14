import { useState, useEffect, useCallback } from 'react';
import { getUserPaintboardTasks, pollPaintboardTaskResults } from '@/actions/paintboard';

export interface PaintboardTask {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  organizationId: string;
  service: string;
  model: string;
  generationType: string;
  status: string;
  params: any;
  taskId: string | null;
  results: any;
  error: string | null;
}

export function usePaintboardTasks() {
  const [tasks, setTasks] = useState<PaintboardTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取用户的所有画板任务
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getUserPaintboardTasks({});

      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setTasks(result.data);
      } else {
        setTasks([]);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 手动轮询任务结果
  const pollResults = useCallback(async () => {
    try {
      const result = await pollPaintboardTaskResults({});

      if (!result.error) {
        // 重新获取任务列表以更新状态
        await fetchTasks();
      }

      return result;
    } catch (err) {
      console.error('Error polling results:', err);
      throw err;
    }
  }, [fetchTasks]);

  // 下载文件 - 使用workspace下载接口
  const downloadFile = useCallback(async (filePath: string, organizationId: string, filename: string) => {
    try {
      // 使用workspace下载接口
      const downloadUrl = `/api/workspace/download/${filePath}`;

      // 创建下载链接
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading file:', err);
      throw err;
    }
  }, []);

  // 启动轮询 - 直接调用server action
  const startPolling = useCallback(async () => {
    try {
      // 直接调用轮询，无需通过API
      await pollPaintboardTaskResults({});
      console.log('Polling started successfully');
      return { success: true, message: 'Polling started successfully' };
    } catch (err) {
      console.error('Error starting polling:', err);
      throw err;
    }
  }, []);

  // 检查轮询状态 - 由于轮询是自动的，这里返回true
  const checkPollingStatus = useCallback(async () => {
    return { success: true, isRunning: true };
  }, []);

  // 组件挂载时获取任务列表
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // 设置定时器定期刷新任务列表
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTasks();
    }, 30000); // 每30秒刷新一次

    return () => clearInterval(interval);
  }, [fetchTasks]);

  return {
    tasks,
    loading,
    error,
    fetchTasks,
    pollResults,
    downloadFile,
    startPolling,
    checkPollingStatus,
  };
}
