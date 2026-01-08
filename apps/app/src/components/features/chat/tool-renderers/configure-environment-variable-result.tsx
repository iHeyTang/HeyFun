/**
 * Configure Environment Variable 工具结果展示组件
 * 仅显示状态信息，表单在对话结尾渲染
 */

'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { useMemo } from 'react';

interface ConfigureEnvironmentVariableResultProps {
  args?: Record<string, any>;
  result?: any;
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
  messageId?: string;
  toolCallId?: string;
  sessionId?: string;
}

interface VariableInfo {
  variableName: string;
  exists: boolean;
  description: string;
}

interface ConfigureEnvironmentVariableData {
  variables?: VariableInfo[];
  allConfigured?: boolean;
  configureUrl?: string;
  message?: string;
}

export function ConfigureEnvironmentVariableResult({ args, result, status, error }: ConfigureEnvironmentVariableResultProps) {
  // 解析结果数据
  const data: ConfigureEnvironmentVariableData | null = result && status === 'success' ? result : null;
  const variables = useMemo(() => data?.variables || [], [data?.variables]);
  const allConfigured = data?.allConfigured || false;

  // 获取未配置的变量
  const unconfiguredVariables = useMemo(() => variables.filter(v => !v.exists), [variables]);

  // 错误状态
  if (status === 'error' || error) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>配置环境变量失败</AlertTitle>
        <AlertDescription>{error || '未知错误'}</AlertDescription>
      </Alert>
    );
  }

  // 加载中状态
  if (status === 'pending' || status === 'running') {
    const variableNames = variables.map(v => v.variableName).join(', ') || '环境变量';
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>检查环境变量中...</AlertTitle>
        <AlertDescription>正在检查环境变量：{variableNames}</AlertDescription>
      </Alert>
    );
  }

  // 成功状态
  if (data && variables.length > 0) {
    return (
      <Alert variant="default">
        <AlertDescription>
          <div className="space-y-1">
            {variables.map(v => (
              <div key={v.variableName} className="flex items-baseline gap-2">
                <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{v.variableName}</code>
                {v.description && <span className="text-xs opacity-70">{v.description}</span>}
              </div>
            ))}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
