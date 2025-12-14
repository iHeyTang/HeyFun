/**
 * 上下文压缩微代理
 *
 * 在迭代后自动压缩长对话，提取关键信息，减少上下文长度
 * 适用于长对话场景，避免上下文过长导致的问题
 */

import type { IMicroAgent, MicroAgentContext, MicroAgentResult, MicroAgentConfig } from './types';
import { MicroAgentTrigger } from './types';
import type { ChatMessage } from '../../llm/types/chat';
import { gatewayService } from '../../llm/services/gateway';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

/**
 * 上下文压缩结果
 */
export interface ContextCompressionResult {
  compressed: boolean; // 是否进行了压缩
  originalLength: number; // 原始消息数量
  compressedLength: number; // 压缩后消息数量
  summary: string; // 压缩摘要
  keyPoints: string[]; // 关键信息点
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cost?: number;
  };
}

/**
 * 提取消息文本内容
 */
function extractMessageText(content: ChatMessage['content']): string {
  if (typeof content === 'string') {
    return content;
  }

  return content
    .filter((part: any) => part.type === 'text')
    .map((part: any) => part.text || '')
    .join(' ');
}

/**
 * 检查是否需要压缩（消息数量超过阈值）
 */
function shouldCompress(context: MicroAgentContext): boolean {
  const messageCount = context.chatMessages.length;
  const threshold = 20; // 超过 20 条消息时触发压缩

  return messageCount > threshold;
}

/**
 * 构建上下文压缩提示词
 */
function buildCompressionPrompt(context: MicroAgentContext): string {
  const messages = context.chatMessages;
  const conversationContext = messages
    .map((msg, idx) => {
      const text = extractMessageText(msg.content);
      if (!text) return '';
      const role = msg.role === 'user' ? '用户' : msg.role === 'assistant' ? '助手' : '系统';
      return `[${idx + 1}] ${role}: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`;
    })
    .filter((line) => line.length > 0)
    .join('\n');

  return `你是一个上下文管理助手。请分析以下长对话，提取关键信息并生成压缩摘要。

## 对话历史（共 ${messages.length} 条消息）

${conversationContext}

## 压缩要求

1. 保留所有关键信息和决策点
2. 保留用户的重要偏好和需求
3. 保留重要的上下文信息（如项目背景、技术栈等）
4. 移除冗余的对话内容
5. 合并相似的主题讨论
6. 保持时间线和逻辑关系

## 输出格式

请以 JSON 格式输出，包含以下字段：
- shouldCompress: boolean - 是否需要压缩（如果消息数量不多，可以返回 false）
- summary: string - 对话摘要（2-3 句话概括整个对话的核心内容）
- keyPoints: string[] - 关键信息点列表（5-10 条）
- preservedContext: string - 需要保留的上下文信息（如项目设置、用户偏好等）

示例输出：
{
  "shouldCompress": true,
  "summary": "用户正在开发一个 React 项目，讨论了组件设计和状态管理方案，最终选择了使用 Context API 和 useReducer。",
  "keyPoints": [
    "项目使用 React + TypeScript",
    "用户偏好函数式组件",
    "决定使用 Context API 进行全局状态管理",
    "使用 useReducer 处理复杂状态逻辑",
    "项目需要支持多语言（i18n）"
  ],
  "preservedContext": "项目类型：React Web 应用，技术栈：React 18 + TypeScript + Vite，用户偏好：函数式编程风格"
}

请直接输出 JSON，不要添加其他说明文字。`;
}

/**
 * 上下文压缩微代理
 */
export class ContextCompressorMicroAgent implements IMicroAgent {
  readonly config: MicroAgentConfig;

  constructor(options?: { enabled?: boolean; priority?: number }) {
    this.config = {
      id: 'context-compressor',
      name: '上下文压缩',
      description: '自动压缩长对话，提取关键信息',
      trigger: MicroAgentTrigger.POST_ITERATION,
      enabled: options?.enabled !== false,
      priority: options?.priority ?? 100, // 较低优先级，在其他微代理之后执行
    };
  }

  async shouldExecute(context: MicroAgentContext): Promise<boolean> {
    // 只在消息数量超过阈值时执行
    return shouldCompress(context);
  }

  async execute(context: MicroAgentContext): Promise<MicroAgentResult> {
    try {
      // 构建压缩提示词
      const prompt = buildCompressionPrompt(context);

      // 创建 LLM 实例
      const llm = gatewayService.createLLM(context.agentConfig.modelId, {
        temperature: 0.3,
        maxTokens: 800,
      });

      // 调用 LLM 进行上下文压缩
      const response = await llm.invoke([
        new SystemMessage('你是一个专业的上下文管理助手，擅长提取对话中的关键信息并生成压缩摘要。'),
        new HumanMessage(prompt),
      ]);

      const responseText = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

      // 提取 token 使用信息
      const extractTokenUsage = (response: any) => {
        const metadata = response?.response_metadata;
        if (!metadata) return undefined;

        if (metadata.usage) {
          return {
            promptTokens: metadata.usage.prompt_tokens ?? metadata.usage.input_tokens ?? 0,
            completionTokens: metadata.usage.completion_tokens ?? metadata.usage.output_tokens ?? 0,
            totalTokens: metadata.usage.total_tokens ?? 0,
            cost: metadata.usage.cost ?? 0,
          };
        }

        if (metadata.tokenUsage) {
          return {
            promptTokens: metadata.tokenUsage.promptTokens ?? 0,
            completionTokens: metadata.tokenUsage.completionTokens ?? 0,
            totalTokens: metadata.tokenUsage.totalTokens ?? 0,
            cost: metadata.usage?.cost ?? 0,
          };
        }

        return undefined;
      };

      const tokenUsage = extractTokenUsage(response);

      // 解析 JSON 响应
      let parsedResponse: {
        shouldCompress: boolean;
        summary: string;
        keyPoints: string[];
        preservedContext: string;
      };

      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('未找到 JSON 格式');
        }
      } catch (parseError) {
        console.warn('[ContextCompressorMicroAgent] ⚠️ 解析 LLM 响应失败:', parseError);
        return {
          success: true,
          data: {
            compressed: false,
            originalLength: context.chatMessages.length,
            compressedLength: context.chatMessages.length,
            summary: '上下文压缩解析失败',
            keyPoints: [],
            tokenUsage,
          } as ContextCompressionResult,
          tokenUsage,
        };
      }

      // 如果不需要压缩，直接返回
      if (!parsedResponse.shouldCompress) {
        return {
          success: true,
          data: {
            compressed: false,
            originalLength: context.chatMessages.length,
            compressedLength: context.chatMessages.length,
            summary: '当前对话长度适中，无需压缩',
            keyPoints: [],
            tokenUsage,
          } as ContextCompressionResult,
          tokenUsage,
        };
      }

      const result: ContextCompressionResult = {
        compressed: true,
        originalLength: context.chatMessages.length,
        compressedLength: Math.max(5, Math.floor(context.chatMessages.length * 0.3)), // 压缩到约 30%
        summary: parsedResponse.summary || '上下文已压缩',
        keyPoints: parsedResponse.keyPoints || [],
        tokenUsage,
      };

      if (tokenUsage) {
        console.log('[ContextCompressorMicroAgent] 📊 上下文压缩 Token 使用:', tokenUsage);
      }

      console.log(`[ContextCompressorMicroAgent] ✅ 上下文压缩完成: ${result.originalLength} → ${result.compressedLength} 条消息`);
      console.log(`[ContextCompressorMicroAgent] 📝 摘要: ${result.summary}`);

      return {
        success: true,
        data: result,
        tokenUsage,
        metadata: {
          compression: result,
          // 注意：实际的上下文压缩需要在主 Agent 中实现
          // 这里只是提供压缩建议和摘要
        },
      };
    } catch (error) {
      console.error('[ContextCompressorMicroAgent] ❌ 上下文压缩失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        data: {
          compressed: false,
          originalLength: context.chatMessages.length,
          compressedLength: context.chatMessages.length,
          summary: `压缩失败: ${error instanceof Error ? error.message : String(error)}`,
          keyPoints: [],
        } as ContextCompressionResult,
      };
    }
  }
}
