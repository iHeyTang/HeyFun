/**
 * Build System Prompt 工具完整展示组件（包含参数和结果）
 */

'use client';

import { FileText, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { useState } from 'react';

interface BuildSystemPromptResultProps {
  args?: Record<string, any>;
  result?: any; // result.data 的结构: { fragmentIds, fragments, dynamicSystemPrompt, confidence, reasons, shouldUpdateSystemPrompt }
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
}

interface Fragment {
  id: string;
  name: string;
  description: string;
}

interface BuildSystemPromptData {
  fragmentIds?: string[];
  fragments?: Fragment[];
  dynamicSystemPrompt?: string;
  confidence?: number;
  reasons?: string[];
  shouldUpdateSystemPrompt?: boolean;
}

export function BuildSystemPromptResult({ args, result, status, error }: BuildSystemPromptResultProps) {
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);

  // 解析结果数据
  const data: BuildSystemPromptData | null = result && status === 'success' ? result : null;

  // 从参数中获取用户消息和意图
  const userMessage = args?.userMessage;
  const intent = args?.intent;

  // 错误状态
  if (status === 'error' || error) {
    return (
      <div className="space-y-1">
        {userMessage && (
          <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
            <FileText className="h-3 w-3" />
            <span>
              用户查询: <span className="text-foreground/80 font-medium">{userMessage}</span>
            </span>
          </div>
        )}
        <div className="text-xs text-red-600 dark:text-red-400">{error || '构建系统提示词失败'}</div>
      </div>
    );
  }

  // 加载中或等待状态
  if (status === 'pending' || status === 'running') {
    return (
      <div className="space-y-1">
        {userMessage && (
          <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
            <FileText className="h-3 w-3 animate-pulse" />
            <span>
              正在构建系统提示词: <span className="text-foreground/80 font-medium">{userMessage}</span>
            </span>
          </div>
        )}
        <div className="text-muted-foreground/70 text-xs">检索相关提示词片段中...</div>
      </div>
    );
  }

  // 成功状态但没有找到片段
  if (!data || !data.fragments || data.fragments.length === 0) {
    return (
      <div className="space-y-1">
        {userMessage && (
          <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
            <FileText className="h-3 w-3" />
            <span>
              用户查询: <span className="text-foreground/80 font-medium">{userMessage}</span>
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-xs">
          <AlertCircle className="text-muted-foreground/50 h-3 w-3" />
          <span className="text-muted-foreground/70">未找到相关提示词片段</span>
        </div>
        {data?.reasons && data.reasons.length > 0 && <div className="text-muted-foreground/50 pl-4 text-xs">{data.reasons[0]}</div>}
      </div>
    );
  }

  // 成功状态，有结果
  const confidencePercentage = data.confidence ? Math.round(data.confidence * 100) : 0;
  const confidenceColor =
    confidencePercentage >= 80
      ? 'text-green-600 dark:text-green-400'
      : confidencePercentage >= 60
        ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-orange-600 dark:text-orange-400';

  return (
    <div className="space-y-2">
      {/* 用户查询和意图 */}
      {(userMessage || intent) && (
        <div className="space-y-1">
          {userMessage && (
            <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
              <FileText className="h-3 w-3" />
              <span>
                用户查询: <span className="text-foreground/80 font-medium">{userMessage}</span>
              </span>
            </div>
          )}
          {intent && (
            <div className="text-muted-foreground/50 pl-4 text-xs">
              {intent.primaryGoal && <span>目标: {intent.primaryGoal}</span>}
              {intent.taskType && <span className="ml-2">类型: {intent.taskType}</span>}
              {intent.complexity && <span className="ml-2">复杂度: {intent.complexity}</span>}
            </div>
          )}
        </div>
      )}

      {/* 片段信息 */}
      {data.fragments && data.fragments.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
            <Sparkles className="h-3 w-3" />
            <span>
              检索到 <span className="text-foreground/80 font-medium">{data.fragments.length}</span> 个相关片段
            </span>
            {data.confidence !== undefined && <span className={`ml-1 font-medium ${confidenceColor}`}>(置信度: {confidencePercentage}%)</span>}
          </div>

          <div className="space-y-1">
            {data.fragments.map((fragment, index) => (
              <div key={fragment.id || index} className="border-border/30 bg-muted/20 hover:bg-muted/30 rounded border p-1.5 transition-colors">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <FileText className="text-muted-foreground/50 h-2.5 w-2.5 flex-shrink-0" />
                  <h4 className="text-foreground/90 flex-1 text-xs font-medium">{fragment.name}</h4>
                </div>
                {fragment.description && (
                  <p className="text-muted-foreground/70 line-clamp-2 pl-4 text-[10px] leading-relaxed">{fragment.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 动态系统提示词 */}
      {data.dynamicSystemPrompt && (
        <div className="space-y-1">
          <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
            <FileText className="h-3 w-3" />
            <span>生成的动态系统提示词</span>
            {data.shouldUpdateSystemPrompt && (
              <span className="flex items-center gap-0.5 text-[10px] text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-2.5 w-2.5" />
                已应用
              </span>
            )}
          </div>
          <div className="border-border/30 bg-muted/10 rounded border p-2">
            <div className="relative">
              <pre
                className={`text-muted-foreground overflow-x-auto whitespace-pre-wrap text-[10px] leading-relaxed ${
                  isPromptExpanded ? '' : 'line-clamp-6'
                }`}
              >
                <code>{data.dynamicSystemPrompt}</code>
              </pre>
              {!isPromptExpanded && data.dynamicSystemPrompt.length > 300 && (
                <button
                  type="button"
                  onClick={() => setIsPromptExpanded(true)}
                  className="text-muted-foreground/70 hover:text-foreground/80 mt-1 text-[10px] underline"
                >
                  展开完整内容
                </button>
              )}
              {isPromptExpanded && (
                <button
                  type="button"
                  onClick={() => setIsPromptExpanded(false)}
                  className="text-muted-foreground/70 hover:text-foreground/80 mt-1 text-[10px] underline"
                >
                  收起
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 原因说明 */}
      {data.reasons && data.reasons.length > 0 && (
        <div className="text-muted-foreground/50 text-xs">
          {data.reasons.map((reason, index) => (
            <div key={index} className="flex items-start gap-1.5">
              <span className="mt-0.5">•</span>
              <span>{reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
