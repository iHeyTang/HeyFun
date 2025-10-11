import type { Chat } from '@repo/llm/chat';
import type { BaseTool, ToolResult } from './types';
import { AddMcpConfig } from './types';
import type { SandboxRunner } from '../sandbox';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/**
 * 工具集合实现类
 */
export class ToolCollection {
  public tools: BaseTool[] = [];
  public toolMap: Record<string, BaseTool> = {};

  private mcpUni: Client | null = null;

  constructor(...initialTools: BaseTool[]) {
    for (const tool of initialTools) {
      this.addTool(tool);
    }
  }

  async initiate(sandbox: SandboxRunner) {
    const mcpUniUrl = await sandbox!.portal.getMcpUniPortal();
    this.mcpUni = new Client({
      name: 'mcp-uni',
      version: '',
      url: mcpUniUrl.url,
      headers: mcpUniUrl.headers,
    });

    let retryCount = 0;
    const maxRetries = 10;
    const retryDelay = 5000; // 10秒

    while (retryCount < maxRetries) {
      try {
        // 在每次尝试时创建新的 transport 实例
        const transport = new StreamableHTTPClientTransport(new URL(mcpUniUrl.url), {
          requestInit: {
            headers: { ...mcpUniUrl.headers },
            cache: 'no-store',
          },
        });

        await this.mcpUni.connect(transport);
        console.log('MCP Uni connected');
        break;
      } catch (error: any) {
        retryCount++;
        console.error(`MCP Uni connect failed, retry ${retryCount}/${maxRetries}:`, error.message || error);
        if (retryCount >= maxRetries) {
          throw new Error(`Failed to connect to MCP Uni after ${maxRetries} retries: ${error.message || error}`);
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    await this.refreshMcpTools();
  }

  /**
   * 添加工具
   */
  addTool(tool: BaseTool): void {
    if (this.toolMap[tool.name]) {
      console.warn(`Tool '${tool.name}' already exists, replacing...`);
      // 移除旧工具
      const index = this.tools.findIndex(t => t.name === tool.name);
      if (index !== -1) {
        this.tools.splice(index, 1);
      }
    }

    this.tools.push(tool);
    this.toolMap[tool.name] = tool;
  }

  async addMcp(config: AddMcpConfig): Promise<void> {
    if ('url' in config && config.url) {
      await this.mcpUni?.callTool({
        name: 'connect_mcp',
        arguments: {
          name: config.name,
          transportConfig: {
            type: 'sse',
            url: config.url,
            headers: config.headers,
          },
        },
      });
    } else if ('command' in config && config.command) {
      await this.mcpUni?.callTool({
        name: 'connect_mcp',
        arguments: {
          name: config.name,
          transportConfig: {
            type: 'stdio',
            command: config.command,
            args: config.args,
            env: config.env || {},
            cwd: '/heyfun/workspace',
          },
        },
      });
    }
    await this.refreshMcpTools();
  }

  /**
   * 获取工具
   */
  getTool(name: string): BaseTool | undefined {
    return this.toolMap[name];
  }

  /**
   * 执行工具
   */
  async execute(name: string, input: any): Promise<ToolResult> {
    const tool = this.getTool(name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found`);
    }

    try {
      return await tool.execute(input);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Error executing tool '${name}': ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * 转换为OpenAI工具参数格式
   */
  toOpenAITools(): Chat.ChatCompletionTool[] {
    return this.tools.map(tool => tool.toOpenAITool());
  }

  /**
   * 移除工具
   */
  removeTool(name: string): boolean {
    const index = this.tools.findIndex(tool => tool.name === name);
    if (index !== -1) {
      this.tools.splice(index, 1);
      delete this.toolMap[name];
      return true;
    }
    return false;
  }

  /**
   * 清空所有工具
   */
  clear(): void {
    this.tools = [];
    this.toolMap = {};
  }

  /**
   * 获取工具数量
   */
  size(): number {
    return this.tools.length;
  }

  /**
   * 检查是否包含指定工具
   */
  hasTool(name: string): boolean {
    return name in this.toolMap;
  }

  /**
   * 清理所有工具资源
   */
  async cleanup(): Promise<void> {
    const cleanupPromises = this.tools.filter(tool => tool.cleanup).map(tool => tool.cleanup!());
    await Promise.allSettled(cleanupPromises);
    await this.mcpUni?.close();
  }

  private async refreshMcpTools(): Promise<void> {
    const mcpTools = await this.mcpUni!.listTools();
    const tools: BaseTool[] = mcpTools.tools
      .map(tool => {
        const internalName = `${tool.name}`;

        if (internalName.length > 64) {
          console.warn(`Tool name length exceeds the limit of 64 characters, this tool will be ignored: ${internalName}`);
          return null;
        }
        const item: BaseTool = {
          name: internalName,
          description: tool.description || '',
          toOpenAITool: () => {
            return {
              type: 'function',
              function: {
                name: internalName,
                description: tool.description || '',
                parameters: tool.inputSchema || {},
              },
            };
          },
          execute: async input => {
            const result = await this.mcpUni!.callTool({ name: tool.name, arguments: input });
            return result as ToolResult;
          },
        };
        return item;
      })
      .filter(tool => tool !== null);

    // 添加工具到集合
    for (const tool of tools) {
      this.addTool(tool);
    }
  }
}
