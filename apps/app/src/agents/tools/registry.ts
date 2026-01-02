/**
 * 统一工具注册表
 * 所有工具都在这里注册
 */

import { BaseToolbox, ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { ToolContext } from './context';
import { ToolDefinition } from '@/agents/core/tools/tool-definition';

/**
 * 工具类型定义
 */
export type Tool = {
  schema: ToolDefinition;
  executor: ToolExecutor;
};

/**
 * 工具注册表
 */
export class ToolRegistry extends BaseToolbox {
  protected registryName = 'ToolRegistry';
  protected toolTypeName = 'Tool';

  // 存储所有工具定义（用于检索）
  private toolDefinitions = new Map<string, ToolDefinition>();

  /**
   * 注册工具
   */
  registerTool(tool: Tool): void {
    // 注册执行器到工具注册表
    this.register(tool.schema.name, tool.executor);
    // 存储工具定义（用于检索）
    this.toolDefinitions.set(tool.schema.name, tool.schema);
  }

  /**
   * 批量注册工具
   */
  registerTools(tools: Tool[]): void {
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  /**
   * 获取工具定义
   */
  getToolDefinition(toolName: string): ToolDefinition | undefined {
    return this.toolDefinitions.get(toolName);
  }

  /**
   * 获取所有工具定义
   */
  getAllToolSchemas(): ToolDefinition[] {
    return Array.from(this.toolDefinitions.values());
  }

  /**
   * 获取所有工具的简要信息（用于 LLM 检索）
   */
  getAllToolSummaries(): Array<{ name: string; description: string; category?: string }> {
    return this.getAllToolSchemas().map(schema => ({
      name: schema.name,
      description: schema.description,
      category: schema.category,
    }));
  }
}
