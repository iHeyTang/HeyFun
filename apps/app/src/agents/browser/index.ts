import { ToolCall, ToolResult, ToolExecutionContext, ToolExecutor } from './types';
import { CANVAS_TOOL_EXECUTORS } from './executors/canvas';

/**
 * Agent 工具执行器
 * 使用统一的工具注册表自动分发和执行工具
 */
export class AgentToolExecutor implements ToolExecutor {
  async execute(toolCall: ToolCall, context: ToolExecutionContext): Promise<ToolResult> {
    const { name, arguments: argsStr } = toolCall.function;

    try {
      let args;

      // 检查 arguments 是否已经是对象
      if (typeof argsStr === 'object' && argsStr !== null) {
        args = argsStr;
      } else if (typeof argsStr === 'string') {
        try {
          args = JSON.parse(argsStr);
        } catch (parseError) {
          console.error(`[ToolExecutor] JSON parse error for ${name}:`, parseError);
          console.error(`[ToolExecutor] Arguments string:`, argsStr);
          return {
            success: false,
            error: `Invalid JSON arguments for ${name}: ${(parseError as Error).message}`,
          };
        }
      } else {
        return {
          success: false,
          error: `Invalid arguments type for ${name}: ${typeof argsStr}`,
        };
      }

      // 从统一的工具注册表中查找执行器
      const executor = CANVAS_TOOL_EXECUTORS[name];

      if (!executor) {
        return {
          success: false,
          error: `Unknown tool: ${name}. Available tools: ${Object.keys(CANVAS_TOOL_EXECUTORS).join(', ')}`,
        };
      }

      // 执行工具
      return await executor(args, context);
    } catch (error) {
      return {
        success: false,
        error: `Failed to execute ${name}: ${(error as Error).message}`,
      };
    }
  }

  async executeMany(toolCalls: ToolCall[], context: ToolExecutionContext): Promise<ToolResult[]> {
    console.log(`[AgentToolExecutor] Executing ${toolCalls.length} tool call(s) sequentially...`);
    const results: ToolResult[] = [];

    // 顺序执行工具，避免并发修改画布状态导致覆盖问题
    for (let index = 0; index < toolCalls.length; index++) {
      const tc = toolCalls[index];
      if (!tc) {
        console.warn(`[AgentToolExecutor] Tool call at index ${index} is undefined, skipping`);
        continue;
      }

      console.log(`[AgentToolExecutor] [${index + 1}/${toolCalls.length}] Executing: ${tc.function.name}`);
      const result = await this.execute(tc, context);
      console.log(`[AgentToolExecutor] [${index + 1}/${toolCalls.length}] Result for ${tc.function.name}:`, {
        success: result.success,
        hasData: !!result.data,
        error: result.error,
      });
      results.push(result);
    }

    console.log(`[AgentToolExecutor] All ${toolCalls.length} tool(s) executed sequentially.`);
    return results;
  }
}

export function createToolExecutor(): ToolExecutor {
  return new AgentToolExecutor();
}

export type { ToolCall, ToolResult, ToolExecutionContext, ToolExecutor } from './types';
