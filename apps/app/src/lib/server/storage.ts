import { Disk } from 'flydrive';
import { S3Driver } from 'flydrive/drivers/s3';
import { S3DriverOptions } from 'flydrive/drivers/s3/types';
import { getFileExtension, identifyFileTypeFromBuffer } from '../shared/file-type';

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

export const downloadFile = async (url: string) => {
  const response = await fetch(url);
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
