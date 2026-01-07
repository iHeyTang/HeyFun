/**
 * Browser View 组件（CDP 版本）
 * 通过 Chrome DevTools Protocol WebSocket 直接连接到浏览器
 * 实现真正的远程控制和实时显示
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

interface BrowserViewCdpProps {
  sessionId: string;
  /** 是否启用交互模式（点击、输入等） */
  interactive?: boolean;
  /** 交互回调 */
  onInteraction?: (action: string, data: any) => void;
}

/**
 * CDP 客户端（简化版）
 * 用于通过 WebSocket 连接到 Chrome DevTools Protocol
 */
class CDPClient {
  private ws: WebSocket | null = null;
  private messageId = 0;
  private pendingCallbacks = new Map<number, { resolve: (value: any) => void; reject: (error: any) => void }>();
  private pageId: string | null = null;

  constructor(private wsUrl: string) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        console.log('[CDPClient] WebSocket connected');
        // Playwright 的 WebSocket 端点已经连接到浏览器实例
        // 我们可以直接使用 Page 域的方法，不需要先获取 targets
        // 但为了确保页面已加载，我们先启用 Page 域
        this.send('Page.enable', {})
          .then(() => {
            console.log('[CDPClient] Page domain enabled');
            resolve();
          })
          .catch((error) => {
            console.warn('[CDPClient] Failed to enable Page domain, continuing anyway:', error);
            // 即使失败也继续，因为可能页面已经可用
            resolve();
          });
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.id !== undefined) {
            // 这是对之前请求的响应
            const callback = this.pendingCallbacks.get(message.id);
            if (callback) {
              this.pendingCallbacks.delete(message.id);
              if (message.error) {
                callback.reject(new Error(message.error.message || 'CDP error'));
              } else {
                callback.resolve(message.result);
              }
            }
          } else if (message.method) {
            // 这是事件通知
            console.log('[CDPClient] Event:', message.method);
          }
        } catch (error) {
          console.error('[CDPClient] Failed to parse message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[CDPClient] WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('[CDPClient] WebSocket closed');
      };
    });
  }

  private send(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const id = ++this.messageId;
      const message = {
        id,
        method,
        params,
      };

      this.pendingCallbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(message));

      // 超时处理
      setTimeout(() => {
        if (this.pendingCallbacks.has(id)) {
          this.pendingCallbacks.delete(id);
          reject(new Error('CDP request timeout'));
        }
      }, 30000);
    });
  }

  async captureScreenshot(): Promise<string> {
    // 使用 Page.captureScreenshot
    const result = await this.send('Page.captureScreenshot', {
      format: 'png',
    });
    return result.data; // base64 编码的图片
  }

  async navigate(url: string): Promise<void> {
    await this.send('Page.navigate', { url });
  }

  async click(x: number, y: number): Promise<void> {
    // 使用 Input.dispatchMouseEvent
    await this.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      clickCount: 1,
    });
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x,
      y,
      button: 'left',
      clickCount: 1,
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.pendingCallbacks.clear();
  }
}

export function BrowserViewCdp({
  sessionId,
  interactive = false,
  onInteraction,
}: BrowserViewCdpProps) {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const cdpClientRef = useRef<CDPClient | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 获取 WebSocket URL
  const getWsUrl = useCallback(async (): Promise<string> => {
    const response = await fetch(`/api/browser/ws-url?sessionId=${sessionId}`);
    const data = await response.json();
    if (!data.success || !data.data?.wsUrl) {
      throw new Error(data.error || 'Failed to get WebSocket URL');
    }
    return data.data.wsUrl;
  }, [sessionId]);

  // 连接到浏览器并开始截图流
  const connect = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 获取 WebSocket URL
      const wsUrl = await getWsUrl();
      console.log('[BrowserViewCdp] Connecting to:', wsUrl);

      // 创建 CDP 客户端
      const client = new CDPClient(wsUrl);
      await client.connect();
      cdpClientRef.current = client;

      // 开始定期截图
      const captureAndUpdate = async () => {
        if (cdpClientRef.current) {
          try {
            const screenshotBase64 = await cdpClientRef.current.captureScreenshot();
            setScreenshot(`data:image/png;base64,${screenshotBase64}`);
            setError(null);
          } catch (err) {
            console.error('[BrowserViewCdp] Failed to capture screenshot:', err);
            // 不设置错误，继续尝试
          }
        }
      };

      // 立即捕获一次
      await captureAndUpdate();
      setLoading(false);

      // 定期刷新（每秒）
      refreshIntervalRef.current = setInterval(captureAndUpdate, 1000);
    } catch (err) {
      console.error('[BrowserViewCdp] Connection error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to browser');
      setLoading(false);
    }
  }, [getWsUrl]);

  // 处理用户交互
  const handleInteraction = useCallback(
    async (action: 'click' | 'type' | 'scroll', data: any) => {
      if (!interactive || isInteracting || !cdpClientRef.current) return;

      setIsInteracting(true);
      try {
        switch (action) {
          case 'click':
            if (data.x !== undefined && data.y !== undefined) {
              await cdpClientRef.current.click(data.x, data.y);
              onInteraction?.(action, data);
            }
            break;
          // type 和 scroll 需要更多 CDP 调用，暂时跳过
          default:
            console.warn('[BrowserViewCdp] Unsupported action:', action);
        }
      } catch (err) {
        console.error('[BrowserViewCdp] Interaction error:', err);
        setError(err instanceof Error ? err.message : 'Interaction failed');
      } finally {
        setIsInteracting(false);
      }
    },
    [interactive, isInteracting, onInteraction],
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

  useEffect(() => {
    connect();

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (cdpClientRef.current) {
        cdpClientRef.current.disconnect();
      }
    };
  }, [connect]);

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
            onClick={connect}
            className="mt-2 rounded bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90"
          >
            重试连接
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative h-full w-full overflow-auto bg-gray-100"
      style={{ cursor: interactive ? 'pointer' : 'default' }}
    >
      {screenshot ? (
        <img
          ref={imageRef}
          src={screenshot}
          alt="Browser view"
          className="h-auto w-full"
          onClick={handleImageClick}
          onError={() => setError('Failed to load screenshot')}
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground text-sm">等待浏览器内容...</p>
        </div>
      )}
    </div>
  );
}

