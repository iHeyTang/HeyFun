/**
 * 微代理执行详情组件
 * 用于展示微代理的执行状态和详情
 */

'use client';

import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, XCircle, SkipForward, Loader2, Bot } from 'lucide-react';
import { memo, useState } from 'react';
import type { MicroAgentExecutionDetail } from '@/agents/core/frameworks/react';
import {
  IntentDetectorRenderer,
  ContextWindowManagerRenderer,
  QualityCheckRenderer,
  ContextCompressorRenderer,
  ContextPersistenceRenderer,
  ContextRetrievalRenderer,
  ErrorRecoveryRenderer,
  FragmentRetrieverRenderer,
  DefaultMicroAgentRenderer,
} from './micro-agent-renderers';

interface MicroAgentExecutionProps {
  detail: MicroAgentExecutionDetail;
  className?: string;
}

/**
 * 微代理执行详情组件 - 紧凑且默认折叠
 */
export const MicroAgentExecution = memo(function MicroAgentExecution({ detail, className }: MicroAgentExecutionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusIcon = () => {
    switch (detail.status) {
      case 'executing':
        return <Loader2 className="text-muted-foreground/60 h-3 w-3 animate-spin" />;
      case 'success':
        return <CheckCircle2 className="h-3 w-3 text-green-600/60 dark:text-green-500/60" />;
      case 'failed':
        return <XCircle className="h-3 w-3 text-red-600/60 dark:text-red-500/60" />;
      case 'skipped':
        return <SkipForward className="h-3 w-3 text-gray-400" />;
      default:
        return <Clock className="h-3 w-3 text-gray-400" />;
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTokenUsage = (tokenUsage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number; cost?: number }) => {
    if (!tokenUsage) return '';
    const parts: string[] = [];
    if (tokenUsage.promptTokens) parts.push(`输入: ${tokenUsage.promptTokens}`);
    if (tokenUsage.completionTokens) parts.push(`输出: ${tokenUsage.completionTokens}`);
    if (tokenUsage.totalTokens) parts.push(`总计: ${tokenUsage.totalTokens}`);
    return parts.length > 0 ? parts.join(', ') : '';
  };

  // 根据 agentId 选择对应的渲染组件
  const renderData = () => {
    if (!detail.result?.data) return null;

    const agentId = detail.agentId || '';
    const data = detail.result.data;

    switch (agentId) {
      case 'intent-detector':
        return <IntentDetectorRenderer data={data} />;
      case 'context-window-manager':
        return <ContextWindowManagerRenderer data={data} />;
      case 'quality-check':
        return <QualityCheckRenderer data={data} />;
      case 'context-compressor':
        return <ContextCompressorRenderer data={data} />;
      case 'context-persistence':
        return <ContextPersistenceRenderer data={data} />;
      case 'context-retrieval':
        return <ContextRetrievalRenderer data={data} />;
      case 'error-recovery':
        return <ErrorRecoveryRenderer data={data} />;
      case 'fragment-retriever':
        return <FragmentRetrieverRenderer data={data} />;
      default:
        return <DefaultMicroAgentRenderer data={data} />;
    }
  };

  return (
    <div
      className={cn(
        'border-border/20 bg-muted/30 hover:border-border/40 hover:bg-muted/50 group w-full min-w-0 rounded-md border transition-all',
        className,
      )}
    >
      <div className="group flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs" onClick={() => setIsExpanded(!isExpanded)}>
        <Bot className="text-muted-foreground h-3 w-3 opacity-60" />
        <span className="text-muted-foreground flex-1 truncate opacity-80">{detail.agentName}</span>

        {/* 状态图标 */}
        {getStatusIcon()}
      </div>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="border-border/20 border-t">
          {/* 基本信息 */}
          {(detail.message || detail.duration || detail.result?.tokenUsage) && (
            <div className="min-w-0 overflow-hidden px-2.5 pb-2 pt-1.5">
              {detail.message && (
                <>
                  <div className="text-muted-foreground mb-1 text-[9px] font-medium uppercase opacity-50">Message</div>
                  <div className="text-muted-foreground text-[10px] leading-relaxed">{detail.message}</div>
                </>
              )}
              {(detail.duration || detail.result?.tokenUsage) && (
                <>
                  <div className="text-muted-foreground mb-1 mt-2 text-[9px] font-medium uppercase opacity-50">Details</div>
                  <div className="text-muted-foreground space-y-0.5 text-[10px] leading-relaxed">
                    {detail.duration && <div>执行时长: {formatDuration(detail.duration)}</div>}
                    {detail.result?.tokenUsage && <div>Token: {formatTokenUsage(detail.result.tokenUsage)}</div>}
                  </div>
                </>
              )}
            </div>
          )}

          {/* 错误信息 */}
          {detail.result?.error && (
            <>
              {detail.message && <div className="border-border/20 border-t" />}
              <div className="min-w-0 overflow-hidden px-2.5 pb-2 pt-1.5">
                <div className="text-muted-foreground mb-1 text-[9px] font-medium uppercase opacity-50">Error</div>
                <div className="text-[10px] leading-relaxed text-red-600/80">{detail.result.error}</div>
              </div>
            </>
          )}

          {/* 执行结果 */}
          {detail.result?.data && (
            <>
              {(detail.message || detail.duration || detail.result?.tokenUsage || detail.result?.error) && (
                <div className="border-border/20 border-t" />
              )}
              <div className="min-w-0 overflow-hidden px-2.5 pb-2 pt-1.5">
                <div className="text-muted-foreground mb-1 text-[9px] font-medium uppercase opacity-50">Result</div>
                {renderData()}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
});
