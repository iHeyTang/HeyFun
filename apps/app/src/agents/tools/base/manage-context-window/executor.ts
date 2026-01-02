import { ToolContext } from '../../context';
import { manageContextWindowParamsSchema } from './schema';
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
 * 估算消息历史的 token 总数
 */
function estimateTotalTokens(messages: UnifiedChat.Message[]): number {
  return messages.reduce((sum, msg) => {
    const text = extractMessageText(msg.content);
    return sum + estimateTokenCount(text);
  }, 0);
}

/**
 * 构建上下文摘要提示词
 */
function buildSummaryPrompt(messages: UnifiedChat.Message[]): string {
  const conversationContext = messages
    .map((msg, idx) => {
      const text = extractMessageText(msg.content);
      if (!text) return '';
      const role = msg.role === 'user' ? '用户' : msg.role === 'assistant' ? '助手' : '系统';
      const preview = text.length > 400 ? text.substring(0, 400) + '...' : text;
      return `[${idx + 1}] ${role}: ${preview}`;
    })
    .filter(line => line.length > 0)
    .join('\n\n');

  return `你是一个上下文管理助手。请分析以下对话历史，提取关键信息并生成压缩摘要。

## 对话历史（共 ${messages.length} 条消息）

${conversationContext}

## 压缩要求

1. **保留关键信息**：
   - 用户的重要偏好和需求
   - 重要的决策和选择
   - 项目背景和技术栈
   - 配置信息和设置
   - 用户明确要求记住的信息

2. **保留上下文关系**：
   - 保持时间线和逻辑关系
   - 保留因果关系
   - 保留重要的上下文依赖

3. **移除冗余内容**：
   - 重复的信息
   - 无关的闲聊
   - 已解决的问题细节

## 输出格式

请以 JSON 格式输出，包含以下字段：
- summary: string - 对话摘要（3-5 句话概括核心内容）
- keyPoints: string[] - 关键信息点列表（8-12 条）
- preservedContext: string - 需要保留的上下文信息（用户偏好、配置、技术栈等）
- importantDecisions: string[] - 重要的决策和选择

示例输出：
{
  "summary": "用户正在开发一个 React 项目，讨论了组件设计和状态管理方案，最终选择了使用 Context API 和 useReducer。项目需要支持多语言和主题切换。",
  "keyPoints": [
    "项目使用 React 18 + TypeScript + Vite",
    "用户偏好函数式组件和 Hooks",
    "决定使用 Context API 进行全局状态管理",
    "使用 useReducer 处理复杂状态逻辑",
    "需要支持 i18n 多语言",
    "需要支持主题切换（深色/浅色）",
    "使用 Tailwind CSS 进行样式管理"
  ],
  "preservedContext": "项目类型：React Web 应用，技术栈：React 18 + TypeScript + Vite + Tailwind CSS，用户偏好：函数式编程风格，状态管理：Context API + useReducer",
  "importantDecisions": [
    "选择 Context API 而非 Redux",
    "使用 useReducer 处理复杂状态",
    "采用 Tailwind CSS 而非 CSS Modules"
  ]
}

请直接输出 JSON，不要添加其他说明文字。`;
}

export const manageContextWindowExecutor = definitionToolExecutor(manageContextWindowParamsSchema, async (params, context: ToolContext) => {
  const { action = 'check', maxMessages = 30, maxTokens = 8000, strategy = 'hybrid' } = params;

  const messages = context.messages || [];
  if (messages.length === 0) {
    return {
      success: true,
      needsManagement: false,
      currentMessageCount: 0,
      currentTokenCount: 0,
      maxMessages,
      maxTokens,
      recommendation: '当前上下文为空，无需管理',
    };
  }

  const currentTokenCount = estimateTotalTokens(messages);
  const currentMessageCount = messages.length;
  const needsManagement = currentMessageCount > maxMessages || currentTokenCount > maxTokens;

  // 如果只是检查，返回状态和建议
  if (action === 'check') {
    return {
      success: true,
      needsManagement,
      currentMessageCount,
      currentTokenCount,
      maxMessages,
      maxTokens,
      recommendation: needsManagement
        ? `建议执行上下文管理：当前有 ${currentMessageCount} 条消息（限制：${maxMessages}），${currentTokenCount} tokens（限制：${maxTokens}）。建议使用 ${strategy} 策略进行管理。`
        : '当前上下文在限制范围内，无需管理',
    };
  }

  // 执行管理
  const slidingWindowSize = 10; // 默认滑动窗口大小

  // 分离系统消息和其他消息
  const systemMessages = messages.filter(msg => msg.role === 'system');
  const nonSystemMessages = messages.filter(msg => msg.role !== 'system');

  const managedMessages: UnifiedChat.Message[] = [...systemMessages];
  let summary: string | undefined;
  let keyPoints: string[] | undefined;

  // 根据策略管理上下文
  if (strategy === 'sliding_window' || strategy === 'hybrid') {
    // 滑动窗口策略：保留最近的 N 轮对话
    const recentMessages = nonSystemMessages.slice(-slidingWindowSize * 2);
    managedMessages.push(...recentMessages);

    // 如果有被丢弃的消息，且使用混合策略，则进行摘要压缩
    if (strategy === 'hybrid' && nonSystemMessages.length > slidingWindowSize * 2 && context.llmClient) {
      const discardedMessages = nonSystemMessages.slice(0, -slidingWindowSize * 2);

      if (discardedMessages.length > 0) {
        const prompt = buildSummaryPrompt(discardedMessages);

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
          max_tokens: 1200,
        });

        const content = response.choices?.[0]?.message?.content || '';
        const responseText = typeof content === 'string' ? content : JSON.stringify(content);

        try {
          const { extractJsonFromText } = await import('@/lib/shared/json');
          const parsedResponse = extractJsonFromText<{
            summary: string;
            keyPoints: string[];
            preservedContext?: string;
          }>(responseText, true);

          if (parsedResponse && typeof parsedResponse === 'object' && !Array.isArray(parsedResponse)) {

            summary = parsedResponse.summary;
            keyPoints = parsedResponse.keyPoints;

            const summaryContent = [
              parsedResponse.summary ? `## 对话摘要\n${parsedResponse.summary}` : '',
              parsedResponse.keyPoints && parsedResponse.keyPoints.length > 0
                ? `## 关键信息点\n${parsedResponse.keyPoints.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n')}`
                : '',
              parsedResponse.preservedContext ? `## 保留的上下文\n${parsedResponse.preservedContext}` : '',
            ]
              .filter(Boolean)
              .join('\n\n');

            // 在系统消息后插入摘要
            managedMessages.splice(systemMessages.length, 0, {
              role: 'system',
              content: `[上下文窗口管理 - 历史对话摘要]\n\n${summaryContent}`,
            });
          }
        } catch (parseError) {
          console.warn('[ManageContextWindowTool] ⚠️ 解析摘要失败:', parseError);
        }
      }
    }
  } else if (strategy === 'summary_compression') {
    // 纯摘要压缩策略
    if (context.llmClient && nonSystemMessages.length > slidingWindowSize * 2) {
      const prompt = buildSummaryPrompt(nonSystemMessages.slice(0, -slidingWindowSize * 2));

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
        max_tokens: 1200,
      });

      const content = response.choices?.[0]?.message?.content || '';
      const responseText = typeof content === 'string' ? content : JSON.stringify(content);

      try {
        const { extractJsonFromText } = await import('@/lib/shared/json');
        const parsedResponse = extractJsonFromText<{
          summary: string;
          keyPoints: string[];
          preservedContext?: string;
        }>(responseText, true);

        if (parsedResponse && typeof parsedResponse === 'object' && !Array.isArray(parsedResponse)) {

          summary = parsedResponse.summary;
          keyPoints = parsedResponse.keyPoints;

          const summaryContent = [
            parsedResponse.summary ? `## 对话摘要\n${parsedResponse.summary}` : '',
            parsedResponse.keyPoints && parsedResponse.keyPoints.length > 0
              ? `## 关键信息点\n${parsedResponse.keyPoints.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n')}`
              : '',
            parsedResponse.preservedContext ? `## 保留的上下文\n${parsedResponse.preservedContext}` : '',
          ]
            .filter(Boolean)
            .join('\n\n');

          managedMessages.push({
            role: 'system',
            content: `[上下文窗口管理 - 历史对话摘要]\n\n${summaryContent}`,
          });
          managedMessages.push(...nonSystemMessages.slice(-slidingWindowSize * 2));
        }
      } catch (parseError) {
        console.warn('[ManageContextWindowTool] ⚠️ 解析摘要失败:', parseError);
        managedMessages.push(...nonSystemMessages.slice(-slidingWindowSize * 2));
      }
    } else {
      managedMessages.push(...nonSystemMessages);
    }
  }

  // 确保不超过最大 token 限制
  let finalMessages = managedMessages;
  const currentTokens = estimateTotalTokens(finalMessages);

  if (currentTokens > maxTokens) {
    const systemAndSummary = finalMessages.filter(msg => msg.role === 'system');
    const otherMessages = finalMessages.filter(msg => msg.role !== 'system');

    finalMessages = [...systemAndSummary];
    let accumulatedTokens = estimateTotalTokens(finalMessages);

    for (let i = otherMessages.length - 1; i >= 0; i--) {
      const msg = otherMessages[i]!;
      const msgTokens = estimateTokenCount(extractMessageText(msg.content));
      if (accumulatedTokens + msgTokens <= maxTokens) {
        finalMessages.push(msg);
        accumulatedTokens += msgTokens;
      } else {
        break;
      }
    }

    finalMessages = [...systemAndSummary, ...finalMessages.filter(msg => msg.role !== 'system').reverse()];
  }

  // 注意：工具执行在浏览器端完成，无法直接更新消息历史
  // 工具返回修改后的消息，由调用方处理
  return {
    success: true,
    needsManagement: true,
    currentMessageCount,
    currentTokenCount,
    maxMessages,
    maxTokens,
    recommendation: `已执行上下文管理：${currentMessageCount} → ${finalMessages.length} 条消息`,
    managedMessages: finalMessages,
    summary,
    keyPoints,
  };
});
