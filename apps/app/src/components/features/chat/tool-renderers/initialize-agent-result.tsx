/**
 * Initialize Agent 工具结果展示组件
 */

'use client';

import { CheckCircle2, AlertCircle, Loader2, Sparkles, FileText, Wrench } from 'lucide-react';
import { useBuiltinTools } from '@/hooks/use-builtin-tools';
import { WysiwygEditor } from '@/components/block/wysiwyg-editor';

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
  const { getToolDisplayName } = useBuiltinTools();

  const data: InitializeAgentData | null = result && status === 'success' ? result : null;
  const userMessage = args?.userMessage;

  // 错误状态
  if (status === 'error' || error) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <span className="text-foreground font-medium">初始化失败</span>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">{error || 'Agent 初始化失败'}</p>
      </div>
    );
  }

  // 加载状态
  if (status === 'pending' || status === 'running') {
    return (
      <div className="flex items-center gap-2.5 text-sm">
        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        <span className="text-muted-foreground">正在初始化 Agent...</span>
      </div>
    );
  }

  // 成功状态
  const hasFragments = data?.fragments && data.fragments.length > 0;
  const hasTools = data?.tools && data.tools.length > 0;
  const hasKeywords = data?.keywords && data.keywords.length > 0;
  const hasPrompt = !!data?.dynamicSystemPrompt;

  return (
    <div className="space-y-4">
      {/* 状态摘要 */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-foreground text-sm font-medium">初始化完成</span>
        </div>
        {hasFragments && (
          <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <FileText className="h-3.5 w-3.5" />
            <span>
              <span className="text-foreground font-medium">{data!.fragments!.length}</span> 个片段
            </span>
          </div>
        )}
        {hasTools && (
          <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Wrench className="h-3.5 w-3.5" />
            <span>
              <span className="text-foreground font-medium">{data!.tools!.length}</span> 个工具
            </span>
          </div>
        )}
      </div>

      {/* 关键词 */}
      {hasKeywords && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="text-muted-foreground/70 h-3.5 w-3.5" />
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">关键词</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data!.keywords!.slice(0, 20).map((keyword, index) => (
              <span
                key={index}
                className="border-border/50 bg-muted/40 text-foreground/80 hover:bg-muted/60 dark:bg-muted/30 dark:hover:bg-muted/50 rounded-md border px-2 py-1 text-xs font-medium transition-colors"
              >
                {keyword}
              </span>
            ))}
            {data!.keywords!.length > 20 && (
              <span className="text-muted-foreground/60 flex items-center px-2 py-1 text-xs">+{data!.keywords!.length - 20}</span>
            )}
          </div>
        </div>
      )}

      {/* 片段列表 */}
      {hasFragments && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5">
            <FileText className="text-muted-foreground/70 h-3.5 w-3.5" />
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">检索到的片段</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {data!.fragments!.map((fragment, index) => (
              <div
                key={fragment.id || index}
                className="border-border/50 bg-muted/30 hover:border-border hover:bg-muted/50 dark:bg-muted/20 dark:hover:bg-muted/40 group cursor-pointer rounded-lg border p-2.5 transition-all"
                title={fragment.description}
              >
                <p className="text-foreground truncate text-sm font-medium">{fragment.name}</p>
                {fragment.description && <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">{fragment.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 工具列表 */}
      {hasTools && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5">
            <Wrench className="text-muted-foreground/70 h-3.5 w-3.5" />
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">已装载的工具</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {data!.tools!.map((tool, index) => (
              <div
                key={tool.name || index}
                className="border-border/50 bg-muted/30 hover:border-border hover:bg-muted/50 dark:bg-muted/20 dark:hover:bg-muted/40 group cursor-pointer rounded-lg border p-2.5 transition-all"
                title={tool.description}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-foreground truncate text-sm font-medium">{getToolDisplayName(tool.name)}</p>
                  {tool.category && (
                    <span className="text-muted-foreground/70 bg-muted/50 flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                      {tool.category}
                    </span>
                  )}
                </div>
                {tool.description && <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">{tool.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 动态提示词 */}
      {hasPrompt && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="text-muted-foreground/70 h-3.5 w-3.5" />
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">动态提示词</p>
            </div>
            {data!.shouldUpdateSystemPrompt && (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">已应用</span>
            )}
          </div>
          <div className="border-border/50 bg-muted/20 dark:bg-muted/10 rounded-lg border">
            <WysiwygEditor
              value={data!.dynamicSystemPrompt || ''}
              readOnly={true}
              showToolbar={false}
              isStreaming={false}
              className="text-xs"
              editorClassName="p-3 min-h-[80px]"
            />
          </div>
        </div>
      )}

      {/* 无结果提示 */}
      {!hasFragments && !hasTools && !hasPrompt && (
        <div className="border-border/50 bg-muted/20 dark:bg-muted/10 rounded-lg border p-4 text-center">
          <p className="text-muted-foreground text-sm">未检索到相关片段或工具</p>
        </div>
      )}
    </div>
  );
}
