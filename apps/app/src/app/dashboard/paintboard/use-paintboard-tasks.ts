import { useState, useEffect, useCallback } from 'react';
import { getUserPaintboardTasks } from '@/actions/paintboard';

export type PaintboardTask = NonNullable<Awaited<ReturnType<typeof getUserPaintboardTasks>>['data']>[number];

export function usePaintboardTasks() {
  const [tasks, setTasks] = useState<PaintboardTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          const hasChanges =
            JSON.stringify(prevTasks.map(task => ({ id: task.id, status: task.status }))) !==
            JSON.stringify(newTasks.map(task => ({ id: task.id, status: task.status })));
          if (hasChanges) {
            return newTasks;
          }
          return prevTasks;
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

  // 手动触发刷新（提交任务后调用）
  const triggerRefresh = useCallback(async () => {
    await fetchTasks();
  }, [fetchTasks]);

  // 组件挂载时获取任务列表
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    loading,
    error,
    fetchTasks,
    downloadFile,
    triggerRefresh,
  };
}
