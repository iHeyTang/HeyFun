/**
 * 画布工具基础定义
 * 包含工具类型和创建函数
 */

import { UnifiedChat } from '@repo/llm/chat';
import { ToolResult, ToolExecutionContext } from '../../types';

/**
 * 画布工具定义
 * 包含工具的 schema 和执行器
 */
export interface CanvasTool<TArgs = any> {
  /** 工具定义（LLM 可见） */
  schema: UnifiedChat.Tool;
  /** 执行器（浏览器端执行） */
  executor: (args: TArgs, context: ToolExecutionContext) => Promise<ToolResult>;
}

/**
 * 创建工具的辅助函数
 */
export function createTool<TArgs = any>(
  schema: UnifiedChat.Tool,
  executor: (args: TArgs, context: ToolExecutionContext) => Promise<ToolResult>,
): CanvasTool<TArgs> {
  return { schema, executor };
}

