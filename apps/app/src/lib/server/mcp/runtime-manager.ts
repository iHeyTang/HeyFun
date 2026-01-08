/**
 * MCP Runtime Manager (MRM)
 * 管理 MCP 连接、工具发现和工具调用
 *
 * 注意：Agent 不能直接调用 MRM，只能通过 Tool 间接操作
 */

import type { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { MCPHandle } from './handle';

/**
 * MCP 操作结果
 */
export interface MCPActionResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * MCP 配置（从数据库解密后）
 */
export interface MCPConfig {
  type: 'streamable' | 'sse' | 'stdio';
  url?: string; // for streamable/sse
  command?: string; // for stdio
  args?: string[]; // for stdio
  env?: Record<string, string>; // for stdio
  headers?: Record<string, string>; // for streamable/sse
  query?: Record<string, string>; // for streamable/sse
}

/**
 * MCP Runtime Manager 接口
 */
export interface MCPRuntimeManager {
  /**
   * 创建并连接 MCP 服务器
   * @param configId MCP 配置 ID
   * @param config MCP 配置
   * @param sessionId Session ID（用于 stdio 类型的 sandbox）
   * @param organizationId Organization ID
   */
  create(configId: string, config: MCPConfig, sessionId: string, organizationId: string): Promise<MCPHandle>;

  /**
   * 根据 handle 恢复/获取已存在的 MCP 连接
   * @param handle MCPHandle
   */
  get(handle: MCPHandle): Promise<MCPRuntimeInstance>;

  /**
   * 发现 MCP 服务器提供的工具
   * @param handle MCPHandle
   */
  discoverTools(handle: MCPHandle): Promise<{ tools: ToolDefinition[] }>;

  /**
   * 调用 MCP 工具
   * @param handle MCPHandle
   * @param toolName 工具名称
   * @param arguments_ 工具参数
   */
  callTool(handle: MCPHandle, toolName: string, arguments_: Record<string, any>): Promise<MCPActionResult>;

  /**
   * 关闭 MCP 连接
   * @param handle MCPHandle
   */
  close(handle: MCPHandle): Promise<void>;
}

/**
 * MCP Runtime Instance
 * 用于直接操作 MCP 连接（内部使用）
 */
export interface MCPRuntimeInstance {
  handle: MCPHandle;
  client: Client;
  discoverTools(): Promise<{ tools: ToolDefinition[] }>;
  callTool(toolName: string, arguments_: Record<string, any>): Promise<MCPActionResult>;
  close(): Promise<void>;
}
