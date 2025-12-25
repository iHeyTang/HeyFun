import { ChatInputAttachment } from '@/components/block/chat-input/index';

/**
 * 构建多模态消息内容
 * 将文本和附件组合成统一的消息格式（用于前端发送消息到后端）
 * @param content 文本内容
 * @param attachments 附件列表
 * @returns 序列化后的消息内容（JSON字符串或纯文本）
 */
export function buildMessageContent(content: string, attachments?: ChatInputAttachment[]): string {
  if (attachments && attachments.length > 0) {
    // 如果有附件，构建多模态内容格式
    const contentParts: Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
      | { type: 'attachment'; attachment: { fileKey: string; type: string; name?: string; mimeType?: string } }
    > = [];

    // 添加文本内容（如果有）
    if (content.trim()) {
      contentParts.push({ type: 'text', text: content });
    }

    // 添加附件内容
    for (const attachment of attachments) {
      if (attachment.type === 'image') {
        // 图片类型，使用 image_url 格式（用于 LLM 视觉能力）
        let imageUrl: string;
        if (attachment.fileKey) {
          // 使用特殊格式标识OSS key
          imageUrl = `oss://${attachment.fileKey}`;
        } else if (attachment.url.startsWith('data:image')) {
          // 已经是base64，直接使用
          imageUrl = attachment.url;
        } else {
          // 其他URL，转换为绝对URL
          imageUrl = attachment.url.startsWith('http') ? attachment.url : `${window.location.origin}${attachment.url}`;
        }
        contentParts.push({
          type: 'image_url',
          image_url: { url: imageUrl },
        });
      } else {
        // 非图片附件，使用 attachment 格式
        if (attachment.fileKey) {
          contentParts.push({
            type: 'attachment',
            attachment: {
              fileKey: attachment.fileKey,
              type: attachment.type,
              name: attachment.name,
              mimeType: attachment.mimeType,
            },
          });
        }
      }
    }

    // 将多模态内容序列化为JSON字符串
    return JSON.stringify(contentParts);
  } else {
    // 纯文本消息
    return content;
  }
}

