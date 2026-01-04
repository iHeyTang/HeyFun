import { GenerationTaskResult } from '@repo/llm/aigc';
import storage, { downloadFile, getBucket } from './storage';
import { nanoid } from 'nanoid';

/**
 * Process task result
 * @param prefix - The prefix of the key
 * @param item - The item to process
 * @returns The processed result
 */
export const restoreAigcTaskResultToStorage = async (prefix: string, item: NonNullable<GenerationTaskResult['data']>[number]) => {
  if (item.sourceType === 'url') {
    // 处理 data URL（如 data:application/json;charset=utf-8,...）
    if (item.data.startsWith('data:')) {
      try {
        const [mimeTypePart, ...dataParts] = item.data.split(',');
        if (!mimeTypePart) {
          throw new Error('Invalid data URL format: missing mime type');
        }
        const mimeType = mimeTypePart.split(';')[0]?.replace('data:', '') || '';
        const encodedData = dataParts.join(',');

        // 对于 JSON 文本数据，直接解码并存储为文本文件
        if (mimeType === 'application/json' || mimeType.includes('json')) {
          const textContent = decodeURIComponent(encodedData);
          const buffer = Buffer.from(textContent, 'utf-8');
          const key = `${prefix}/${Date.now()}_${nanoid(8)}.json`;
          await storage.put(key, buffer, { contentType: 'application/json' });
          return { bucket: getBucket(), key };
        }

        // 对于其他 data URL，尝试 base64 解码
        const buffer = Buffer.from(encodedData, 'base64');
        const extension = item.fileExtension || '.bin';
        const key = `${prefix}/${Date.now()}_${nanoid(8)}${extension}`;
        await storage.put(key, buffer, { contentType: mimeType });
        return { bucket: getBucket(), key };
      } catch (error) {
        console.error('Error processing data URL:', item.data.substring(0, 100), error);
        throw error;
      }
    }

    // 处理普通 URL
    try {
      // 从URL中提取文件名，移除查询参数
      const { buffer, mimeType, extension } = await downloadFile(item.data);
      const key = `${prefix}/${Date.now()}_${nanoid(8)}${extension}`;
      await storage.put(key, buffer, { contentType: mimeType });
      return { bucket: getBucket(), key };
    } catch (error) {
      console.error('Error processing result URL:', item.data, error);
      throw error;
    }
  } else if (item.sourceType === 'base64') {
    try {
      const buffer = Buffer.from(item.data, 'base64');
      const key = `${prefix}/${Date.now()}_${nanoid(8)}${item.fileExtension}`;
      await storage.put(key, buffer, { contentType: `${item.type}/*` });
      return { bucket: getBucket(), key };
    } catch (error) {
      console.error('Error processing result base64:', item.data, error);
    }
  } else if (item.sourceType === 'hex') {
    try {
      const buffer = Buffer.from(item.data, 'hex');
      const key = `${prefix}/${Date.now()}_${nanoid(8)}${item.fileExtension}`;
      await storage.put(key, buffer, { contentType: `${item.type}/*` });
      return { bucket: getBucket(), key };
    } catch (error) {
      console.error('Error processing result hex:', item.data, error);
    }
  } else if (item.sourceType === 'music') {
    try {
      // 处理音乐类型，默认使用 url，如果有flac，下载后单独存储，并把key作为metadata.flac_key
      const musicData = item.data;
      if (!musicData.url) {
        throw new Error('No valid music URL found');
      }
      const { buffer, mimeType, extension } = await downloadFile(musicData.url);
      const key = `${prefix}/${Date.now()}_${nanoid(8)}${extension}`;
      await storage.put(key, buffer, { contentType: mimeType });
      return { bucket: getBucket(), key, metadata: { flac_key: key, lyrics: musicData.lyrics_sections } };
    } catch (error) {
      console.error('Error processing music result:', item.data, error);
    }
  }
  throw new Error('Invalid source type');
};
