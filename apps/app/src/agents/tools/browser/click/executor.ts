import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { getBrowserRuntimeManager } from '@/lib/server/browser';
import { updateBrowserHandleLastUsed } from '@/lib/server/browser/handle';
import { ensureBrowser, saveBrowserHandleToState } from '../utils';
import { browserClickParamsSchema } from './schema';

export const browserClickExecutor = definitionToolExecutor(browserClickParamsSchema, async (args, context) => {
  try {
    if (!context.sessionId) {
      return {
        success: false,
        error: 'Session ID is required',
      };
    }

    const { selector, timeout = 10000 } = args;

    const handle = await ensureBrowser(context.sessionId);
    const brm = getBrowserRuntimeManager();

    const result = await brm.click(handle, selector, {
      timeout,
      sessionId: context.sessionId,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Click failed',
      };
    }

    const updatedHandle = updateBrowserHandleLastUsed(handle);
    await saveBrowserHandleToState(context.sessionId, updatedHandle);

    // 保存浏览器状态
    await brm.saveState(handle);

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});
