import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { getSandboxRuntimeManager } from '@/lib/server/sandbox';
import { updateSandboxHandleLastUsed } from '@/lib/server/sandbox/handle';
import { getSandboxHandleFromState, saveSandboxHandleToState } from '../utils';
import { sandboxGetParamsSchema } from './schema';

export const sandboxGetExecutor = definitionToolExecutor(sandboxGetParamsSchema, async (args, context) => {
  try {
    if (!context.sessionId) {
      return {
        success: false,
        error: 'Session ID is required',
      };
    }

    const { workspaceRoot, costProfile } = args;

    // 检查是否已有 sandbox，如果存在且状态正常，直接复用（框架内部逻辑）
    const existingHandle = await getSandboxHandleFromState(context.sessionId);
    if (existingHandle && existingHandle.status !== 'expired') {
      // 更新最后使用时间并保存
      const updatedHandle = updateSandboxHandleLastUsed(existingHandle);
      await saveSandboxHandleToState(context.sessionId, updatedHandle);

      return {
        success: true,
        data: {
          provider: updatedHandle.provider,
          workspaceRoot: updatedHandle.workspaceRoot,
          status: updatedHandle.status,
        },
      };
    }

    // 不存在或已过期，创建新的 sandbox（框架内部逻辑）
    const srm = getSandboxRuntimeManager();
    const handle = await srm.create({ workspaceRoot, costProfile, idleTimeout: 300 });

    // 保存到 state
    await saveSandboxHandleToState(context.sessionId, handle);

    return {
      success: true,
      data: {
        provider: handle.provider,
        workspaceRoot: handle.workspaceRoot,
        status: handle.status,
      },
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});
