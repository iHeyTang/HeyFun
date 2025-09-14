import { useState, useEffect, useCallback, useRef } from 'react';
import { getUserPaintboardTasks, getPaintboardTasksStatus } from '@/actions/paintboard';
import { PaintboardTasks } from '@prisma/client';

export type PaintboardTask = PaintboardTasks;

// 定义 getUserPaintboardTasks 的返回类型
type PaintboardTasksResponse = {
  data: PaintboardTasks[];
  hasMore: boolean;
  nextCursor: string | null;
  error?: string | null;
};

export function usePaintboardTasks() {
  const [tasks, setTasks] = useState<PaintboardTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // 轮询相关状态
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  // 获取用户的所有画板任务
  const fetchTasks = useCallback(async (silent = false, reset = true) => {
    try {
      if (!silent) {
        if (reset) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }
      }
      setError(null);

      const result = await getUserPaintboardTasks({ limit: 20 });

      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        const responseData = result.data as PaintboardTasksResponse;
        const newTasks = responseData.data;
        setTasks(prevTasks => {
          if (reset) {
            // 重置时直接替换
            return newTasks;
          } else {
            // 追加时检查是否有重复
            const existingIds = new Set(prevTasks.map(task => task.id));
            const uniqueNewTasks = newTasks.filter(task => !existingIds.has(task.id));
            return [...prevTasks, ...uniqueNewTasks];
          }
        });
        setHasMore(responseData.hasMore || false);
        setNextCursor(responseData.nextCursor || null);
      } else {
        if (reset) {
          setTasks([]);
        }
        setHasMore(false);
        setNextCursor(null);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      if (!silent) {
        if (reset) {
          setLoading(false);
        } else {
          setLoadingMore(false);
        }
      }
    }
  }, []);

  // 加载更多任务
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !nextCursor) {
      return;
    }

    try {
      setLoadingMore(true);
      setError(null);

      const result = await getUserPaintboardTasks({ limit: 20, cursor: nextCursor });

      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        const responseData = result.data as PaintboardTasksResponse;
        const newTasks = responseData.data;
        setTasks(prevTasks => {
          const existingIds = new Set(prevTasks.map(task => task.id));
          const uniqueNewTasks = newTasks.filter(task => !existingIds.has(task.id));
          return [...prevTasks, ...uniqueNewTasks];
        });
        setHasMore(responseData.hasMore || false);
        setNextCursor(responseData.nextCursor || null);
      } else {
        setHasMore(false);
        setNextCursor(null);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, nextCursor]);

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

  // 添加新任务到列表顶部
  const addNewTask = useCallback((newTask: PaintboardTask) => {
    setTasks(prevTasks => {
      // 检查是否已存在，避免重复添加
      const existingIds = new Set(prevTasks.map(task => task.id));
      if (existingIds.has(newTask.id)) {
        return prevTasks;
      }
      // 将新任务添加到列表顶部
      return [newTask, ...prevTasks];
    });
  }, []);

  // 更新现有任务的状态（当任务状态改变时）
  const updateTask = useCallback((taskId: string, updates: Partial<PaintboardTask>) => {
    setTasks(prevTasks => prevTasks.map(task => (task.id === taskId ? { ...task, ...updates } : task)));
  }, []);

  // 获取最新的任务（用于追加新任务）
  const fetchLatestTasks = useCallback(async (limit = 5) => {
    try {
      const result = await getUserPaintboardTasks({ limit });
      if (result.error) {
        console.error('Error fetching latest tasks:', result.error);
        return [];
      } else if (result.data) {
        const responseData = result.data as PaintboardTasksResponse;
        return responseData.data;
      }
      return [];
    } catch (err) {
      console.error('Error fetching latest tasks:', err);
      return [];
    }
  }, []);

  // 批量获取任务状态（用于轮询）
  const fetchTasksStatus = useCallback(async (taskIds: string[]): Promise<PaintboardTask[]> => {
    try {
      if (taskIds.length === 0) return [];

      const result = await getPaintboardTasksStatus({ taskIds });
      if (result.error) {
        console.error('Error fetching tasks status:', result.error);
        return [];
      }
      return result.data || [];
    } catch (err) {
      console.error('Error fetching tasks status:', err);
      return [];
    }
  }, []);

  // 手动触发刷新（提交任务后调用）- 现在会追加新任务而不是重新加载
  const triggerRefresh = useCallback(async () => {
    // 获取最新的几个任务
    const latestTasks = await fetchLatestTasks(10);
    if (latestTasks.length > 0) {
      // 将新任务添加到现有列表顶部
      setTasks(prevTasks => {
        const existingIds = new Set(prevTasks.map(task => task.id));
        const newTasks = latestTasks.filter(task => !existingIds.has(task.id));

        if (newTasks.length === 0) {
          return prevTasks; // 没有新任务，返回原列表
        }

        // 按创建时间排序，确保新任务在顶部
        const sortedNewTasks = newTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return [...sortedNewTasks, ...prevTasks];
      });
    }
  }, [fetchLatestTasks]);

  // 检查任务是否需要轮询（1小时内创建且状态为进行中）
  const shouldPollTask = useCallback((task: PaintboardTask): boolean => {
    const now = new Date();
    const taskCreatedAt = new Date(task.createdAt);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const isWithinOneHour = taskCreatedAt > oneHourAgo;
    const isInProgress = task.status === 'pending' || task.status === 'processing';

    return isWithinOneHour && isInProgress;
  }, []);

  // 轮询进行中的任务
  const pollInProgressTasks = useCallback(async () => {
    if (isPollingRef.current) return;

    isPollingRef.current = true;

    try {
      const currentTasks = tasks;
      const tasksToPoll = currentTasks.filter(shouldPollTask);

      if (tasksToPoll.length === 0) {
        return;
      }

      // 批量获取所有需要轮询的任务状态
      const taskIds = tasksToPoll.map(task => task.id);
      const statusResults = await fetchTasksStatus(taskIds);

      // 更新有状态变化的任务
      setTasks(prevTasks => {
        let hasChanges = false;
        const updatedTasks = prevTasks.map(task => {
          const updatedTask = statusResults.find(result => result.id === task.id);
          if (
            updatedTask &&
            (updatedTask.status !== task.status ||
              JSON.stringify(updatedTask.results) !== JSON.stringify(task.results) ||
              updatedTask.error !== task.error)
          ) {
            hasChanges = true;
            return updatedTask;
          }
          return task;
        });

        return hasChanges ? updatedTasks : prevTasks;
      });
    } catch (err) {
      console.error('Error polling tasks:', err);
    } finally {
      isPollingRef.current = false;
    }
  }, [tasks, shouldPollTask, fetchTasksStatus]);

  // 启动轮询
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // 立即执行一次轮询
    pollInProgressTasks();

    // 每5秒轮询一次
    pollingIntervalRef.current = setInterval(pollInProgressTasks, 7000);
  }, [pollInProgressTasks]);

  // 停止轮询
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // 组件挂载时获取任务列表
  useEffect(() => {
    fetchTasks(false, true);
  }, [fetchTasks]);

  // 当任务列表变化时，检查是否需要启动或停止轮询
  useEffect(() => {
    const hasInProgressTasks = tasks.some(shouldPollTask);

    if (hasInProgressTasks) {
      startPolling();
    } else {
      stopPolling();
    }

    // 清理函数
    return () => {
      stopPolling();
    };
  }, [tasks, shouldPollTask, startPolling, stopPolling]);

  return {
    tasks,
    loading,
    loadingMore,
    error,
    hasMore,
    fetchTasks,
    loadMore,
    downloadFile,
    triggerRefresh,
    addNewTask,
    updateTask,
    fetchLatestTasks,
    startPolling,
    stopPolling,
    pollInProgressTasks,
  };
}
