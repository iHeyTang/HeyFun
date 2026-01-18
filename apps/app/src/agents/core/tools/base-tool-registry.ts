/**
 * 工具注册表基类
 * 提供通用的工具注册和执行功能
 */

import { ToolContext } from '@/agents/tools/context';
import { z } from 'zod';
import { ToolResult } from './tool-definition';

/**
 * 工具执行器类型
 */
export type ToolExecutor<Args extends z.ZodTypeAny = any> = (args: z.infer<Args>, context: ToolContext) => Promise<ToolResult>;

/**
 * 工具注册表基类
 */
export abstract class BaseToolbox {
  protected executors = new Map<string, ToolExecutor>();
  protected abstract registryName: string;
  protected abstract toolTypeName: string;

  /**
   * 注册工具执行器
   * @param toolName 工具名称（必须与工具定义中的名称一致）
   * @param executor 工具执行函数
   */
  register(toolName: string, executor: ToolExecutor): void {
    if (this.executors.has(toolName)) {
      console.warn(`[${this.registryName}] Tool "${toolName}" is already registered, overwriting...`);
    }
    this.executors.set(toolName, executor);
  }

  /**
   * 批量注册工具执行器
   */
  registerMany(registrations: Array<{ toolName: string; executor: ToolExecutor }>): void {
    for (const { toolName, executor } of registrations) {
      this.register(toolName, executor);
    }
  }

  /**
   * 检查工具是否已注册
   */
  has(toolName: string): boolean {
    return this.executors.has(toolName);
  }

  /**
   * 获取工具执行器
   */
  get(toolName: string): ToolExecutor | undefined {
    return this.executors.get(toolName);
  }

  /**
   * 解析工具调用的 arguments
   * @param toolName 工具名称（用于错误信息）
   * @param argumentsStrOrObj 工具参数（字符串或对象）
   * @returns 解析后的参数对象，如果解析失败则返回错误结果
   */
  private parseToolArguments(toolName: string, argumentsStrOrObj: string | object): { success: true; args: any } | { success: false; error: string } {
    if (typeof argumentsStrOrObj === 'object' && argumentsStrOrObj !== null) {
      return { success: true, args: argumentsStrOrObj };
    }

    if (typeof argumentsStrOrObj === 'string') {
      try {
        const args = JSON.parse(argumentsStrOrObj);
        return { success: true, args };
      } catch (parseError) {
        const errorMessage = (parseError as Error).message;
        return {
          success: false,
          error: `Invalid JSON arguments for ${toolName}: ${errorMessage}`,
        };
      }
    }

    return {
      success: false,
      error: `Invalid arguments type for ${toolName}: ${typeof argumentsStrOrObj}`,
    };
  }

  /**
   * 执行工具
   * 通过 ToolCall 格式调用（自动解析 arguments）
   */
  async execute(toolCall: { function: { name: string; arguments: string | object } }, context: ToolContext): Promise<ToolResult> {
    const toolName = toolCall.function.name;

    // 解析 arguments
    const parseResult = this.parseToolArguments(toolName, toolCall.function.arguments);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error,
      };
    }

    const args = parseResult.args;

    const executor = this.executors.get(toolName);
    if (!executor) {
      return {
        success: false,
        error: `${this.toolTypeName} tool "${toolName}" is not registered. Available tools: ${Array.from(this.executors.keys()).join(', ')}`,
      };
    }

    return await executor(args, context);
  }

  /**
   * 批量执行工具调用（顺序执行）
   */
  async executeMany(toolCalls: Array<{ function: { name: string; arguments: string | object } }>, context: ToolContext): Promise<ToolResult[]> {
    console.log(`[${this.registryName}] Executing ${toolCalls.length} tool call(s) sequentially...`);
    const results: ToolResult[] = [];

    for (let index = 0; index < toolCalls.length; index++) {
      const tc = toolCalls[index];
      if (!tc) {
        console.warn(`[${this.registryName}] Tool call at index ${index} is undefined, skipping`);
        continue;
      }

      console.log(`[${this.registryName}] [${index + 1}/${toolCalls.length}] Executing: ${tc.function.name}`);
      const result = await this.execute(tc, context);
      console.log(`[${this.registryName}] [${index + 1}/${toolCalls.length}] Result for ${tc.function.name}:`, {
        success: result.success,
        hasData: !!result.data,
        error: result.error,
      });
      results.push(result);
    }

    console.log(`[${this.registryName}] All ${toolCalls.length} tool(s) executed sequentially.`);
    return results;
  }

  /**
   * 获取所有已注册的工具名称
   */
  getAllToolNames(): string[] {
    return Array.from(this.executors.keys());
  }
}
