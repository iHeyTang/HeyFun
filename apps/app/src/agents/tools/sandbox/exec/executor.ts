import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { getSandboxRuntimeManager } from '@/lib/server/sandbox';
import { updateSandboxHandleLastUsed } from '@/lib/server/sandbox/handle';
import { ensureSandbox, saveSandboxHandleToState } from '../utils';
import { sandboxExecParamsSchema } from './schema';

export const sandboxExecExecutor = definitionToolExecutor(sandboxExecParamsSchema, async (args, context) => {
  try {
    if (!context.sessionId) {
      return {
        success: false,
        error: 'Session ID is required',
      };
    }

    const { command, env, timeout } = args;

    // 确保 sandbox 存在，如果不存在则自动创建
    const handle = await ensureSandbox(context.sessionId);

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
