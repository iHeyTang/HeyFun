import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { getSandboxRuntimeManager } from '@/lib/server/sandbox';
import { updateSandboxHandleLastUsed } from '@/lib/server/sandbox/handle';
import { ensureSandbox, saveSandboxHandleToState } from '../utils';
import { sandboxWriteFileParamsSchema } from './schema';

export const sandboxWriteFileExecutor = definitionToolExecutor(sandboxWriteFileParamsSchema, async (args, context) => {
  try {
      if (!context.sessionId) {
        return {
          success: false,
          error: 'Session ID is required',
        };
      }

      const { path, content } = args;

      // 确保 sandbox 存在，如果不存在则自动创建
      const handle = await ensureSandbox(context.sessionId);

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
