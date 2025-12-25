import storage, { downloadFile, resolveOssFileKey } from './storage';
import { identifyFileTypeFromBuffer } from '../shared/file-type';

/**
 * 将图片URL转换为base64数据
 * 某些LLM提供商（如Vercel AI SDK）不支持文件URL，只支持base64数据
 */
export async function convertImageUrlToBase64(imageUrl: string, organizationId: string): Promise<string> {
  // 如果已经是base64数据URL，直接返回
  if (imageUrl.startsWith('data:image')) {
    return imageUrl;
  }

  // 如果是OSS key格式（oss://fileKey）或旧格式（/api/oss/xxx），直接从存储中读取
  if (imageUrl.startsWith('oss://') || imageUrl.startsWith('/api/oss/')) {
    // 提取 fileKey 并验证访问权限
    const fileKey = resolveOssFileKey(imageUrl, organizationId);

    // 从OSS直接读取文件
    const fileData = await storage.getBytes(fileKey);
    if (!fileData) {
      throw new Error(`File not found: ${fileKey}`);
    }

    // 识别文件类型
    const buffer = Buffer.from(fileData);
    const mimeType = identifyFileTypeFromBuffer(buffer) || 'image/png';

    // 转换为base64
    const base64 = buffer.toString('base64');
    return `data:${mimeType};base64,${base64}`;
  }

  // 对于其他URL，通过HTTP请求下载
  // downloadFile 函数会自动处理相对路径转换
  const { buffer, mimeType } = await downloadFile(imageUrl);

  // 检查是否为图片类型
  if (!mimeType.startsWith('image/')) {
    throw new Error(`Invalid image content type: ${mimeType}`);
  }

  // 转换为base64
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}
