import { ToolContext } from '../../context';
import { sandboxReadFileParamsSchema } from './schema';
import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { getSandboxRuntimeManager } from '@/lib/server/sandbox';
import { updateSandboxHandleLastUsed } from '@/lib/server/sandbox/handle';
import { ensureSandbox, saveSandboxHandleToState } from '../utils';

export const sandboxReadFileExecutor = definitionToolExecutor(sandboxReadFileParamsSchema, async (args, context) => {
  return await context.workflow.run(`toolcall-${context.toolCallId || 'sandbox-read-file'}`, async () => {
    try {
      if (!context.sessionId) {
        return {
          success: false,
          error: 'Session ID is required',
        };
      }

      const { path } = args;

      // 确保 sandbox 存在，如果不存在则自动创建
      const handle = await ensureSandbox(context.sessionId);

      // 读取文件（底层框架会自动恢复依赖）
      const srm = getSandboxRuntimeManager();
      const instance = await srm.get(handle);
      const content = await srm.readFile(handle, path);

      // 更新 handle 的最后使用时间并保存
      const updatedHandle = updateSandboxHandleLastUsed(instance.handle);
      await saveSandboxHandleToState(context.sessionId, updatedHandle);

      return {
        success: true,
        data: {
          content,
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
