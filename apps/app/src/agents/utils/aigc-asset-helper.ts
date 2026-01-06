import { ToolContext } from '@/agents/tools/context';
import { createAssetsFromExistingFiles } from './asset-helper';
import { getFileExtension } from '@/lib/shared/file-type';
import type { AssetType } from '@/lib/server/asset-manager';

/**
 * 为 AIGC 工具生成的结果文件创建 Assets 记录
 *
 * @param context 工具上下文
 * @param results PaintboardTaskResult 格式的结果数组
 * @param options 选项
 * @returns 创建的 Assets 记录数组，如果失败则返回空数组
 */
export async function createAssetsFromAigcResults(
  context: ToolContext,
  results: Array<{ key: string; bucket?: string }>,
  options: {
    defaultType: AssetType;
    titlePrefix?: string;
    description?: string;
    toolArgs?: Record<string, any>; // 工具参数，用于生成描述
  },
): Promise<Array<{ id: string; fileKey: string; fileUrl: string; type: string }>> {
  if (!context.organizationId || !context.sessionId) {
    console.warn('Organization ID or Session ID missing, skipping Assets creation');
    return [];
  }

  if (!results || results.length === 0) {
    return [];
  }

  try {
    const assets = await createAssetsFromExistingFiles({
      context,
      files: results.map((r, index) => {
        const fileName = r.key.split('/').pop() || `generated-${index}.bin`;
        const ext = getFileExtension(fileName)?.replace(/^\./, '') || '';

        // 根据扩展名推断 MIME 类型和素材类型
        let mimeType = 'application/octet-stream';
        let assetType: AssetType = options.defaultType;

        // 图片
        if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
          mimeType =
            ext === 'png'
              ? 'image/png'
              : ext === 'jpg' || ext === 'jpeg'
                ? 'image/jpeg'
                : ext === 'gif'
                  ? 'image/gif'
                  : ext === 'webp'
                    ? 'image/webp'
                    : 'image/svg+xml';
          assetType = 'image';
        }
        // 视频
        else if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
          mimeType = ext === 'mp4' ? 'video/mp4' : ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : 'video/*';
          assetType = 'video';
        }
        // 音频
        else if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext)) {
          mimeType = ext === 'mp3' ? 'audio/mpeg' : ext === 'wav' ? 'audio/wav' : ext === 'ogg' ? 'audio/ogg' : 'audio/*';
          assetType = 'audio';
        }
        // 其他使用默认类型
        else {
          assetType = options.defaultType;
        }

        const title = options.titlePrefix ? `${options.titlePrefix} - ${fileName}` : fileName;

        // 生成描述
        let description = options.description;
        if (!description && options.toolArgs) {
          const prompt = options.toolArgs.prompt || options.toolArgs.text || options.toolArgs.lyrics;
          if (prompt) {
            description = `通过 AIGC 生成：${typeof prompt === 'string' ? prompt.substring(0, 200) : JSON.stringify(prompt)}`;
          }
        }

        return {
          fileKey: r.key,
          fileName,
          mimeType,
          type: assetType,
          title,
          description,
        };
      }),
    });

    return assets.map(a => ({
      id: a.id,
      fileKey: a.fileKey,
      fileUrl: a.fileUrl,
      type: a.type,
    }));
  } catch (error) {
    console.error('Failed to create Assets records from AIGC results:', error);
    return [];
  }
}
