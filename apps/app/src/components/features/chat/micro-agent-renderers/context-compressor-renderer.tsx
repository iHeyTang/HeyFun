/**
 * 上下文压缩微代理渲染组件
 */

'use client';

import { memo } from 'react';
import { Minimize2, TrendingDown } from 'lucide-react';

interface ContextCompressionResult {
  compressed?: boolean;
  originalLength?: number;
  compressedLength?: number;
  summary?: string;
  keyPoints?: string[];
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cost?: number;
  };
}

interface ContextCompressorRendererProps {
  data: ContextCompressionResult;
}

export const ContextCompressorRenderer = memo(function ContextCompressorRenderer({ data }: ContextCompressorRendererProps) {
  const compressed = data.compressed ?? false;
  const originalLength = data.originalLength ?? 0;
  const compressedLength = data.compressedLength ?? 0;
  const summary = data.summary || '';
  const keyPoints = data.keyPoints || [];
  const reduction = originalLength > 0 ? ((originalLength - compressedLength) / originalLength) * 100 : 0;

  if (!compressed) {
    return <div className="text-[10px] text-gray-500">未进行压缩</div>;
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Minimize2 className="h-3 w-3 flex-shrink-0 text-orange-500" />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-medium text-gray-700">上下文压缩</div>
          <div className="mt-0.5 text-[10px] text-gray-600">
            {originalLength} → {compressedLength} 条消息
          </div>
        </div>
        {reduction > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-green-600">
            <TrendingDown className="h-2.5 w-2.5" />
            {reduction.toFixed(0)}%
          </div>
        )}
      </div>

      {summary && (
        <div>
          <div className="mb-0.5 text-[10px] font-medium text-gray-700">压缩摘要</div>
          <div className="line-clamp-2 text-[10px] text-gray-600">{summary}</div>
        </div>
      )}

      {keyPoints.length > 0 && (
        <div>
          <div className="mb-0.5 text-[10px] font-medium text-gray-700">关键信息点 ({keyPoints.length})</div>
          <div className="max-h-12 space-y-0.5 overflow-y-auto text-[10px] text-gray-600">
            {keyPoints.slice(0, 3).map((point, idx) => (
              <div key={idx} className="truncate">
                • {point}
              </div>
            ))}
            {keyPoints.length > 3 && <div className="text-gray-400">+{keyPoints.length - 3} 更多</div>}
          </div>
        </div>
      )}
    </div>
  );
});
