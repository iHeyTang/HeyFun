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
    try {
      // 从URL中提取文件名，移除查询参数
      const { buffer, mimeType, extension } = await downloadFile(item.data);
      const key = `${prefix}/${Date.now()}_${nanoid(8)}${extension}`;
      await storage.put(key, buffer, { contentType: mimeType });
      return { bucket: getBucket(), key };
    } catch (error) {
      console.error('Error processing result URL:', item.data, error);
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
  }
  throw new Error('Invalid source type');
};
