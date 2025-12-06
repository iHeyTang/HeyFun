/**
 * ToolCallCard 组件
 * 专门渲染工具调用的特殊 UI，支持显示工具结果
 */

'use client';

import { Wrench, CheckCircle2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { ToolCall, ToolResult } from './types';

interface ToolCallCardProps {
  toolCalls: ToolCall[];
  toolResults?: ToolResult[];
  className?: string;
}

export const ToolCallCard = ({ toolCalls, toolResults, className }: ToolCallCardProps) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const parseArguments = (args: string) => {
    try {
      return JSON.parse(args);
    } catch {
      return args;
    }
  };

  // 根据工具名称找到对应的结果
  const getResultForTool = (toolName: string): ToolResult | undefined => {
    return toolResults?.find(r => r.toolName === toolName);
  };

  // 如果只有一个工具，显示精简版
  if (toolCalls.length === 1) {
    const toolCall = toolCalls[0];
    if (!toolCall) return null;

    const isExpanded = expandedIds.has(toolCall.id);
    const args = parseArguments(toolCall.function.arguments);
    const result = getResultForTool(toolCall.function.name);

    return (
      <div className={cn('space-y-0', className)}>
        <div
          className="border-border/20 bg-muted/30 hover:border-border/40 hover:bg-muted/50 group cursor-pointer rounded-md border transition-all"
          onClick={() => toggleExpand(toolCall.id)}
        >
          <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
            <Wrench className="text-muted-foreground h-3 w-3 opacity-60" />
            <span className="text-muted-foreground flex-1 opacity-80">{toolCall.function.name}</span>

            {/* 结果状态图标 */}
            {result &&
              (result.success ? (
                <CheckCircle2 className="h-3 w-3 text-green-600/60 dark:text-green-500/60" />
              ) : (
                <XCircle className="h-3 w-3 text-red-600/60 dark:text-red-500/60" />
              ))}
          </div>

          {/* 展开内容：输入参数 + 输出结果 */}
          {isExpanded && (
            <div className="border-border/20 border-t">
              {/* 输入参数 */}
              <div className="px-2.5 pb-2 pt-1.5">
                <div className="text-muted-foreground mb-1 text-[9px] font-medium uppercase opacity-50">Input</div>
                <pre className="text-muted-foreground overflow-x-auto text-[10px] leading-relaxed">
                  <code>{typeof args === 'object' ? JSON.stringify(args, null, 2) : args}</code>
                </pre>
              </div>

              {/* 分割线 + 输出结果 */}
              {result && (
                <>
                  <div className="border-border/20 border-t" />
                  <div className="px-2.5 pb-2 pt-1.5">
                    <div className="text-muted-foreground mb-1 text-[9px] font-medium uppercase opacity-50">Output</div>
                    <pre className="text-muted-foreground overflow-x-auto text-[10px] leading-relaxed">
                      <code>
                        {result.success
                          ? typeof result.data === 'object'
                            ? JSON.stringify(result.data, null, 2)
                            : String(result.data)
                          : result.error}
                      </code>
                    </pre>
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
    <div className={cn('space-y-1', className)}>
      {toolCalls.map((toolCall, index) => {
        const isExpanded = expandedIds.has(toolCall.id);
        const args = parseArguments(toolCall.function.arguments);
        const result = getResultForTool(toolCall.function.name);

        return (
          <div
            key={toolCall.id}
            className="border-border/20 bg-muted/30 hover:border-border/40 hover:bg-muted/50 group rounded-md border transition-all"
          >
            <div className="group flex cursor-pointer items-center gap-2 px-2.5 py-1.5" onClick={() => toggleExpand(toolCall.id)}>
              <Wrench className="text-muted-foreground h-3 w-3 opacity-60" />
              <span className="text-muted-foreground flex-1 text-xs opacity-80">
                {toolCall.function.name}
                <span className="text-muted-foreground/50 ml-1.5">#{index + 1}</span>
              </span>

              {/* 结果状态图标 */}
              {result &&
                (result.success ? (
                  <CheckCircle2 className="h-3 w-3 text-green-600/60 dark:text-green-500/60" />
                ) : (
                  <XCircle className="h-3 w-3 text-red-600/60 dark:text-red-500/60" />
                ))}
            </div>

            {/* 展开内容：输入参数 + 输出结果 */}
            {isExpanded && (
              <div className="border-border/20 border-t">
                {/* 输入参数 */}
                <div className="px-2.5 pb-2 pt-1.5">
                  <div className="text-muted-foreground mb-1 text-[9px] font-medium uppercase opacity-50">Input</div>
                  <pre className="text-muted-foreground overflow-x-auto text-[10px] leading-relaxed">
                    <code>{typeof args === 'object' ? JSON.stringify(args, null, 2) : args}</code>
                  </pre>
                </div>

                {/* 分割线 + 输出结果 */}
                {result && (
                  <>
                    <div className="border-border/20 border-t" />
                    <div className="px-2.5 pb-2 pt-1.5">
                      <div className="text-muted-foreground mb-1 text-[9px] font-medium uppercase opacity-50">Output</div>
                      <pre className="text-muted-foreground overflow-x-auto text-[10px] leading-relaxed">
                        <code>
                          {result.success
                            ? typeof result.data === 'object'
                              ? JSON.stringify(result.data, null, 2)
                              : String(result.data)
                            : result.error}
                        </code>
                      </pre>
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
