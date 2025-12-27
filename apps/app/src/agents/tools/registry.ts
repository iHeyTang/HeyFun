/**
 * 统一工具注册表
 * 所有工具都在这里注册
 */

import { BaseToolbox, ToolExecutor } from '@/agents/core/tools/base-tool-registry';
import { ToolContext } from './context';

/**
 * 工具类型定义
 */
export type Tool = {
  schema: import('@/agents/core/tools/tool-definition').ToolDefinition;
  executor: ToolExecutor<ToolContext>;
};

/**
 * 工具注册表
 */
export class ToolRegistry extends BaseToolbox<ToolExecutor<ToolContext>, ToolContext> {
  protected registryName = 'ToolRegistry';
  protected toolTypeName = 'Tool';

  /**
   * 注册工具
   */
  registerTool(tool: Tool): void {
    this.register(tool.schema.name, tool.executor);
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
   * 获取所有工具定义
   */
  getAllToolSchemas(): import('@/agents/core/tools/tool-definition').ToolDefinition[] {
    const schemas: import('@/agents/core/tools/tool-definition').ToolDefinition[] = [];
    for (const toolName of this.getAllToolNames()) {
      // 这里需要从工具模块中获取schema，暂时返回空数组
      // 实际使用时，应该从工具模块中获取
    }
    return schemas;
  }
}
