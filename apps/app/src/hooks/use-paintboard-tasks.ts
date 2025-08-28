import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [isPolling, setIsPolling] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const refreshCallbacks = useRef<Set<() => void>>(new Set());

  // 获取用户的所有画板任务
  const fetchTasks = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      const result = await getUserPaintboardTasks({});

      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        const newTasks = result.data;
        setTasks(prevTasks => {
          // 检查是否有任务状态变化
          const hasChanges = JSON.stringify(prevTasks) !== JSON.stringify(newTasks);
          if (hasChanges) {
            // 触发所有注册的刷新回调
            refreshCallbacks.current.forEach(callback => callback());
          }
          return newTasks;
        });
      } else {
        setTasks([]);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      if (!silent) {
        setLoading(false);
      }
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
  const downloadFile = useCallback(async (filePath: string, _organizationId: string, filename: string) => {
    try {
      // 使用workspace下载接口
      const searchParams = new URLSearchParams();
      searchParams.set('path', filePath);
      const downloadUrl = `/api/workspace/download?${searchParams.toString()}`;

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

  // 开始实时轮询
  const startRealTimePolling = useCallback(() => {
    if (isPolling) return;

    setIsPolling(true);
    pollingIntervalRef.current = setInterval(async () => {
      try {
        await fetchTasks(true); // 静默刷新
      } catch (err) {
        console.error('Error in real-time polling:', err);
      }
    }, 5000); // 每5秒轮询一次
  }, [fetchTasks, isPolling]);

  // 停止实时轮询
  const stopRealTimePolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // 订阅刷新事件
  const subscribeToRefresh = useCallback((callback: () => void) => {
    refreshCallbacks.current.add(callback);
    return () => {
      refreshCallbacks.current.delete(callback);
    };
  }, []);

  // 手动触发刷新（提交任务后调用）
  const triggerRefresh = useCallback(async () => {
    await fetchTasks();
  }, [fetchTasks]);

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
      fetchTasks(true); // 静默刷新
    }, 30000); // 每30秒刷新一次

    return () => clearInterval(interval);
  }, [fetchTasks]);

  // 组件卸载时清理轮询
  useEffect(() => {
    return () => {
      stopRealTimePolling();
    };
  }, [stopRealTimePolling]);

  return {
    tasks,
    loading,
    error,
    isPolling,
    fetchTasks,
    pollResults,
    downloadFile,
    startPolling,
    checkPollingStatus,
    startRealTimePolling,
    stopRealTimePolling,
    subscribeToRefresh,
    triggerRefresh,
  };
}
