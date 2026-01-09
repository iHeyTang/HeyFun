import { UnifiedChat } from '@/llm/chat';
import { convertImageUrlToBase64 } from '@/lib/server/storage-image';
import storage from '@/lib/server/storage';

/**
 * 过滤并验证消息，返回可以用于 LLM 的"就绪"消息
 *
 * 规则：
 * 1. 排除未完成的 assistant 消息（isComplete=false 且没有 toolCalls）
 * 2. 对于有 toolCalls 的 assistant 消息，验证工具调用和工具结果是否完整配对
 * 3. 只保留已完成且非流式的消息（除了有完整工具配对的 assistant 消息）
 *
 * @returns 返回就绪的消息列表，可以安全地用于 LLM 调用
 */
export function filterReadyChatMessages(
  messages: Array<{
    id: string;
    role: string;
    content: string;
    isComplete: boolean;
    isStreaming: boolean;
    toolCalls?: PrismaJson.ToolCall[] | null;
    toolResults?: PrismaJson.ToolResult[] | null;
  }>,
) {
  return messages.filter(msg => {
    // 排除当前正在处理的 AI 消息（isComplete=false 且没有 toolCalls）
    if (msg.role === 'assistant' && !msg.isComplete && !msg.toolCalls) {
      return false;
    }

    // 如果是 assistant 消息且有 toolCalls，即使 isComplete=false 也要保留
    // 但需要确保对应的 toolResults 都已存在
    if (msg.role === 'assistant' && msg.toolCalls) {
      // 检查是否有对应的 toolResults
      const toolCallIds = msg.toolCalls.map(tc => tc.id);
      const toolResults = msg.toolResults || [];
      const toolResultIds = toolResults.map(tr => tr.toolCallId).filter(Boolean);
      // 只有当所有工具调用都有对应的工具结果时，才包含这个 assistant 消息
      // 或者如果 assistant 消息 isComplete=false，说明工具还在执行中，不应该包含
      if (!msg.isComplete) {
        // 如果 assistant 消息未完成，检查是否所有工具结果都已创建
        return toolResultIds.length === toolCallIds.length;
      }
      return true;
    }

    // 其他消息只保留完成的
    return msg.isComplete && !msg.isStreaming;
  });
}

/**
 * 多模态内容项类型（扩展了 UnifiedChat 的标准类型，支持附件）
 */
type MultimodalContentItem =
  | UnifiedChat.TextContent
  | UnifiedChat.ImageContent
  | {
      type: 'attachment';
      attachment: {
        fileKey: string;
        type?: string;
        name?: string;
        mimeType?: string;
      };
    };

/**
 * 处理多模态内容（图片、附件等）
 * 将用户消息中的图片URL转换为base64，处理附件内容
 */
export async function processMultimodalContent(content: string, organizationId: string): Promise<UnifiedChat.MessageContent> {
  // 尝试解析JSON格式的多模态内容（支持文本、图片和附件）
  if (content.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        const ossKeys: string[] = [];

        // 先收集所有OSS key
        for (const item of parsed) {
          if (item.type === 'image_url' && item.image_url?.url && item.image_url.url.startsWith('oss://')) {
            ossKeys.push(item.image_url.url);
          }
        }

        // 处理所有内容项
        const processedItems = await Promise.all(
          parsed.map(async (item: MultimodalContentItem) => {
            // 处理图片
            if (item.type === 'image_url' && item.image_url?.url) {
              // 如果已经是base64，直接返回
              if (item.image_url.url.startsWith('data:image')) {
                return item;
              }
              // 转换URL为base64，如果失败则抛出错误
              const base64Url = await convertImageUrlToBase64(item.image_url.url, organizationId);
              return {
                type: 'image_url' as const,
                image_url: { url: base64Url },
              };
            }
            // 处理其他附件类型
            if (item.type === 'attachment' && item.attachment) {
              // 对于文本类型的附件（如 MD、TXT 等），读取文件内容并转换为文本
              const attachmentType = item.attachment.type || 'file';
              const mimeType = item.attachment.mimeType || '';

              // 判断是否是文本文件
              const isTextFile =
                attachmentType === 'document' ||
                mimeType.startsWith('text/') ||
                mimeType.includes('markdown') ||
                mimeType.includes('json') ||
                item.attachment.fileKey.endsWith('.md') ||
                item.attachment.fileKey.endsWith('.txt') ||
                item.attachment.fileKey.endsWith('.json') ||
                item.attachment.fileKey.endsWith('.csv');

              if (isTextFile) {
                try {
                  // 从 OSS 读取文件内容
                  const fileData = await storage.getBytes(item.attachment.fileKey);
                  if (fileData) {
                    const textContent = Buffer.from(fileData).toString('utf-8');
                    // 将文件内容作为文本添加到消息中
                    return {
                      type: 'text' as const,
                      text: `[附件: ${item.attachment.name || item.attachment.fileKey}]\n${textContent}`,
                    };
                  }
                } catch (error) {
                  console.error(`[AgentUtils] Failed to read attachment file: ${item.attachment.fileKey}`, error);
                  // 如果读取失败，在文本中提及附件
                  return {
                    type: 'text' as const,
                    text: `[附件: ${item.attachment.name || item.attachment.fileKey} - 无法读取文件内容]`,
                  };
                }
              } else {
                // 非文本附件，在消息文本中提及，但不包含在 content 数组中
                // 这些附件可以通过工具访问
                return {
                  type: 'text' as const,
                  text: `[附件: ${item.attachment.name || item.attachment.fileKey} (${attachmentType})]`,
                };
              }
            }
            // 文本内容直接返回
            if (item.type === 'text') {
              return item;
            }
            return item;
          }),
        );

        // 如果有OSS格式的图片，在消息末尾添加OSS key信息，方便工具调用时使用
        if (ossKeys.length > 0) {
          const existingTextIndex = processedItems.findIndex(r => r.type === 'text');
          const ossKeyText = `\n[用户上传的图片OSS key（可在工具调用中使用）: ${ossKeys.join(', ')}]`;
          if (existingTextIndex >= 0) {
            // 如果有文本项，追加到现有文本
            const textItem = processedItems[existingTextIndex] as UnifiedChat.TextContent;
            processedItems[existingTextIndex] = {
              ...textItem,
              text: textItem.text + ossKeyText,
            };
          } else {
            // 如果没有文本项，创建一个新的文本项
            processedItems.push({
              type: 'text' as const,
              text: ossKeyText.trim(),
            });
          }
        }

        // 过滤掉 attachment 类型（它们已经被转换为 text），只保留标准的 MessageContent 类型
        return processedItems.filter(
          (item): item is UnifiedChat.TextContent | UnifiedChat.ImageContent => item.type !== 'attachment',
        ) as UnifiedChat.MessageContent;
      }
    } catch (e) {
      // 解析失败，使用原始字符串
      return content;
    }
  }

  return content;
}

/**
 * 将 Prisma 消息转换为 UnifiedChat 消息
 * 处理工具调用和工具结果的配对，处理多模态内容
 */
export async function convertPrismaMessagesToUnifiedChat(
  messages: Array<{
    id: string;
    role: string;
    content: string;
    toolCalls?: PrismaJson.ToolCall[] | null;
    toolResults?: PrismaJson.ToolResult[] | null;
    isComplete?: boolean;
    isStreaming?: boolean;
  }>,
  organizationId: string,
  systemPrompt?: string,
): Promise<UnifiedChat.Message[]> {
  // 先过滤出就绪的消息（需要确保 isComplete 和 isStreaming 有默认值）
  const readyMessages = filterReadyChatMessages(
    messages.map(msg => ({
      ...msg,
      isComplete: msg.isComplete ?? false,
      isStreaming: msg.isStreaming ?? false,
    })),
  );
  const unifiedMessages: UnifiedChat.Message[] = [];

  // 如果有系统提示，先添加
  if (systemPrompt) {
    unifiedMessages.push({ role: 'system' as const, content: systemPrompt });
  }

  // 按顺序处理消息，确保工具调用和工具结果配对
  for (const msg of readyMessages) {
    if (msg.role === 'assistant' && msg.toolCalls) {
      // 对于有 toolCalls 的 assistant 消息，从 toolResults 读取工具结果
      const toolCalls = msg.toolCalls;
      const toolResults = msg.toolResults || [];
      const toolCallIds = toolCalls.map(tc => tc.id);

      // 只有当工具结果数量等于工具调用数量时，才添加这条消息
      if (toolResults.length === toolCallIds.length) {
        const baseMsg: UnifiedChat.Message = {
          role: 'assistant' as const,
          content: msg.content,
          tool_calls: toolCalls,
        };
        unifiedMessages.push(baseMsg);

        // 添加对应的 tool 消息（从 toolResults 构建）
        for (const toolCallId of toolCallIds) {
          const toolResult = toolResults.find(tr => tr.toolCallId === toolCallId);
          if (toolResult) {
            // 从 toolResult 中提取内容，序列化整个对象
            const toolContent = JSON.stringify(toolResult);
            unifiedMessages.push({
              role: 'tool' as const,
              content: toolContent,
              tool_call_id: toolCallId,
            });
          }
        }
      }
    } else {
      // 普通消息，需要解析多模态内容
      let messageContent: UnifiedChat.MessageContent = msg.content;

      // 尝试解析JSON格式的多模态内容（支持文本、图片和附件）
      if (msg.role === 'user' && msg.content.trim().startsWith('[')) {
        messageContent = await processMultimodalContent(msg.content, organizationId);
      }

      const baseMsg: UnifiedChat.Message = {
        role: msg.role as UnifiedChat.Message['role'],
        content: messageContent,
      };
      unifiedMessages.push(baseMsg);
    }
  }

  return unifiedMessages;
}

/**
 * 保存工具结果到 assistant 消息
 */
export async function saveToolResultsToMessage(
  messageId: string,
  toolCalls: UnifiedChat.ToolCall[],
  toolResults: Array<{ success?: boolean; data?: any; error?: string; message?: string }>,
) {
  const { prisma } = await import('@/lib/server/prisma');

  // 获取现有消息
  const existingMessage = await prisma.chatMessages.findUnique({
    where: { id: messageId },
  });

  if (!existingMessage) {
    throw new Error(`Message ${messageId} not found`);
  }

  const existingToolResults = (existingMessage.toolResults as PrismaJson.ToolResult[] | null) || [];
  const newToolResults: PrismaJson.ToolResult[] = [...existingToolResults];

  for (let i = 0; i < toolCalls.length; i++) {
    const toolCall = toolCalls[i];
    const result = toolResults[i];

    if (toolCall && result) {
      // 检查是否已经存在该toolCallId的结果
      const existingResultIndex = newToolResults.findIndex(tr => tr.toolCallId === toolCall.id);
      const resultData: PrismaJson.ToolResult = {
        toolCallId: toolCall.id,
        toolName: toolCall.function.name,
        success: result.success ?? true,
        data: result.data,
        error: result.error,
        message: result.message,
      };

      if (existingResultIndex >= 0) {
        // 更新已存在的结果
        newToolResults[existingResultIndex] = resultData;
      } else {
        // 添加新结果
        newToolResults.push(resultData);
      }
    }
  }

  // 更新 assistant 消息的 toolResults
  await prisma.chatMessages.update({
    where: { id: messageId },
    data: {
      toolResults: newToolResults,
      isComplete: true, // 工具执行完成后标记为完成
    },
  });
}
