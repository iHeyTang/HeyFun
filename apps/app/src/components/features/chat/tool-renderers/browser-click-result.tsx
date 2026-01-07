/**
 * Browser Click 工具结果展示组件
 */

'use client';

import { CheckCircle2, Loader2, MousePointerClick, XCircle } from 'lucide-react';

interface BrowserClickResultProps {
  args?: Record<string, any>;
  result?: any; // result.data 的结构: { clicked: boolean }
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
  sessionId?: string;
}

interface BrowserClickData {
  clicked?: boolean;
}

export function BrowserClickResult({ args, result, status, error, sessionId }: BrowserClickResultProps) {

  // 解析结果数据
  const data: BrowserClickData | null = result && status === 'success' ? result : null;
  const selector = args?.selector;

  // 错误状态
  if (status === 'error' || error) {
    return (
      <div className="space-y-1">
        {selector && (
          <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
            <MousePointerClick className="h-3 w-3" />
            <span>
              选择器: <span className="text-foreground/80 font-mono text-xs">{selector}</span>
            </span>
          </div>
        )}
        <div className="text-xs text-red-600 dark:text-red-400">{error || '点击失败'}</div>
      </div>
    );
  }

  // 加载中或等待状态
  if (status === 'pending' || status === 'running') {
    return (
      <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>
          正在点击元素: <span className="text-foreground/80 font-mono text-xs">{selector || '...'}</span>
        </span>
      </div>
    );
  }

  // 成功状态
  const clicked = data?.clicked ?? true;

  return (
    <div className="space-y-2">
      {/* 点击结果 */}
      <div className="flex items-center gap-1.5 text-xs">
        {selector && (
          <div className="text-muted-foreground/70 flex items-center gap-1.5">
            <MousePointerClick className="h-3 w-3" />
            <span>
              选择器: <span className="text-foreground/80 font-mono">{selector}</span>
            </span>
          </div>
        )}
        {clicked ? (
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3" />
            <span>点击成功</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
            <XCircle className="h-3 w-3" />
            <span>元素未找到或无法点击</span>
          </div>
        )}
      </div>
    </div>
  );
}

