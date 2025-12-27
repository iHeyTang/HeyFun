/**
 * 上下文窗口管理微代理渲染组件
 */

'use client';

import { memo } from 'react';
import { Layers, TrendingDown, FileText } from 'lucide-react';

interface ContextWindowResult {
  originalMessageCount?: number;
  managedMessageCount?: number;
  strategy?: string;
  preservedMessages?: number;
  compressedMessages?: number;
  summary?: string;
  keyPoints?: string[];
  preservedContext?: string;
  importantDecisions?: string[];
  originalTokenCount?: number;
  compressedTokenCount?: number;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cost?: number;
  };
}

interface ContextWindowManagerRendererProps {
  data: ContextWindowResult;
}

export const ContextWindowManagerRenderer = memo(function ContextWindowManagerRenderer({
  data,
}: ContextWindowManagerRendererProps) {
  const originalCount = data.originalMessageCount ?? 0;
  const managedCount = data.managedMessageCount ?? 0;
  const strategy = data.strategy || 'unknown';
  const preserved = data.preservedMessages ?? 0;
  const compressed = data.compressedMessages ?? 0;
  const originalTokens = data.originalTokenCount ?? 0;
  const compressedTokens = data.compressedTokenCount ?? 0;
  const tokensSaved = originalTokens - compressedTokens;
  const keyPoints = data.keyPoints || [];
  const importantDecisions = data.importantDecisions || [];

  const strategyMap: Record<string, string> = {
    sliding_window: '滑动窗口',
    summary_compression: '摘要压缩',
    hybrid: '混合策略',
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Layers className="h-3 w-3 text-purple-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-medium text-gray-700">
            {strategyMap[strategy] || strategy}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] text-gray-500">消息数</div>
          <div className="text-[10px] font-medium text-gray-700">
            {originalCount} → {managedCount}
          </div>
        </div>
        {tokensSaved > 0 && (
          <div>
            <div className="text-[10px] text-gray-500">Token 节省</div>
            <div className="text-[10px] font-medium text-green-600 flex items-center gap-1">
              <TrendingDown className="h-2.5 w-2.5" />
              {tokensSaved.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {preserved > 0 && (
        <div className="text-[10px] text-gray-600">
          保留 {preserved} 条消息，压缩 {compressed} 条消息
        </div>
      )}

      {keyPoints.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-gray-700 mb-0.5 flex items-center gap-1">
            <FileText className="h-2.5 w-2.5" />
            关键信息点 ({keyPoints.length})
          </div>
          <div className="text-[10px] text-gray-600 space-y-0.5 max-h-16 overflow-y-auto">
            {keyPoints.slice(0, 3).map((point, idx) => (
              <div key={idx} className="truncate">• {point}</div>
            ))}
            {keyPoints.length > 3 && (
              <div className="text-gray-400">+{keyPoints.length - 3} 更多</div>
            )}
          </div>
        </div>
      )}

      {importantDecisions.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-gray-700 mb-0.5">重要决策</div>
          <div className="text-[10px] text-gray-600 space-y-0.5">
            {importantDecisions.slice(0, 2).map((decision, idx) => (
              <div key={idx} className="truncate">• {decision}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

