/**
 * 工具注册表基类
 * 提供通用的工具注册和执行功能
 */

import { ToolResult } from './tool-definition';

/**
 * 工具执行器类型
 */
export type ToolExecutor<TContext = any> = (args: any, context: TContext) => Promise<ToolResult>;

/**
 * 工具注册表基类
 */
export abstract class BaseToolbox<TExecutor extends ToolExecutor<TContext>, TContext = any> {
  protected executors = new Map<string, TExecutor>();
  protected abstract registryName: string;
  protected abstract toolTypeName: string;

  /**
   * 注册工具执行器
   * @param toolName 工具名称（必须与工具定义中的名称一致）
   * @param executor 工具执行函数
   */
  register(toolName: string, executor: TExecutor): void {
    if (this.executors.has(toolName)) {
      console.warn(`[${this.registryName}] Tool "${toolName}" is already registered, overwriting...`);
    }
    this.executors.set(toolName, executor);
  }

  /**
   * 批量注册工具执行器
   */
  registerMany(registrations: Array<{ toolName: string; executor: TExecutor }>): void {
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
  get(toolName: string): TExecutor | undefined {
    return this.executors.get(toolName);
  }

  /**
   * 执行工具
   * 支持两种调用方式：
   * 1. execute(toolName, args, context) - 直接调用
   * 2. execute(toolCall, context) - 通过 ToolCall 格式调用（自动解析 arguments）
   */
  async execute(
    toolNameOrCall: string | { function: { name: string; arguments: string | object } },
    argsOrContext: any,
    context?: TContext,
  ): Promise<ToolResult> {
    let toolName: string;
    let args: any;
    let execContext: TContext;

    // 判断是 ToolCall 格式还是直接调用格式
    if (typeof toolNameOrCall === 'string') {
      // 直接调用格式：execute(toolName, args, context)
      toolName = toolNameOrCall;
      args = argsOrContext;
      execContext = context!;
    } else {
      // ToolCall 格式：execute(toolCall, context)
      const toolCall = toolNameOrCall;
      toolName = toolCall.function.name;
      execContext = argsOrContext as TContext;

      // 解析 arguments
      const argsStr = toolCall.function.arguments;
      if (typeof argsStr === 'object' && argsStr !== null) {
        args = argsStr;
      } else if (typeof argsStr === 'string') {
        try {
          args = JSON.parse(argsStr);
        } catch (parseError) {
          return {
            success: false,
            error: `Invalid JSON arguments for ${toolName}: ${(parseError as Error).message}`,
          };
        }
      } else {
        return {
          success: false,
          error: `Invalid arguments type for ${toolName}: ${typeof argsStr}`,
        };
      }
    }

    const executor = this.executors.get(toolName);
    if (!executor) {
      return {
        success: false,
        error: `${this.toolTypeName} tool "${toolName}" is not registered. Available tools: ${Array.from(this.executors.keys()).join(', ')}`,
      };
    }

    try {
      return await executor(args, execContext);
    } catch (error) {
      return {
        success: false,
        error: `Failed to execute ${this.toolTypeName.toLowerCase()} tool "${toolName}": ${(error as Error).message}`,
      };
    }
  }

  /**
   * 批量执行工具调用（顺序执行）
   */
  async executeMany(toolCalls: Array<{ function: { name: string; arguments: string | object } }>, context: TContext): Promise<ToolResult[]> {
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
