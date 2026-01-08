/**
 * MCP Runtime Manager 基础实现
 * 使用 mcp-uni 作为统一网关管理多个 MCP 服务器
 */

import { nanoid } from 'nanoid';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { MCPRuntimeManager, MCPRuntimeInstance, MCPConfig, MCPActionResult } from '../runtime-manager';
import { MCPHandle, createMCPHandle, updateMCPHandleStatus, updateMCPHandleTools } from '../handle';
import { MCPURLValidator } from '../url-validator';
import { getSandboxRuntimeManager } from '@/lib/server/sandbox';
import { getSandboxHandleFromState } from '@/agents/tools/sandbox/utils';
import type { ToolDefinition } from '@/agents/core/tools/tool-definition';
import { ToolRuntime } from '@/agents/core/tools/tool-definition';

/**
 * MCP Runtime Manager 基础实现
 */
export class BaseMCPRuntimeManager implements MCPRuntimeManager {
  // 存储活跃的 MCP 连接
  private connections = new Map<string, MCPRuntimeInstance>();
  // 存储每个 session 的 mcp-uni 实例（每个 session 一个 mcp-uni 服务器）
  private mcpUniInstances = new Map<string, { url: string; port: number }>();

  /**
   * 在 Sandbox 中启动 mcp-uni 服务器（如果尚未启动）
   * mcp-uni 作为统一网关，可以管理多个 stdio MCP 服务器
   */
  private async ensureMcpUniInSandbox(sandboxHandle: any, sessionId: string): Promise<{ url: string; port: number }> {
    // 检查是否已有实例
    const existing = this.mcpUniInstances.get(sessionId);
    if (existing) {
      return existing;
    }

    const srm = getSandboxRuntimeManager();
    const workspaceRoot = sandboxHandle.workspaceRoot || '/workspace';

    // 检查是否已安装 mcp-uni
    const checkCommand = 'npx mcp-uni --version 2>&1 || echo "not-installed"';
    const checkResult = await srm.exec(sandboxHandle, checkCommand, { timeout: 5000 });

    // 启动 mcp-uni 服务器（使用 npx，无需安装）
    // mcp-uni 默认监听 7200 端口，SSE 端点在 /stream
    const mcpUniPort = 7200;
    const startCommand = `npx -y mcp-uni --port ${mcpUniPort} > /tmp/mcp-uni.log 2>&1 &`;

    await srm.exec(sandboxHandle, startCommand, { timeout: 10000 });

    // 等待服务器启动
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 获取 sandbox 的预览 URL（通过端口映射）
    let externalUrl = `http://127.0.0.1:${mcpUniPort}/stream`;

    if (sandboxHandle.previewUrls) {
      const previewUrls = sandboxHandle.previewUrls as Record<string | number, string>;
      const previewUrl = previewUrls[mcpUniPort] || previewUrls[String(mcpUniPort)];

      if (previewUrl) {
        try {
          const previewUrlObj = new URL(previewUrl);
          externalUrl = `${previewUrlObj.protocol}//${previewUrlObj.host}/stream`;
        } catch (error) {
          console.warn('[MCP] Failed to parse previewUrl, using internal URL:', error);
        }
      }
    }

    const instance = { url: externalUrl, port: mcpUniPort };
    this.mcpUniInstances.set(sessionId, instance);

    return instance;
  }

  /**
   * 通过 mcp-uni 连接 stdio MCP 服务器
   */
  private async connectStdioMcpViaUni(
    sandboxHandle: any,
    sessionId: string,
    name: string,
    command: string,
    args: string[],
    env?: Record<string, string>,
  ): Promise<void> {
    const mcpUni = await this.ensureMcpUniInSandbox(sandboxHandle, sessionId);

    // 通过 mcp-uni 的 connect_mcp 工具连接 MCP 服务器
    const connectPayload = {
      name,
      transportConfig: {
        type: 'stdio',
        command,
        args,
        env: env || {},
      },
    };

    // 调用 mcp-uni 的 connect_mcp 工具
    const response = await fetch(`${mcpUni.url.replace('/stream', '')}/tools/connect_mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(connectPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to connect MCP server via mcp-uni: ${errorText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(`Failed to connect MCP server: ${result.error || 'Unknown error'}`);
    }
  }

  async create(configId: string, config: MCPConfig, sessionId: string, organizationId: string): Promise<MCPHandle> {
    const mcpId = nanoid();

    // 验证 URL（如果是 HTTP 类型）
    if ((config.type === 'streamable' || config.type === 'sse') && config.url) {
      const validation = MCPURLValidator.validateURL(config.url);
      if (!validation.valid) {
        throw new Error(`URL validation failed: ${validation.reason}`);
      }
    }

    // 创建 handle
    const handle = createMCPHandle(mcpId, configId, config.type, {
      status: 'connecting',
    });

    try {
      // 创建客户端
      const client = new Client({
        name: 'heyfun-mcp-client',
        version: '1.0.0',
      });

      // 根据类型创建传输层
      let transport;
      if (config.type === 'streamable') {
        if (!config.url) {
          throw new Error('URL is required for streamable transport');
        }
        transport = new StreamableHTTPClientTransport(new URL(config.url));
      } else if (config.type === 'sse') {
        if (!config.url) {
          throw new Error('URL is required for SSE transport');
        }
        transport = new SSEClientTransport(new URL(config.url));
      } else if (config.type === 'stdio') {
        if (!config.command) {
          throw new Error('Command is required for stdio transport');
        }

        // Stdio 类型需要在 Sandbox 中执行
        const sandboxHandle = await getSandboxHandleFromState(sessionId);
        if (!sandboxHandle) {
          throw new Error('Sandbox not found. Stdio MCP requires a sandbox.');
        }

        handle.sandboxId = sandboxHandle.id;

        // 使用 mcp-uni 作为统一网关
        // 1. 确保 mcp-uni 在 sandbox 中运行
        const mcpUni = await this.ensureMcpUniInSandbox(sandboxHandle, sessionId);

        // 2. 通过 mcp-uni 连接 stdio MCP 服务器
        const mcpServerName = `mcp_${mcpId}`;
        await this.connectStdioMcpViaUni(sandboxHandle, sessionId, mcpServerName, config.command, config.args || [], config.env);

        // 3. 使用 SSE transport 连接到 mcp-uni
        transport = new SSEClientTransport(new URL(mcpUni.url));
      } else {
        throw new Error(`Unsupported transport type: ${config.type}`);
      }

      // 连接
      await client.connect(transport);

      // 更新状态
      const connectedHandle = updateMCPHandleStatus(handle, 'ready');

      // 创建实例
      const instance: MCPRuntimeInstance = {
        handle: connectedHandle,
        client,
        discoverTools: async () => {
          return this.discoverTools(connectedHandle);
        },
        callTool: async (toolName: string, arguments_: Record<string, any>) => {
          return this.callTool(connectedHandle, toolName, arguments_);
        },
        close: async () => {
          return this.close(connectedHandle);
        },
      };

      // 存储连接
      this.connections.set(mcpId, instance);

      // 发现工具
      const toolsResult = await this.discoverTools(connectedHandle);
      const toolNames = toolsResult.tools.map(t => t.name);
      const handleWithTools = updateMCPHandleTools(connectedHandle, toolNames);

      // 更新实例的 handle
      instance.handle = handleWithTools;

      return handleWithTools;
    } catch (error) {
      const errorHandle = updateMCPHandleStatus(handle, 'error', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async get(handle: MCPHandle): Promise<MCPRuntimeInstance> {
    const instance = this.connections.get(handle.id);
    if (!instance) {
      throw new Error(`MCP connection not found: ${handle.id}`);
    }
    return instance;
  }

  async discoverTools(handle: MCPHandle): Promise<{ tools: ToolDefinition[] }> {
    const instance = await this.get(handle);

    try {
      // 调用 MCP 的 listTools
      const toolsList = await instance.client.listTools();

      // 转换为系统工具定义格式
      const tools: ToolDefinition[] = toolsList.tools.map((mcpTool: any) => ({
        name: `mcp_${handle.id}_${mcpTool.name}`, // 添加前缀避免冲突
        description: mcpTool.description || '',
        displayName: {
          'zh-CN': mcpTool.name,
          en: mcpTool.name,
        },
        parameters: mcpTool.inputSchema as any,
        runtime: ToolRuntime.SERVER,
        category: 'mcp',
        returnSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            error: { type: 'string' },
          },
        },
        metadata: {
          mcpId: handle.id,
          mcpToolName: mcpTool.name,
          mcpConfigId: handle.configId,
        },
      }));

      return { tools };
    } catch (error) {
      throw new Error(`Failed to discover tools: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async callTool(handle: MCPHandle, toolName: string, arguments_: Record<string, any>): Promise<MCPActionResult> {
    const instance = await this.get(handle);

    try {
      // toolName 应该是原始的 MCP 工具名称（executor 已经处理了前缀）
      // 调用 MCP 工具
      const result = await instance.client.callTool({
        name: toolName,
        arguments: arguments_,
      });

      return {
        success: true,
        data: {
          content: result.content,
          structuredContent: result.structuredContent,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async close(handle: MCPHandle): Promise<void> {
    const instance = this.connections.get(handle.id);
    if (instance) {
      try {
        await instance.client.close();
      } catch (error) {
        console.error(`[MCP] Failed to close connection ${handle.id}:`, error);
      }
      this.connections.delete(handle.id);
    }
  }
}

/**
 * 全局实例
 */
let mcpRuntimeManager: MCPRuntimeManager | null = null;

export function getMCPRuntimeManager(): MCPRuntimeManager {
  if (!mcpRuntimeManager) {
    mcpRuntimeManager = new BaseMCPRuntimeManager();
  }
  return mcpRuntimeManager;
}
