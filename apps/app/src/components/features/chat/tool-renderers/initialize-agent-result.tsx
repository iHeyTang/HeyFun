/**
 * Initialize Agent 工具结果展示组件
 */

'use client';

import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useBuiltinTools } from '@/hooks/use-builtin-tools';

interface InitializeAgentResultProps {
  args?: Record<string, any>;
  result?: any;
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
}

interface Fragment {
  id: string;
  name: string;
  description: string;
}

interface Tool {
  name: string;
  description: string;
  category?: string;
  manual?: string;
}

interface InitializeAgentData {
  fragmentIds?: string[];
  fragments?: Fragment[];
  dynamicSystemPrompt?: string;
  confidence?: number;
  reasons?: string[];
  shouldUpdateSystemPrompt?: boolean;
  tools?: Tool[];
  originalQuery?: string;
  cleanedQuery?: string;
  keywords?: string[];
}

export function InitializeAgentResult({ args, result, status, error }: InitializeAgentResultProps) {
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const { getToolDisplayName } = useBuiltinTools();

  const data: InitializeAgentData | null = result && status === 'success' ? result : null;
  const userMessage = args?.userMessage;

  // 错误状态
  if (status === 'error' || error) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-red-500">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>初始化失败</span>
        </div>
        <p className="text-muted-foreground text-[11px]">{error || 'Agent 初始化失败'}</p>
      </div>
    );
  }

  // 加载状态
  if (status === 'pending' || status === 'running') {
    return (
      <div className="flex items-center gap-2 text-xs">
        <Loader2 className="text-muted-foreground h-3.5 w-3.5 animate-spin" />
        <span className="text-muted-foreground">正在初始化...</span>
      </div>
    );
  }

  // 成功状态
  const hasFragments = data?.fragments && data.fragments.length > 0;
  const hasTools = data?.tools && data.tools.length > 0;
  const hasKeywords = data?.keywords && data.keywords.length > 0;
  const hasPrompt = !!data?.dynamicSystemPrompt;

  return (
    <div className="space-y-3">
      {/* 摘要行 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="text-muted-foreground flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          初始化完成
        </span>
        {hasFragments && (
          <span className="text-muted-foreground">
            <span className="text-foreground/80 font-medium">{data!.fragments!.length}</span> 个片段
          </span>
        )}
        {hasTools && (
          <span className="text-muted-foreground">
            <span className="text-foreground/80 font-medium">{data!.tools!.length}</span> 个工具
          </span>
        )}
      </div>

      {/* 关键词 */}
      {hasKeywords && (
        <div className="space-y-1.5">
          <p className="text-muted-foreground/60 text-[10px] uppercase tracking-wide">关键词</p>
          <div className="flex flex-wrap gap-1">
            {data!.keywords!.slice(0, 15).map((keyword, index) => (
              <span key={index} className="bg-muted/50 text-foreground/70 rounded px-1.5 py-0.5 text-[10px]">
                {keyword}
              </span>
            ))}
            {data!.keywords!.length > 15 && <span className="text-muted-foreground/50 px-1 py-0.5 text-[10px]">+{data!.keywords!.length - 15}</span>}
          </div>
        </div>
      )}

      {/* 片段列表 */}
      {hasFragments && (
        <div className="space-y-1.5">
          <p className="text-muted-foreground/60 text-[10px] uppercase tracking-wide">检索到的片段</p>
          <div className="flex flex-wrap gap-1.5">
            {data!.fragments!.map((fragment, index) => (
              <div
                key={fragment.id || index}
                className="bg-muted/30 hover:bg-muted/40 max-w-[180px] rounded px-2 py-1 transition-colors"
                title={fragment.description}
              >
                <p className="text-foreground/90 truncate text-[11px] font-medium">{fragment.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 工具列表 */}
      {hasTools && (
        <div className="space-y-1.5">
          <p className="text-muted-foreground/60 text-[10px] uppercase tracking-wide">已装载的工具</p>
          <div className="flex flex-wrap gap-1.5">
            {data!.tools!.map((tool, index) => (
              <div
                key={tool.name || index}
                className="bg-muted/30 hover:bg-muted/40 max-w-[200px] rounded px-2 py-1 transition-colors"
                title={tool.description}
              >
                <p className="text-foreground/90 truncate text-[11px] font-medium">{getToolDisplayName(tool.name)}</p>
                {tool.category && <p className="text-muted-foreground/50 truncate text-[9px]">{tool.category}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 动态提示词 */}
      {hasPrompt && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground/60 text-[10px] uppercase tracking-wide">动态提示词</p>
            {data!.shouldUpdateSystemPrompt && <span className="text-[9px] text-emerald-500">已应用</span>}
          </div>
          <div className="bg-muted/20 rounded">
            <pre
              className={`text-muted-foreground overflow-x-auto whitespace-pre-wrap p-2 text-[10px] leading-relaxed ${
                isPromptExpanded ? '' : 'line-clamp-4'
              }`}
            >
              {data!.dynamicSystemPrompt}
            </pre>
          </div>
          {data!.dynamicSystemPrompt!.length > 200 && (
            <button
              type="button"
              onClick={() => setIsPromptExpanded(!isPromptExpanded)}
              className="text-muted-foreground/50 hover:text-muted-foreground text-[10px] transition-colors"
            >
              {isPromptExpanded ? '收起' : '展开全部'}
            </button>
          )}
        </div>
      )}

      {/* 无结果提示 */}
      {!hasFragments && !hasTools && <p className="text-muted-foreground/60 text-[11px]">未检索到相关片段或工具</p>}
    </div>
  );
}
