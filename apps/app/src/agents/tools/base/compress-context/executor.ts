import { ToolContext } from '../../context';
import { compressContextParamsSchema } from './schema';
import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import type { UnifiedChat } from '@repo/llm/chat';

/**
 * 提取消息文本内容
 */
function extractMessageText(content: UnifiedChat.Message['content']): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text || '')
      .join(' ');
  }

  return String(content);
}

/**
 * 估算消息的 token 数量（简单估算：1 token ≈ 4 字符）
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * 构建上下文压缩提示词
 */
function buildCompressionPrompt(messages: UnifiedChat.Message[]): string {
  const conversationContext = messages
    .map((msg, idx) => {
      const text = extractMessageText(msg.content);
      if (!text) return '';
      const role = msg.role === 'user' ? '用户' : msg.role === 'assistant' ? '助手' : '系统';
      const preview = text.length > 300 ? text.substring(0, 300) + '...' : text;
      return `[${idx + 1}] ${role}: ${preview}`;
    })
    .filter(line => line.length > 0)
    .join('\n\n');

  const limitedContext = conversationContext.substring(0, 2000);
  return `分析对话，提取关键信息。

对话（${messages.length}条）: ${limitedContext}

输出JSON（不用代码块）:
{"shouldCompress":true,"summary":"摘要","keyPoints":[],"preservedContext":""}

要求: shouldCompress为布尔值，summary为2-3句话，keyPoints为数组`;
}

export const compressContextExecutor = definitionToolExecutor(compressContextParamsSchema, async (params, context: ToolContext) => {
  const { threshold = 100000 } = params;

  if (!context.llmClient) {
    return {
      success: false,
      compressed: false,
      originalLength: context.messages?.length || 0,
      compressedLength: context.messages?.length || 0,
      summary: '',
      keyPoints: [],
      error: '没有 LLM 客户端，无法执行压缩',
    };
  }

  const messages = context.messages || [];
  if (messages.length === 0) {
    return {
      success: true,
      compressed: false,
      originalLength: 0,
      compressedLength: 0,
      summary: '',
      keyPoints: [],
    };
  }

  // 估算总 token 数
  const totalTokens = messages.reduce((sum, msg) => {
    const text = extractMessageText(msg.content);
    return sum + estimateTokenCount(text);
  }, 0);

  // 如果不超过阈值，不需要压缩
  if (totalTokens <= threshold) {
    return {
      success: true,
      compressed: false,
      originalLength: messages.length,
      compressedLength: messages.length,
      summary: '',
      keyPoints: [],
    };
  }

  // 构建压缩提示词
  const prompt = buildCompressionPrompt(messages);

  // 调用 LLM 进行上下文压缩
  const response = await context.llmClient.chat({
    messages: [
      {
        role: 'system',
        content: '你是一个专业的上下文管理助手，擅长提取对话中的关键信息并生成压缩摘要。',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  });

  const choice = response.choices?.[0];
  const content = choice?.message?.content || '';
  const responseText = typeof content === 'string' ? content : JSON.stringify(content);

  // 解析 JSON 响应
  let parsedResponse: {
    shouldCompress: boolean;
    summary: string;
    keyPoints: string[];
    preservedContext: string;
  };

  try {
    let jsonText: string | null = null;

    // 尝试直接解析
    try {
      const trimmed = responseText.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        JSON.parse(trimmed);
        jsonText = trimmed;
      }
    } catch (e) {
      // Not a direct JSON
    }

    // 使用括号计数匹配嵌套的 JSON 对象
    if (!jsonText) {
      let braceCount = 0;
      let jsonStartIndex = -1;
      for (let i = 0; i < responseText.length; i++) {
        if (responseText[i] === '{') {
          if (jsonStartIndex === -1) {
            jsonStartIndex = i;
          }
          braceCount++;
        } else if (responseText[i] === '}') {
          braceCount--;
          if (braceCount === 0 && jsonStartIndex !== -1) {
            jsonText = responseText.substring(jsonStartIndex, i + 1);
            break;
          }
        }
      }
    }

    // 尝试查找代码块中的 JSON
    if (!jsonText) {
      const codeBlockStart = responseText.indexOf('```json');
      const codeBlockStartAlt = responseText.indexOf('```');
      const codeBlockStartIndex = codeBlockStart !== -1 ? codeBlockStart : codeBlockStartAlt;

      if (codeBlockStartIndex !== -1) {
        const codeBlockEnd = responseText.indexOf('```', codeBlockStartIndex + 3);
        const codeBlockContent = responseText.substring(codeBlockStartIndex + 3, codeBlockEnd !== -1 ? codeBlockEnd : responseText.length).trim();
        const jsonContent = codeBlockContent.replace(/^json\s*/i, '').trim();

        let braceCount = 0;
        let jsonStartIndex = -1;
        for (let i = 0; i < jsonContent.length; i++) {
          if (jsonContent[i] === '{') {
            if (jsonStartIndex === -1) {
              jsonStartIndex = i;
            }
            braceCount++;
          } else if (jsonContent[i] === '}') {
            braceCount--;
            if (braceCount === 0 && jsonStartIndex !== -1) {
              jsonText = jsonContent.substring(jsonStartIndex, i + 1);
              break;
            }
          }
        }
      }
    }

    if (jsonText) {
      parsedResponse = JSON.parse(jsonText);
    } else {
      throw new Error('未找到 JSON 格式');
    }
  } catch (parseError) {
    console.warn('[CompressContextTool] ⚠️ 解析 LLM 响应失败:', parseError);
    return {
      success: true,
      compressed: false,
      originalLength: messages.length,
      compressedLength: messages.length,
      summary: '',
      keyPoints: [],
    };
  }

  // 如果不需要压缩，直接返回
  if (!parsedResponse.shouldCompress) {
    return {
      success: true,
      compressed: false,
      originalLength: messages.length,
      compressedLength: messages.length,
      summary: parsedResponse.summary || '',
      keyPoints: parsedResponse.keyPoints || [],
    };
  }

  // 构建压缩后的消息历史
  const compressedMessages: UnifiedChat.Message[] = [];
  const systemMessages = messages.filter(msg => msg.role === 'system');
  const recentMessages = messages.slice(-5); // 保留最近 5 条消息

  // 添加系统消息
  compressedMessages.push(...systemMessages);

  // 添加压缩摘要消息
  if (parsedResponse.summary || parsedResponse.preservedContext) {
    const summaryContent = [
      parsedResponse.summary ? `## 对话摘要\n${parsedResponse.summary}` : '',
      parsedResponse.keyPoints && parsedResponse.keyPoints.length > 0
        ? `## 关键信息点\n${parsedResponse.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
        : '',
      parsedResponse.preservedContext ? `## 保留的上下文\n${parsedResponse.preservedContext}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    compressedMessages.push({
      role: 'system',
      content: `[上下文压缩摘要]\n\n${summaryContent}`,
    });
  }

  // 添加最近的消息
  compressedMessages.push(...recentMessages);

  // 注意：工具执行在浏览器端完成，无法直接更新消息历史
  // 工具返回修改后的消息，由调用方处理
  return {
    success: true,
    compressed: true,
    originalLength: messages.length,
    compressedLength: compressedMessages.length,
    summary: parsedResponse.summary || '',
    keyPoints: parsedResponse.keyPoints || [],
    compressedMessages,
  };
});
