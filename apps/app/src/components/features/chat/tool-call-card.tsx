/**
 * ToolCallCard 组件
 * 专门渲染工具调用的特殊 UI，支持显示工具结果
 */

'use client';

import { cn } from '@/lib/utils';
import { CheckCircle2, Loader2, Wrench, XCircle } from 'lucide-react';
import { useState } from 'react';
import { WebSearchResult } from './tool-renderers/web-search-result';
import { AigcModelsResult } from './tool-renderers/aigc-models-result';
import { InitializeAgentResult } from './tool-renderers/initialize-agent-result';
import { PresentationResult } from './tool-renderers/presentation-result';
import { ImageSearchResult } from './tool-renderers/image-search-result';
import { BrowserNavigateResult } from './tool-renderers/browser-navigate-result';
import { BrowserClickResult } from './tool-renderers/browser-click-result';
import { BrowserExtractContentResult } from './tool-renderers/browser-extract-content-result';
import { BrowserDownloadResult } from './tool-renderers/browser-download-result';
import { ConfigureEnvironmentVariableResult } from './tool-renderers/configure-environment-variable-result';
import { DouyinGetVideoInfoResult } from './tool-renderers/douyin-get-video-info-result';
import { DouyinDownloadVideoResult } from './tool-renderers/douyin-download-video-result';
import { NoteCreateResult } from './tool-renderers/note-create-result';
import { NoteEditResult } from './tool-renderers/note-edit-result';
import { NoteReadResult } from './tool-renderers/note-read-result';
import { useBuiltinTools } from '@/hooks/use-builtin-tools';

interface ToolCallCardProps {
  toolCalls: PrismaJson.ToolCall[];
  toolResults?: PrismaJson.ToolResult[];
  className?: string;
  messageId?: string;
  sessionId?: string;
  onToolClick?: (toolCallId: string) => void;
}

export const ToolCallCard = ({ toolCalls, toolResults, className, messageId, sessionId, onToolClick }: ToolCallCardProps) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const { getToolDisplayName } = useBuiltinTools();

  const handleToolClick = (toolCallId: string) => {
    if (onToolClick) {
      onToolClick(toolCallId);
    } else {
      // 如果没有提供回调，保持原来的展开行为（向后兼容）
      setExpandedIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(toolCallId)) {
          newSet.delete(toolCallId);
        } else {
          newSet.add(toolCallId);
        }
        return newSet;
      });
    }
  };

  const parseArguments = (args: string) => {
    try {
      return JSON.parse(args);
    } catch {
      return args;
    }
  };

  // 根据工具名称找到对应的结果
  const getResultForTool = (toolName: string): PrismaJson.ToolResult | undefined => {
    return toolResults?.find(r => r.toolName === toolName);
  };

  // 获取工具的自定义渲染器
  const getToolRenderer = (toolName: string) => {
    const renderers: Record<
      string,
      React.ComponentType<{
        args?: Record<string, any>;
        result?: any;
        status: 'pending' | 'running' | 'success' | 'error';
        error?: string;
        messageId?: string;
        toolCallId?: string;
        sessionId?: string;
      }>
    > = {
      web_search: WebSearchResult,
      image_search: ImageSearchResult,
      get_aigc_models: AigcModelsResult,
      initialize_agent: InitializeAgentResult,
      generate_presentation: PresentationResult,
      browser_navigate: BrowserNavigateResult,
      browser_click: BrowserClickResult,
      browser_extract_content: BrowserExtractContentResult,
      browser_download: BrowserDownloadResult,
      configure_environment_variable: ConfigureEnvironmentVariableResult,
      douyin_get_video_info: DouyinGetVideoInfoResult,
      douyin_download_video: DouyinDownloadVideoResult,
      note_create: NoteCreateResult,
      note_edit: NoteEditResult,
      note_read: NoteReadResult,
    };
    return renderers[toolName];
  };

  // 渲染工具结果（支持自定义渲染器）
  const renderToolResult = (toolName: string, args: any, result: PrismaJson.ToolResult | undefined, isExpanded: boolean, toolCallId?: string) => {
    if (!isExpanded) return null;

    const CustomRenderer = getToolRenderer(toolName);

    // 如果有自定义渲染器，使用自定义渲染
    if (CustomRenderer) {
      // 如果没有结果，显示loading状态
      if (!result) {
        return (
          <div className="min-w-0 overflow-hidden px-2.5 pb-2 pt-1.5">
            <CustomRenderer
              args={args}
              result={undefined}
              status="running"
              error={undefined}
              messageId={messageId}
              toolCallId={toolCallId}
              sessionId={sessionId}
            />
          </div>
        );
      }

      const status = result.success ? 'success' : 'error';
      return (
        <div className="min-w-0 overflow-hidden px-2.5 pb-2 pt-1.5">
          <CustomRenderer
            args={args}
            result={result.data}
            status={status}
            error={result.error}
            messageId={messageId}
            toolCallId={toolCallId}
            sessionId={sessionId}
          />
        </div>
      );
    }

    // 否则使用默认的 JSON 显示（必须有结果才能显示）
    if (!result) return null;

    return (
      <div className="min-w-0 overflow-hidden px-2.5 pb-2 pt-1.5">
        <div className="text-muted-foreground mb-1 text-[9px] font-medium uppercase opacity-50">Output</div>
        <pre className="text-muted-foreground overflow-x-auto text-[10px] leading-relaxed">
          <code>
            {result.success ? (typeof result.data === 'object' ? JSON.stringify(result.data, null, 2) : String(result.data)) : result.error}
          </code>
        </pre>
      </div>
    );
  };

  // 如果只有一个工具，显示精简版
  if (toolCalls.length === 1) {
    const toolCall = toolCalls[0];
    if (!toolCall) return null;

    const isExpanded = expandedIds.has(toolCall.id);
    const args = parseArguments(toolCall.function.arguments);
    const result = getResultForTool(toolCall.function.name);
    return (
      <div className={cn('min-w-0 space-y-0', className)}>
        <div className="border-border/20 bg-muted/30 hover:border-border/40 hover:bg-muted/50 group w-full min-w-0 rounded-md border transition-all">
          <div className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs" onClick={() => handleToolClick(toolCall.id)}>
            <Wrench className="text-muted-foreground h-3 w-3 opacity-60" />
            <span className="text-muted-foreground flex-1 opacity-80">{getToolDisplayName(toolCall.function.name)}</span>

            {/* 结果状态图标 */}
            {result ? (
              result.success ? (
                <CheckCircle2 className="h-3 w-3 text-green-600/60 dark:text-green-500/60" />
              ) : (
                <XCircle className="h-3 w-3 text-red-600/60 dark:text-red-500/60" />
              )
            ) : (
              <Loader2 className="text-muted-foreground/60 h-3 w-3 animate-spin" />
            )}
          </div>

          {/* 展开内容：输入参数 + 输出结果 */}
          {isExpanded && (
            <div className="border-border/20 border-t">
              {/* 输入参数 - 只有在没有自定义渲染器或需要显示时才显示 */}
              {!getToolRenderer(toolCall.function.name) && (
                <div className="min-w-0 overflow-hidden px-2.5 pb-2 pt-1.5">
                  <div className="text-muted-foreground mb-1 text-[9px] font-medium uppercase opacity-50">Input</div>
                  <pre className="text-muted-foreground overflow-x-auto text-[10px] leading-relaxed">
                    <code>{typeof args === 'object' ? JSON.stringify(args, null, 2) : args}</code>
                  </pre>
                </div>
              )}

              {/* 分割线 + 输出结果 */}
              {(result || getToolRenderer(toolCall.function.name)) && (
                <>
                  {!getToolRenderer(toolCall.function.name) && <div className="border-border/20 border-t" />}
                  {renderToolResult(toolCall.function.name, args, result, true, toolCall.id)}
                </>
              )}
              {/* 没有自定义渲染器且没有结果时，显示loading提示 */}
              {!result && !getToolRenderer(toolCall.function.name) && (
                <>
                  <div className="border-border/20 border-t" />
                  <div className="min-w-0 overflow-hidden px-2.5 pb-2 pt-1.5">
                    <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>正在执行中...</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 多个工具时，显示紧凑列表
  return (
    <div className={cn('min-w-0 space-y-1', className)}>
      {toolCalls.map((toolCall, index) => {
        const isExpanded = expandedIds.has(toolCall.id);
        const args = parseArguments(toolCall.function.arguments);
        const result = getResultForTool(toolCall.function.name);

        return (
          <div
            key={toolCall.id}
            className="border-border/20 bg-muted/30 hover:border-border/40 hover:bg-muted/50 group w-fit min-w-0 rounded-md border transition-all"
          >
            <div className="group flex cursor-pointer items-center gap-2 px-2.5 py-1.5" onClick={() => handleToolClick(toolCall.id)}>
              <Wrench className="text-muted-foreground h-3 w-3 opacity-60" />
              <span className="text-muted-foreground flex-1 text-xs opacity-80">
                {getToolDisplayName(toolCall.function.name)}
                <span className="text-muted-foreground/50 ml-1.5">#{index + 1}</span>
              </span>

              {/* 结果状态图标 */}
              {result ? (
                result.success ? (
                  <CheckCircle2 className="h-3 w-3 text-green-600/60 dark:text-green-500/60" />
                ) : (
                  <XCircle className="h-3 w-3 text-red-600/60 dark:text-red-500/60" />
                )
              ) : (
                <Loader2 className="text-muted-foreground/60 h-3 w-3 animate-spin" />
              )}
            </div>

            {/* 展开内容：输入参数 + 输出结果 */}
            {isExpanded && toolCall.function.name !== 'initialize_agent' && (
              <div className="border-border/20 border-t">
                {/* 输入参数 - 只有在没有自定义渲染器或需要显示时才显示 */}
                {!getToolRenderer(toolCall.function.name) && (
                  <div className="min-w-0 overflow-hidden px-2.5 pb-2 pt-1.5">
                    <div className="text-muted-foreground mb-1 text-[9px] font-medium uppercase opacity-50">Input</div>
                    <pre className="text-muted-foreground overflow-x-auto text-[10px] leading-relaxed">
                      <code>{typeof args === 'object' ? JSON.stringify(args, null, 2) : args}</code>
                    </pre>
                  </div>
                )}

                {/* 分割线 + 输出结果 */}
                {(result || getToolRenderer(toolCall.function.name)) && (
                  <>
                    {!getToolRenderer(toolCall.function.name) && <div className="border-border/20 border-t" />}
                    {renderToolResult(toolCall.function.name, args, result, true, toolCall.id)}
                  </>
                )}
                {/* 没有自定义渲染器且没有结果时，显示loading提示 */}
                {!result && !getToolRenderer(toolCall.function.name) && (
                  <>
                    <div className="border-border/20 border-t" />
                    <div className="min-w-0 overflow-hidden px-2.5 pb-2 pt-1.5">
                      <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>正在执行中...</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
