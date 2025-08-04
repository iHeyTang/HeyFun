import type { Chat } from '@repo/llm';
import type { BaseTool, ToolResult } from '@/tools/types';
import McpHost from './mcp';

/**
 * 工具集合实现类
 */
export class ToolCollection {
  public tools: BaseTool[] = [];
  public toolMap: Record<string, BaseTool> = {};

  private mcp: McpHost = new McpHost();

  constructor(...initialTools: BaseTool[]) {
    for (const tool of initialTools) {
      this.addTool(tool);
    }
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

  async addMcp(config: {
    client_id: string;
    url?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    headers?: Record<string, any>;
  }): Promise<void> {
    if (config.url) {
      await this.mcp.addSseMcp({
        id: config.client_id,
        url: config.url,
        headers: config.headers || {},
      });
    } else if (config.command) {
      await this.mcp.addStdioMcp({
        id: config.client_id,
        command: config.command,
        args: config.args || [],
        env: config.env || {},
      });
    }
    await this.addMcpTools(config.client_id);
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
    await this.mcp.cleanup();
  }

  /**
   * 添加MCP工具
   */
  private async addMcpTools(client_id: string): Promise<void> {
    const client = this.mcp.getClient(client_id);
    if (!client) {
      throw new Error(`Client ${client_id} not found`);
    }
    const mcpTools = await client.listTools();
    const tools: BaseTool[] = mcpTools.tools
      .map(tool => {
        const internalName = `${client_id}-${tool.name}`;

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
            const result = await this.mcp.getClient(client_id)!.callTool({ name: tool.name, arguments: input });
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
