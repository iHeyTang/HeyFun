import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ContentBlock } from '@modelcontextprotocol/sdk/types.js';
import type { UnifiedChat } from '@repo/llm/chat';

export type BaseMcpConfig = {
  id: string;
  name: string;
  version: string;
};

export type AddStdioMcpConfig = BaseMcpConfig & {
  command: string;
  args: string[];
  env: Record<string, string>;
};

export type AddSseMcpConfig = BaseMcpConfig & {
  url: string;
  headers: Record<string, string>;
};

export type AddMcpConfig = AddStdioMcpConfig | AddSseMcpConfig;

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
  toOpenAITool(): UnifiedChat.Tool;

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
