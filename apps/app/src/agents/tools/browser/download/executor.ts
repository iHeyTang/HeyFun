import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { getSandboxHandleFromState } from '@/agents/tools/sandbox/utils';
import { createAssetFromTool } from '@/agents/utils/asset-helper';
import { getBrowserRuntimeManager } from '@/lib/server/browser';
import { updateBrowserHandleLastUsed } from '@/lib/server/browser/handle';
import { getSandboxRuntimeManager } from '@/lib/server/sandbox';
import { ensureBrowser, saveBrowserHandleToState } from '../utils';
import { browserDownloadParamsSchema } from './schema';

export const browserDownloadExecutor = definitionToolExecutor(browserDownloadParamsSchema, async (args, context) => {
  try {
      if (!context.sessionId) {
        return {
          success: false,
          error: 'Session ID is required',
        };
      }

      const { url, timeout = 60000, saveToAssets = false } = args;

      const handle = await ensureBrowser(context.sessionId);
      const brm = getBrowserRuntimeManager();

      const result = await brm.download(handle, url, {
        timeout,
        sessionId: context.sessionId,
        organizationId: context.organizationId,
        keepFile: saveToAssets, // 如果需要保存到资源库，保留文件路径
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Download failed',
        };
      }

      const data = result.data || {};

      // 如果需要保存到项目资源
      if (saveToAssets && data.downloadFile && context.organizationId && context.sessionId) {
        try {
          // 从 sandbox 中读取文件内容
          const sandboxHandle = await getSandboxHandleFromState(context.sessionId);
          if (sandboxHandle) {
            const srm = getSandboxRuntimeManager();
            const fileContentBase64 = await srm.readFile(sandboxHandle, data.downloadFile);
            const fileBuffer = Buffer.from(fileContentBase64, 'base64');

            // 从文件名推断 MIME 类型
            const fileName = data.fileName || 'download';
            const ext = fileName.split('.').pop()?.toLowerCase() || '';
            const mimeTypes: Record<string, string> = {
              pdf: 'application/pdf',
              zip: 'application/zip',
              txt: 'text/plain',
              json: 'application/json',
              xml: 'application/xml',
              html: 'text/html',
              css: 'text/css',
              js: 'application/javascript',
              png: 'image/png',
              jpg: 'image/jpeg',
              jpeg: 'image/jpeg',
              gif: 'image/gif',
              svg: 'image/svg+xml',
              mp4: 'video/mp4',
              mp3: 'audio/mpeg',
              doc: 'application/msword',
              docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              xls: 'application/vnd.ms-excel',
              xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              ppt: 'application/vnd.ms-powerpoint',
              pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            };
            const mimeType = mimeTypes[ext] || 'application/octet-stream';

            // 创建资源
            const asset = await createAssetFromTool({
              context,
              fileContent: fileBuffer,
              fileName,
              mimeType,
              title: `下载的文件: ${fileName}`,
              description: `从 ${url} 下载的文件`,
              metadata: {
                sourceUrl: url,
                downloadTime: new Date().toISOString(),
              },
            });

            data.assetId = asset.id;
            data.assetUrl = asset.fileUrl;
          }
        } catch (error) {
          console.error('[BrowserDownload] Failed to save to assets:', error);
          // 不阻止返回结果，但记录错误
          data.assetError = error instanceof Error ? error.message : String(error);
        }
      }

      const updatedHandle = updateBrowserHandleLastUsed(handle);
      await saveBrowserHandleToState(context.sessionId, updatedHandle);

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
);
