/**
 * 意图检测微代理渲染组件
 */

'use client';

import { memo } from 'react';
import { Target } from 'lucide-react';

interface DetectedIntent {
  fragmentIds?: string[];
  confidence?: number;
  reasons?: string[];
  userIntent?: {
    primaryGoal?: string;
    taskType?: string;
    complexity?: 'simple' | 'medium' | 'complex';
    context?: string;
  };
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cost?: number;
  };
}

interface IntentDetectorRendererProps {
  data: DetectedIntent;
}

export const IntentDetectorRenderer = memo(function IntentDetectorRenderer({
  data,
}: IntentDetectorRendererProps) {
  const confidence = data.confidence ?? 0;
  const fragmentIds = data.fragmentIds || [];
  const reasons = data.reasons || [];
  const userIntent = data.userIntent;

  return (
    <div className="space-y-1.5">
      {userIntent && (
        <div className="flex items-start gap-1.5">
          <Target className="h-3 w-3 mt-0.5 text-blue-500 flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-1">
            <div className="text-[10px] font-medium text-gray-700">用户意图</div>
            {userIntent.primaryGoal && (
              <div className="text-[10px] text-gray-600">
                <span className="font-medium">目标：</span>
                {userIntent.primaryGoal}
              </div>
            )}
            {userIntent.taskType && (
              <div className="text-[10px] text-gray-600">
                <span className="font-medium">类型：</span>
                {userIntent.taskType}
              </div>
            )}
            {userIntent.complexity && (
              <div className="text-[10px] text-gray-600">
                <span className="font-medium">复杂度：</span>
                {userIntent.complexity === 'simple' ? '简单' : userIntent.complexity === 'medium' ? '中等' : '复杂'}
              </div>
            )}
            {userIntent.context && (
              <div className="text-[10px] text-gray-600">
                <span className="font-medium">上下文：</span>
                {userIntent.context}
              </div>
            )}
          </div>
        </div>
      )}

      {fragmentIds.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-gray-700 mb-0.5">
            匹配片段 ({fragmentIds.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {fragmentIds.slice(0, 5).map((id, idx) => (
              <span
                key={idx}
                className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-mono"
              >
                {id.substring(0, 8)}...
              </span>
            ))}
            {fragmentIds.length > 5 && (
              <span className="px-1.5 py-0.5 text-gray-500 text-[10px]">
                +{fragmentIds.length - 5}
              </span>
            )}
          </div>
        </div>
      )}

      {confidence > 0 && (
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-medium text-gray-700">置信度</div>
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${confidence * 100}%` }}
            />
          </div>
          <div className="text-[10px] text-gray-500">{(confidence * 100).toFixed(0)}%</div>
        </div>
      )}

      {reasons.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-gray-700 mb-0.5">分析原因</div>
          <div className="text-[10px] text-gray-600 space-y-0.5">
            {reasons.map((reason, idx) => (
              <div key={idx}>• {reason}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

