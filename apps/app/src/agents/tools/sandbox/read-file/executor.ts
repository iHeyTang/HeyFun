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
      // 注意：readFile 返回 base64 编码的字符串，需要转换为 UTF-8（对于文本文件）
      const srm = getSandboxRuntimeManager();
      const instance = await srm.get(handle);
      const contentBase64 = await srm.readFile(handle, path);

      // 尝试将 base64 转换为 UTF-8 文本
      // 如果转换失败（二进制文件），则返回 base64 字符串
      let content: string;
      try {
        const buffer = Buffer.from(contentBase64, 'base64');
        // 尝试检测是否为文本文件（检查是否包含无效的 UTF-8 序列）
        content = buffer.toString('utf-8');
        // 如果转换后的内容包含替换字符（），可能是二进制文件
        if (content.includes('\ufffd')) {
          // 可能是二进制文件，返回 base64
          content = contentBase64;
        }
      } catch (e) {
        // 转换失败，返回 base64
        content = contentBase64;
      }

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
