/**
 * 错误恢复微代理渲染组件
 */

'use client';

import { memo } from 'react';
import { AlertTriangle, RefreshCw, SkipForward, Edit, CheckCircle2 } from 'lucide-react';

interface ErrorRecoveryResult {
  hasError?: boolean;
  errorType?: string;
  errorMessage?: string;
  recoveryAction?: 'retry' | 'skip' | 'modify' | 'none';
  modifiedContext?: any;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cost?: number;
  };
}

interface ErrorRecoveryRendererProps {
  data: ErrorRecoveryResult;
}

export const ErrorRecoveryRenderer = memo(function ErrorRecoveryRenderer({
  data,
}: ErrorRecoveryRendererProps) {
  const hasError = data.hasError ?? false;
  const errorType = data.errorType;
  const errorMessage = data.errorMessage;
  const recoveryAction = data.recoveryAction || 'none';

  if (!hasError) {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
        <CheckCircle2 className="h-2.5 w-2.5 text-green-500" />
        无错误
      </div>
    );
  }

  const actionConfig = {
    retry: { icon: RefreshCw, label: '重试', color: 'text-blue-500' },
    skip: { icon: SkipForward, label: '跳过', color: 'text-yellow-500' },
    modify: { icon: Edit, label: '修改', color: 'text-purple-500' },
    none: { icon: AlertTriangle, label: '无操作', color: 'text-gray-500' },
  };

  const config = actionConfig[recoveryAction] || actionConfig.none;
  const Icon = config.icon;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-medium text-red-700">
            {errorType || '错误'}
          </div>
          {errorMessage && (
            <div className="text-[10px] text-gray-600 mt-0.5 line-clamp-2">{errorMessage}</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Icon className={`h-2.5 w-2.5 ${config.color}`} />
        <div className="text-[10px] text-gray-600">恢复动作: {config.label}</div>
      </div>
    </div>
  );
});

