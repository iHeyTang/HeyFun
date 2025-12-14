/**
 * MCP (Model Context Protocol) 相关类型定义
 */

/**
 * MCP 服务器配置
 */
export interface MCPServerConfig {
  /**
   * 服务器唯一标识
   */
  id: string;

  /**
   * 服务器名称
   */
  name: string;

  /**
   * 服务器描述
   */
  description?: string;

  /**
   * 服务器类型
   */
  type: 'stdio' | 'sse' | 'websocket';

  /**
   * 命令行配置（用于 stdio 类型）
   */
  command?: string;
  args?: string[];
  env?: Record<string, string>;

  /**
   * 网络配置（用于 sse/websocket 类型）
   */
  url?: string;
  headers?: Record<string, string>;

  /**
   * 是否启用
   */
  enabled?: boolean;

  /**
   * 超时时间（毫秒）
   */
  timeout?: number;
}

/**
 * MCP 工具定义
 */
export interface MCPTool {
  /**
   * 工具名称
   */
  name: string;

  /**
   * 工具描述
   */
  description: string;

  /**
   * 输入参数 Schema (JSON Schema)
   */
  inputSchema: {
    type: 'object';
    properties?: Record<string, any>;
    required?: string[];
  };
}

/**
 * MCP 资源定义
 */
export interface MCPResource {
  /**
   * 资源 URI
   */
  uri: string;

  /**
   * 资源名称
   */
  name: string;

  /**
   * 资源描述
   */
  description?: string;

  /**
   * 资源 MIME 类型
   */
  mimeType?: string;
}

/**
 * MCP Prompt 定义
 */
export interface MCPPrompt {
  /**
   * Prompt 名称
   */
  name: string;

  /**
   * Prompt 描述
   */
  description?: string;

  /**
   * Prompt 参数
   */
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

/**
 * Agent MCP 配置
 */
export interface AgentMCPConfig {
  /**
   * 启用的 MCP 服务器列表
   */
  servers: MCPServerConfig[];

  /**
   * 是否自动加载所有服务器的工具
   */
  autoLoadTools?: boolean;

  /**
   * 指定要使用的工具列表（如果不指定则使用所有可用工具）
   */
  enabledTools?: string[]; // tool names

  /**
   * 工具调用超时时间（毫秒）
   */
  toolTimeout?: number;

  /**
   * 最大并发工具调用数
   */
  maxConcurrentCalls?: number;
}
