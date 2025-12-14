/**
 * Agent 模块核心类型定义
 */

import { AgentMCPConfig } from './mcp';

// Agent 配置
export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  modelId: string;
  tools?: any[]; // LangChain Tool[]
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  role?: 'participant' | 'supervisor' | 'observer';
  // MCP 配置
  mcp?: AgentMCPConfig;
  // MCP 工具类型标记（用于自动配置 MCP）
  mcpTools?: string[]; // 例如: ['filesystem', 'github', 'postgres']
}

// 消息定义
export interface Message {
  id: string;
  from: string; // Agent ID 或 'user'
  content: string;
  timestamp: number;
  type: 'user' | 'agent' | 'system' | 'tool_call' | 'tool_result';
  metadata?: Record<string, any>;
}

// 上下文
export interface Context {
  id: string;
  parentId?: string;
  data: Record<string, any>;
  metadata: {
    createdAt: number;
    updatedAt: number;
    version: number;
  };
  // 对话历史（用于保持上下文连续性）
  history?: Message[];
}

// 流式输出块
export interface StreamChunk {
  agentId: string;
  conversationId: string; // 会话 ID
  content: string;
  timestamp: number;
  type: 'text' | 'tool_call' | 'tool_result' | 'error' | 'thinking' | 'initializing_start' | 'initializing_end';
  metadata?: {
    agentName?: string;
    toolName?: string;
    toolArgs?: Record<string, any>;
    [key: string]: any;
  };
}

// 执行结果
export interface ExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  agentId: string;
  conversationId: string;
  duration: number;
  contextId?: string;
}

// 导出 MCP 相关类型
export * from './mcp';
