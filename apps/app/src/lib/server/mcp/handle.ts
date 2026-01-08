/**
 * MCPHandle - 可序列化的 MCP 句柄
 * 用于在 Upstash Workflow state 中持久化 MCP 连接信息
 * Agent 只能通过这个句柄引用 MCP，不能访问 MCP 的内部实现
 */

export type MCPTransportType = 'streamable' | 'sse' | 'stdio';

export type MCPStatus = 'connecting' | 'ready' | 'disconnected' | 'error';

/**
 * MCPHandle - 可序列化的 MCP 句柄
 * 必须可以在 Upstash Workflow state 中安全存储
 */
export interface MCPHandle {
  /** MCP 唯一标识符 */
  id: string;
  /** MCP 配置 ID（关联到 McpServerConfigs） */
  configId: string;
  /** 传输类型 */
  transportType: MCPTransportType;
  /** MCP 状态 */
  status: MCPStatus;
  /** 关联的 Sandbox ID（仅用于 stdio 类型） */
  sandboxId?: string;
  /** 已发现的工具列表（工具名称数组） */
  discoveredTools?: string[];
  /** 创建时间（ISO 8601 字符串） */
  createdAt: string;
  /** 最后使用时间（ISO 8601 字符串） */
  lastUsedAt?: string;
  /** 错误信息（如果状态为 error） */
  error?: string;
}

/**
 * 创建默认的 MCPHandle
 */
export function createMCPHandle(
  id: string,
  configId: string,
  transportType: MCPTransportType,
  options: {
    status?: MCPStatus;
    sandboxId?: string;
    discoveredTools?: string[];
    error?: string;
  } = {},
): MCPHandle {
  const now = new Date().toISOString();
  return {
    id,
    configId,
    transportType,
    status: options.status ?? 'connecting',
    sandboxId: options.sandboxId,
    discoveredTools: options.discoveredTools,
    createdAt: now,
    lastUsedAt: now,
    error: options.error,
  };
}

/**
 * 更新 MCPHandle 的最后使用时间
 */
export function updateMCPHandleLastUsed(handle: MCPHandle): MCPHandle {
  return {
    ...handle,
    lastUsedAt: new Date().toISOString(),
  };
}

/**
 * 更新 MCPHandle 的状态
 */
export function updateMCPHandleStatus(handle: MCPHandle, status: MCPStatus, error?: string): MCPHandle {
  return {
    ...handle,
    status,
    error,
  };
}

/**
 * 更新 MCPHandle 的已发现工具列表
 */
export function updateMCPHandleTools(handle: MCPHandle, tools: string[]): MCPHandle {
  return {
    ...handle,
    discoveredTools: tools,
  };
}
