/**
 * 工具执行器辅助函数
 * 提供统一的参数校验和类型安全
 */

import { z } from 'zod';
import { ToolResult } from './tool-definition';
import { ToolExecutor } from './base-tool-registry';
import { ToolContext } from '@/agents/tools/context';

/**
 * 创建类型安全的工具执行器
 *
 * @param paramsSchema - Zod schema，用于参数校验和类型推断
 * @param executor - 实际的执行函数，接收已校验的参数和上下文
 * @returns 符合 ToolExecutor 类型的函数
 *
 * @example
 * ```typescript
 * export const waitExecutor = definitionToolExecutor(
 *   waitParamsSchema,
 *   async (args, context) => {
 *     // args 已经是类型安全的 WaitParams
 *     const { seconds, milliseconds } = args;
 *     // ... 执行逻辑
 *   }
 * );
 * ```
 */
export function definitionToolExecutor<Args extends z.ZodTypeAny>(
  paramsSchema: Args,
  executor: (args: z.infer<Args>, context: ToolContext) => Promise<ToolResult>,
): ToolExecutor {
  return async (args: any, context: any): Promise<ToolResult> => {
    // 使用 Zod schema 进行参数校验
    const parseResult = paramsSchema.safeParse(args);
    if (!parseResult.success) {
      return {
        success: false,
        error: `Invalid parameters: ${parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
      };
    }

    // 调用实际的执行函数，传入已校验的参数
    return await executor(parseResult.data, context);
  };
}
