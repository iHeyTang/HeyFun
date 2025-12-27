/**
 * 上下文检索微代理渲染组件
 */

'use client';

import { memo } from 'react';
import { Search, FileText } from 'lucide-react';

interface ContextRetrievalResult {
  retrieved?: boolean;
  snapshotCount?: number;
  integratedMessages?: number;
  keyPoints?: string[];
  preservedContext?: string;
}

interface ContextRetrievalRendererProps {
  data: ContextRetrievalResult;
}

export const ContextRetrievalRenderer = memo(function ContextRetrievalRenderer({
  data,
}: ContextRetrievalRendererProps) {
  const retrieved = data.retrieved ?? false;
  const snapshotCount = data.snapshotCount ?? 0;
  const integratedMessages = data.integratedMessages ?? 0;
  const keyPoints = data.keyPoints || [];
  const preservedContext = data.preservedContext;

  if (!retrieved) {
    return (
      <div className="text-[10px] text-gray-500">未检索到相关上下文</div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Search className="h-3 w-3 text-teal-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-medium text-gray-700">上下文检索</div>
          <div className="text-[10px] text-gray-600 mt-0.5">
            检索到 {snapshotCount} 个快照，整合 {integratedMessages} 条消息
          </div>
        </div>
      </div>

      {keyPoints.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-gray-700 mb-0.5 flex items-center gap-1">
            <FileText className="h-2.5 w-2.5" />
            检索到的关键信息 ({keyPoints.length})
          </div>
          <div className="text-[10px] text-gray-600 space-y-0.5 max-h-12 overflow-y-auto">
            {keyPoints.slice(0, 3).map((point, idx) => (
              <div key={idx} className="truncate">• {point}</div>
            ))}
            {keyPoints.length > 3 && (
              <div className="text-gray-400">+{keyPoints.length - 3} 更多</div>
            )}
          </div>
        </div>
      )}

      {preservedContext && (
        <div>
          <div className="text-[10px] font-medium text-gray-700 mb-0.5">保留的上下文</div>
          <div className="text-[10px] text-gray-600 line-clamp-2">{preservedContext}</div>
        </div>
      )}
    </div>
  );
});

