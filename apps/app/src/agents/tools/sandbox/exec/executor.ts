import { ToolContext } from '../../context';
import { sandboxExecParamsSchema } from './schema';
import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { getSandboxRuntimeManager } from '@/lib/server/sandbox';
import { updateSandboxHandleLastUsed } from '@/lib/server/sandbox/handle';
import { getSandboxHandleFromState, saveSandboxHandleToState } from '../utils';

export const sandboxExecExecutor = definitionToolExecutor(sandboxExecParamsSchema, async (args, context) => {
  return await context.workflow.run(`toolcall-${context.toolCallId || 'sandbox-exec'}`, async () => {
    try {
      if (!context.sessionId) {
        return {
          success: false,
          error: 'Session ID is required',
        };
      }

      const { command, env, timeout } = args;

      // 获取当前会话的 sandbox handle（框架自动管理，Agent 无需关心 sandbox_id）
      const handle = await getSandboxHandleFromState(context.sessionId);
      if (!handle) {
        return {
          success: false,
          error: 'No sandbox found for this session. Please use sandbox.get to get or create a sandbox first.',
        };
      }

      // 获取实例（底层框架会自动恢复依赖，无需手动处理）
      const srm = getSandboxRuntimeManager();
      const instance = await srm.get(handle);

      // 执行命令（依赖恢复已在 get() 中自动完成）
      const result = await srm.exec(handle, command, { env, timeout });

      // 更新 handle 的最后使用时间并保存
      // 注意：依赖恢复已在 get() 中自动完成，这里只需要更新时间
      const updatedHandle = updateSandboxHandleLastUsed(instance.handle);
      await saveSandboxHandleToState(context.sessionId, updatedHandle);

      return {
        success: true,
        data: {
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
});
