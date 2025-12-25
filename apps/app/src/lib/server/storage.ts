import { Disk } from 'flydrive';
import { S3Driver } from 'flydrive/drivers/s3';
import { S3DriverOptions } from 'flydrive/drivers/s3/types';
import { getFileExtension, identifyFileTypeFromBuffer } from '../shared/file-type';
import { resolveUrl } from '../shared/url';

// Cloudflare R2配置
const ossConfig: S3DriverOptions = {
  endpoint: process.env.S3_ENDPOINT!,
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  bucket: process.env.S3_BUCKET!,
  visibility: 'private',
};

// 创建存储管理器
const storage = new Disk(new S3Driver(ossConfig));

export default storage;

export const getBucket = () => {
  return ossConfig.bucket;
};

/**
 * 从 OSS URL 或路径中提取 fileKey
 * 支持以下格式：
 * - `oss://fileKey` -> `fileKey`
 * - `/api/oss/fileKey` -> `fileKey`
 * - `fileKey` -> `fileKey`（直接返回）
 *
 * @param ossUrl - OSS URL 或路径
 * @returns 提取的 fileKey
 */
export const extractOssFileKey = (ossUrl: string): string => {
  // oss:// 格式
  if (ossUrl.startsWith('oss://')) {
    return ossUrl.replace('oss://', '');
  }

  // /api/oss/ 格式（兼容旧格式）
  if (ossUrl.startsWith('/api/oss/')) {
    return ossUrl.replace('/api/oss/', '');
  }

  // 直接返回（已经是 fileKey）
  return ossUrl;
};

/**
 * 验证文件访问权限
 * 确保文件是系统文件（system/）或属于指定组织的文件（organizationId/）
 *
 * @param fileKey - OSS 文件 key
 * @param organizationId - 组织 ID
 * @throws 如果文件不在允许访问的范围内，会抛出错误
 */
export const validateOssFileAccess = (fileKey: string, organizationId: string): void => {
  const isSystemFile = fileKey.startsWith('system/');
  const isOrgFile = fileKey.startsWith(`${organizationId}/`);

  if (!isSystemFile && !isOrgFile) {
    throw new Error(`Access denied: Cannot access file ${fileKey}`);
  }
};

/**
 * 从 OSS URL 提取 fileKey 并验证访问权限
 *
 * @param ossUrl - OSS URL，支持 `oss://fileKey` 或 `/api/oss/fileKey` 格式
 * @param organizationId - 组织 ID，用于权限验证
 * @returns 提取并验证后的 fileKey
 * @throws 如果文件不在允许访问的范围内，会抛出错误
 */
export const resolveOssFileKey = (ossUrl: string, organizationId: string): string => {
  const fileKey = extractOssFileKey(ossUrl);
  validateOssFileAccess(fileKey, organizationId);
  return fileKey;
};

/**
 * 下载文件
 *
 * @param url - 文件 URL，支持以下格式：
 *   - 绝对 URL：`https://example.com/file.jpg` 或 `http://example.com/file.jpg`
 *   - 相对路径：`/api/oss/file.jpg` 或 `/public/image.png`（会自动添加 base URL）
 *   - 其他路径：`file.jpg`（会尝试添加 base URL）
 *
 * @returns 返回文件信息，包含 buffer、mimeType 和 extension
 * @throws 如果下载失败或响应不是有效的文件类型，会抛出错误
 *
 * @example
 * ```ts
 * // 绝对 URL
 * const { buffer, mimeType } = await downloadFile('https://example.com/image.jpg');
 *
 * // 相对路径（会自动转换为完整 URL）
 * const { buffer, mimeType } = await downloadFile('/api/oss/user123/image.jpg');
 * ```
 */
export const downloadFile = async (url: string) => {
  // 如果是相对路径，转换为绝对 URL
  const fullUrl = resolveUrl(url);
  const response = await fetch(fullUrl);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }
  // 检查响应的Content-Type，确保不是错误响应
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json') || contentType.includes('text/html') || contentType.includes('text/plain')) {
    const text = await response.text();
    throw new Error(`Download failed, received ${contentType} response: ${text.substring(0, 200)}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  // 识别文件类型 - 优先使用HTTP响应的Content-Type
  let mimeType = contentType.split(';')[0]; // 移除charset等参数
  if (!mimeType || mimeType === 'application/octet-stream') {
    mimeType = identifyFileTypeFromBuffer(buffer);
  }
  const extension = getFileExtension(mimeType);
  return { buffer, mimeType, extension };
};
