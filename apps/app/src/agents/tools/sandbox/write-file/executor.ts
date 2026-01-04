import { ToolContext } from '../../context';
import { sandboxWriteFileParamsSchema } from './schema';
import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { getSandboxRuntimeManager } from '@/lib/server/sandbox';
import { updateSandboxHandleLastUsed } from '@/lib/server/sandbox/handle';
import { getSandboxHandleFromState, saveSandboxHandleToState } from '../utils';

export const sandboxWriteFileExecutor = definitionToolExecutor(sandboxWriteFileParamsSchema, async (args, context) => {
  return await context.workflow.run(`toolcall-${context.toolCallId || 'sandbox-write-file'}`, async () => {
    try {
      if (!context.sessionId) {
        return {
          success: false,
          error: 'Session ID is required',
        };
      }

      const { path, content } = args;

      // 获取当前会话的 sandbox handle（框架自动管理，Agent 无需关心 sandbox_id）
      const handle = await getSandboxHandleFromState(context.sessionId);
      if (!handle) {
        return {
          success: false,
          error: 'No sandbox found for this session. Please use sandbox.get to get or create a sandbox first.',
        };
      }

      // 写入文件（底层框架会自动恢复依赖）
      const srm = getSandboxRuntimeManager();
      const instance = await srm.get(handle);
      await srm.writeFile(handle, path, content);

      // 更新 handle 的最后使用时间并保存
      const updatedHandle = updateSandboxHandleLastUsed(instance.handle);
      await saveSandboxHandleToState(context.sessionId, updatedHandle);

      return {
        success: true,
        data: {
          path,
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
