import { ToolContext } from '../../context';
import { browserExtractContentParamsSchema } from './schema';
import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { getBrowserRuntimeManager } from '@/lib/server/browser';
import { updateBrowserHandleLastUsed } from '@/lib/server/browser/handle';
import { ensureBrowser, saveBrowserHandleToState } from '../utils';

export const browserExtractContentExecutor = definitionToolExecutor(
  browserExtractContentParamsSchema,
  async (args, context) => {
    return await context.workflow.run(`toolcall-${context.toolCallId || 'browser-extract-content'}`, async () => {
      try {
        if (!context.sessionId) {
          return {
            success: false,
            error: 'Session ID is required',
          };
        }

        const { selector, extractType = 'text' } = args;

        const handle = await ensureBrowser(context.sessionId);
        const brm = getBrowserRuntimeManager();

        const result = await brm.extractContent(handle, {
          selector,
          extractType,
          sessionId: context.sessionId,
          organizationId: context.organizationId,
        });

        if (!result.success) {
          return {
            success: false,
            error: result.error || 'Extract content failed',
          };
        }

        const updatedHandle = updateBrowserHandleLastUsed(handle);
        await saveBrowserHandleToState(context.sessionId, updatedHandle);

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
  },
);

