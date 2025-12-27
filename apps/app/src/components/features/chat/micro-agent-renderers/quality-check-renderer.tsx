/**
 * 质量检测微代理渲染组件
 */

'use client';

import { memo } from 'react';
import { CheckCircle2, AlertCircle, XCircle, Star } from 'lucide-react';

interface QualityCheckResult {
  quality?: 'excellent' | 'good' | 'fair' | 'poor';
  score?: number;
  issues?: string[];
  suggestions?: string[];
  improvedAnswer?: string;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cost?: number;
  };
}

interface QualityCheckRendererProps {
  data: QualityCheckResult;
}

export const QualityCheckRenderer = memo(function QualityCheckRenderer({
  data,
}: QualityCheckRendererProps) {
  const quality = data.quality || 'fair';
  const score = data.score ?? 0;
  const issues = data.issues || [];
  const suggestions = data.suggestions || [];
  const hasImproved = !!data.improvedAnswer;

  const qualityConfig = {
    excellent: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50', label: '优秀' },
    good: { icon: CheckCircle2, color: 'text-blue-500', bg: 'bg-blue-50', label: '良好' },
    fair: { icon: AlertCircle, color: 'text-yellow-500', bg: 'bg-yellow-50', label: '一般' },
    poor: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', label: '较差' },
  };

  const config = qualityConfig[quality] || qualityConfig.fair;
  const Icon = config.icon;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className={`p-1 rounded ${config.bg}`}>
          <Icon className={`h-3 w-3 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-medium text-gray-700">{config.label}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Star className="h-2.5 w-2.5 text-yellow-500" />
            <div className="text-[10px] text-gray-600">{score} 分</div>
          </div>
        </div>
      </div>

      {hasImproved && (
        <div className="px-1.5 py-1 bg-blue-50 border border-blue-200 rounded text-[10px] text-blue-700">
          ✓ 已优化答案
        </div>
      )}

      {issues.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-gray-700 mb-0.5">发现问题 ({issues.length})</div>
          <div className="text-[10px] text-gray-600 space-y-0.5 max-h-12 overflow-y-auto">
            {issues.slice(0, 2).map((issue, idx) => (
              <div key={idx} className="truncate">• {issue}</div>
            ))}
            {issues.length > 2 && (
              <div className="text-gray-400">+{issues.length - 2} 更多</div>
            )}
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-gray-700 mb-0.5">改进建议</div>
          <div className="text-[10px] text-gray-600 space-y-0.5">
            {suggestions.slice(0, 2).map((suggestion, idx) => (
              <div key={idx} className="truncate">• {suggestion}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

