import { IAudioMetadata, parseBuffer } from 'music-metadata';

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
  return buffer;
};

/**
 * 精确获取媒体文件时长（支持视频和音频）
 * 使用 music-metadata 库解析真实的媒体文件元数据
 * 如果无法获取精确时长，直接抛出错误
 */
export const getMediaDuration = async (mediaUrl: string): Promise<number> => {
  // 对于 MP4 视频文件，需要下载更多数据来解析元数据
  // MP4 的 moov atom 可能位于文件的任意位置
  const response = await fetch(mediaUrl, {
    method: 'GET',
    headers: {
      Range: 'bytes=0-5242880', // 下载前 5MB，确保能解析 MP4 视频的元数据
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch media file: HTTP ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    // 使用 music-metadata 解析媒体文件元数据
    const metadata: IAudioMetadata = await parseBuffer(buffer, { mimeType: 'video/mp4' });

    if (!metadata.format.duration) {
      throw new Error('Media file does not contain duration information in metadata');
    }

    // 返回精确的时长（秒）
    return Math.round(metadata.format.duration * 100) / 100; // 保留两位小数
  } catch (error) {
    console.error('Failed to parse media metadata:', error);
    throw new Error(`Failed to parse media file metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
