import { getSignedUploadUrl, getSignedUrl } from '@/actions/oss';

/**
 * 格式化文件大小显示
 * @param bytes 文件大小（字节）
 * @returns 格式化后的文件大小字符串
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

/**
 * 上传文件到OSS
 * @param file 要上传的文件
 * @param path 上传路径
 * @returns 上传后的文件URL
 */
export const uploadFile = async (file: File, path: string): Promise<string> => {
  // 获取上传URL
  const res = await getSignedUploadUrl({ extension: path.split('.').pop()! });

  // 检查上传URL是否存在
  if (!res.data?.uploadUrl) {
    throw new Error('Failed to get upload URL');
  }

  // 上传文件
  const response = await fetch(res.data.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
    },
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  // 检查文件键是否存在
  if (!res.data.fileKey) {
    throw new Error('Failed to get file key');
  }

  const url = await getSignedUrl({ fileKey: res.data.fileKey });

  // 检查URL是否存在
  if (!url.data) {
    throw new Error('Failed to get signed URL');
  }

  return url.data;
};

/**
 * 验证文件是否符合要求
 * @param file 要验证的文件
 * @param accept 接受的文件类型
 * @param maxSize 最大文件大小（字节）
 * @returns 验证错误信息，null表示验证通过
 */
export const validateFile = (file: File, accept?: string, maxSize?: number): string | null => {
  if (maxSize && file.size > maxSize) {
    return `文件大小不能超过 ${formatFileSize(maxSize)}`;
  }

  if (accept) {
    const acceptedTypes = accept.split(',').map(type => type.trim());
    const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    const mimeType = file.type;

    const isAccepted = acceptedTypes.some(type => {
      if (type.startsWith('.')) {
        return fileExtension === type;
      }
      return mimeType.match(type.replace('*', '.*'));
    });

    if (!isAccepted) {
      return `不支持的文件类型: ${file.type}`;
    }
  }

  return null;
};
