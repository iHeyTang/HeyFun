/**
 * Browser View 组件
 * 显示 sandbox 中运行的浏览器界面（通过定期截图）
 * 支持双向交互：点击、输入、滚动等
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

interface BrowserViewProps {
  sessionId: string;
  /** 刷新间隔（毫秒），默认 1000ms */
  refreshInterval?: number;
  /** 是否自动刷新 */
  autoRefresh?: boolean;
  /** 是否启用交互模式（点击、输入等） */
  interactive?: boolean;
  /** 交互回调 */
  onInteraction?: (action: string, data: any) => void;
}

export function BrowserView({
  sessionId,
  refreshInterval = 1000,
  autoRefresh = true,
  interactive = false,
  onInteraction,
}: BrowserViewProps) {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fetchControllerRef = useRef<AbortController | null>(null);

  const fetchScreenshot = useCallback(async () => {
    // 取消之前的请求
    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort();
    }

    try {
      setLoading(true);
      // 创建 AbortController 用于超时控制
      const controller = new AbortController();
      fetchControllerRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 秒超时

      const response = await fetch(`/api/browser/view?sessionId=${sessionId}`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      fetchControllerRef.current = null;

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data?.screenshot) {
        const screenshot = data.data.screenshot;
        // 判断是 URL 还是 base64
        if (screenshot.startsWith('/api/oss/') || screenshot.startsWith('http://') || screenshot.startsWith('https://')) {
          setScreenshot(screenshot);
        } else {
          setScreenshot(`data:image/${data.data.format || 'png'};base64,${screenshot}`);
        }
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch browser screenshot');
      }
      setLoading(false);
    } catch (err) {
      fetchControllerRef.current = null;
      if (err instanceof Error && err.name === 'AbortError') {
        setError('请求超时，请检查浏览器是否正常运行');
      } else {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
      setLoading(false);
    }
  }, [sessionId]);

  // 处理用户交互
  const handleInteraction = useCallback(
    async (action: 'click' | 'type' | 'scroll', data: any) => {
      if (!interactive || isInteracting) return;

      setIsInteracting(true);
      try {
        const response = await fetch('/api/browser/interact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            action,
            ...data,
          }),
        });

        const result = await response.json();
        if (result.success) {
          // 交互成功后立即刷新截图
          await fetchScreenshot();
          onInteraction?.(action, data);
        } else {
          setError(result.error || 'Interaction failed');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Interaction error');
      } finally {
        setIsInteracting(false);
      }
    },
    [sessionId, interactive, isInteracting, onInteraction],
  );

  // 处理图片点击
  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      if (!interactive || !imageRef.current) return;

      const rect = imageRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // 计算实际图片坐标（考虑图片缩放）
      const img = imageRef.current;
      const scaleX = img.naturalWidth / rect.width;
      const scaleY = img.naturalHeight / rect.height;
      const actualX = Math.round(x * scaleX);
      const actualY = Math.round(y * scaleY);

      handleInteraction('click', { x: actualX, y: actualY });
    },
    [interactive, handleInteraction],
  );

  // 处理滚动
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!interactive) return;

      e.preventDefault();
      handleInteraction('scroll', {
        deltaX: e.deltaX,
        deltaY: e.deltaY,
      });
    },
    [interactive, handleInteraction],
  );

  useEffect(() => {
    // 清除之前的定时器和请求
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort();
      fetchControllerRef.current = null;
    }

    // 立即获取一次
    fetchScreenshot();

    // 如果启用自动刷新，设置定时器
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        fetchScreenshot();
      }, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (fetchControllerRef.current) {
        fetchControllerRef.current.abort();
        fetchControllerRef.current = null;
      }
    };
  }, [sessionId, refreshInterval, autoRefresh, fetchScreenshot]);

  // 当错误状态改变时，停止或恢复轮询
  useEffect(() => {
    if (error && intervalRef.current) {
      // 有错误时停止轮询
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    } else if (!error && autoRefresh && !intervalRef.current) {
      // 错误恢复时重新开始轮询
      intervalRef.current = setInterval(() => {
        fetchScreenshot();
      }, refreshInterval);
    }
  }, [error, autoRefresh, refreshInterval, fetchScreenshot]);

  if (loading && !screenshot) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-destructive text-sm">{error}</p>
          <button
            onClick={fetchScreenshot}
            className="mt-2 rounded bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative h-full w-full overflow-auto bg-gray-100"
      onWheel={handleWheel}
      style={{ cursor: interactive ? 'pointer' : 'default' }}
    >
      {screenshot ? (
        <img
          ref={imageRef}
          src={screenshot}
          alt="Browser view"
          className="h-auto w-full select-none"
          style={{ imageRendering: 'auto', pointerEvents: interactive ? 'auto' : 'none' }}
          onClick={handleImageClick}
          draggable={false}
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground text-sm">等待浏览器启动...</p>
        </div>
      )}
      {(loading || isInteracting) && (
        <div className="absolute right-2 top-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {interactive && (
        <div className="absolute left-2 top-2 rounded bg-black/50 px-2 py-1 text-xs text-white">
          交互模式：点击图片进行操作
        </div>
      )}
    </div>
  );
}

