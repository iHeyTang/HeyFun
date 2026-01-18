import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { getBrowserRuntimeManager } from '@/lib/server/browser';
import { updateBrowserHandleLastUsed, updateBrowserHandleUrl } from '@/lib/server/browser/handle';
import { ensureBrowser, saveBrowserHandleToState } from '../utils';
import { browserNavigateParamsSchema } from './schema';

export const browserNavigateExecutor = definitionToolExecutor(browserNavigateParamsSchema, async (args, context) => {
  try {
    if (!context.sessionId) {
      return {
        success: false,
        error: 'Session ID is required',
      };
    }

    const { url, waitUntil = 'load', timeout = 30000 } = args;

    // 确保 browser 存在
    const handle = await ensureBrowser(context.sessionId);
    const brm = getBrowserRuntimeManager();

    // 执行导航操作
    const result = await brm.navigate(handle, url, {
      waitUntil,
      timeout,
      sessionId: context.sessionId,
      organizationId: context.organizationId,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Navigation failed',
      };
    }

    // 更新 handle：保存导航后的 URL 和最后使用时间
    // 注意：由于是跨 workflow 执行，必须确保 URL 同步到 Redis
    let updatedHandle = handle;
    if (result.data?.currentUrl) {
      updatedHandle = updateBrowserHandleUrl(handle, result.data.currentUrl);
    }
    updatedHandle = updateBrowserHandleLastUsed(updatedHandle);
    await saveBrowserHandleToState(context.sessionId, updatedHandle);

    // 保存浏览器状态（cookies、localStorage 等）
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
