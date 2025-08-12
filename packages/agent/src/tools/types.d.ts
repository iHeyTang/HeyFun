import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ContentBlock } from '@modelcontextprotocol/sdk/types.js';
import type { Chat } from '@repo/llm/chat';

/**
 * MCP工具配置接口
 */
export interface ToolConfig {
  id: string;
  name: string;
  // for stdio
  command: string;
  args: string[];
  env: Record<string, string>;
  // for sse
  url: string;
  headers: Record<string, any>;
}

export interface BaseToolParameters {
  [key: string]: unknown;
}

/**
 * 基础工具接口
 */
export interface BaseTool<P extends BaseToolParameters = BaseToolParameters> {
  name: string;
  description: string;

  // 执行工具
  execute(params: P): Promise<ToolResult>;

  // 转换为OpenAI工具格式
  toOpenAITool(): Chat.ChatCompletionTool;

  // 清理资源（可选）
  cleanup?(): Promise<void>;
}

// 工具调用结果
// @see https://modelcontextprotocol.io/specification/2025-06-18/schema#calltoolresult
export type ToolResult = {
  _meta?: Record<string, any>;
  content: ContentBlock[];
  isError?: boolean;
  structredContent?: Record<string, unknown>;
  [key: string]: unknown;
};
