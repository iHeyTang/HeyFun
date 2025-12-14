/**
 * 意图检测微代理
 *
 * 使用 LLM 分析用户消息，理解用户意图，判断需要哪些提示词片段
 * 实现动态提示词机制：只在需要时才加载相关片段
 */

import type { UnifiedChat } from '@repo/llm/chat';
import type { IMicroAgent, MicroAgentConfig, MicroAgentContext, MicroAgentResult } from './types';
import { MicroAgentTrigger } from './types';
import { prisma } from '@/lib/server/prisma';

/**
 * 意图检测结果
 */
export interface DetectedIntent {
  fragmentIds: string[]; // 需要的片段 ID 列表
  confidence: number; // 检测置信度 (0-1)
  reasons: string[]; // 检测原因说明
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
 * 构建意图分类的提示词
 */
async function buildIntentClassificationPrompt(messages: UnifiedChat.Message[]): Promise<string> {
  const recentMessages = messages.slice(-5);
  const conversationContext = recentMessages
    .map(msg => {
      const text = extractMessageText(msg.content);
      if (!text) return '';
      const role = msg.role === 'user' ? '用户' : msg.role === 'assistant' ? '助手' : '系统';
      return `${role}: ${text}`;
    })
    .filter(line => line.length > 0)
    .join('\n');

  const availableFragments = await prisma.systemPromptSnippets.findMany({
    where: { enabled: true },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });

  const fragmentsList = availableFragments.map((f, idx) => `${idx + 1}. ${f.id} (${f.name}): ${f.description}`).join('\n');

  return `你是一个意图分析助手。请分析以下对话上下文，判断用户当前或接下来可能需要哪些特殊能力。

## 可用能力列表

### 提示词片段（特殊语法支持）

${fragmentsList}

## 对话上下文

${conversationContext || '(无上下文)'}

## 分析要求

1. 仔细理解用户的真实意图，不要只看表面关键词
2. 考虑对话的发展趋势，用户接下来可能需要什么能力
3. 如果用户明确提到或暗示需要某种能力，必须包含对应的片段 ID
4. 如果对话是普通对话，不需要特殊能力，返回空数组

## 输出格式

请以 JSON 格式输出，包含以下字段：
- fragmentIds: string[] - 需要的片段 ID 数组（如果没有需要的能力，返回空数组 []）
- reasoning: string - 你的分析理由（简短说明为什么需要这些能力）

示例输出：
{
  "fragmentIds": ["map-syntax"],
  "reasoning": "用户询问路线规划，需要地图展示能力"
}

或：
{
  "fragmentIds": [],
  "reasoning": "普通对话，不需要特殊能力"
}

请直接输出 JSON，不要添加其他说明文字。`;
}

/**
 * 意图检测微代理
 */
export class IntentDetectorMicroAgent implements IMicroAgent {
  readonly config: MicroAgentConfig;

  constructor(options?: { enabled?: boolean; priority?: number }) {
    this.config = {
      id: 'intent-detector',
      name: '意图检测微代理',
      description: '分析用户消息，检测需要的提示词片段',
      trigger: [MicroAgentTrigger.INITIALIZATION, MicroAgentTrigger.PRE_ITERATION],
      enabled: options?.enabled !== false,
      priority: options?.priority ?? 10, // 高优先级，应该在其他微代理之前执行
    };
  }

  async shouldExecute(context: MicroAgentContext): Promise<boolean> {
    // 检查是否有用户消息
    const hasUserMessage = context.messages.some(msg => {
      if (msg.role === 'user') {
        const text = extractMessageText(msg.content);
        return text.trim().length > 0;
      }
      return false;
    });

    return hasUserMessage;
  }

  async execute(context: MicroAgentContext): Promise<MicroAgentResult> {
    try {
      // 如果没有 LLM 客户端，返回空结果
      if (!context.llmClient) {
        console.log('[IntentDetectorMicroAgent] ⚠️ 没有 LLM 客户端，跳过意图检测');
        return {
          success: true,
          data: {
            fragmentIds: [],
            confidence: 0,
            reasons: ['没有 LLM 客户端，跳过检测'],
          } as DetectedIntent,
        };
      }

      // 构建意图分类提示词
      const prompt = await buildIntentClassificationPrompt(context.messages);

      console.log('[IntentDetectorMicroAgent] 📝 开始意图检测');

      // 调用 LLM 进行意图分析
      const response = await context.llmClient.chat({
        messages: [
          {
            role: 'system',
            content: '你是一个专业的意图分析助手，擅长理解用户真实需求。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 200,
      });

      // 从 choices 中提取内容
      const content = response.choices?.[0]?.message?.content || '';
      const responseText = typeof content === 'string' ? content : JSON.stringify(content);

      // 提取 token 使用信息
      const tokenUsage = response.usage
        ? {
            promptTokens: response.usage.prompt_tokens || 0,
            completionTokens: response.usage.completion_tokens || 0,
            totalTokens: response.usage.total_tokens || 0,
            cost: 0, // 成本计算在其他地方处理
          }
        : undefined;

      // 解析 JSON 响应
      let parsedResponse: { fragmentIds: string[]; reasoning: string };
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
          if (!parsedResponse.fragmentIds) {
            parsedResponse.fragmentIds = [];
          }
        } else {
          throw new Error('未找到 JSON 格式');
        }
      } catch (parseError) {
        console.warn('[IntentDetectorMicroAgent] ⚠️ 解析 LLM 响应失败，使用空结果:', parseError);
        return {
          success: true, // 即使解析失败，也返回成功，但使用空结果
          data: {
            fragmentIds: [],
            confidence: 0,
            reasons: ['LLM 响应解析失败'],
            tokenUsage,
          } as DetectedIntent,
          tokenUsage,
        };
      }

      // 验证片段 ID 是否有效
      const availableFragments = await prisma.systemPromptSnippets.findMany({
        where: { enabled: true },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        select: { id: true },
      });

      const validFragmentIds = (parsedResponse.fragmentIds || []).filter(id => availableFragments.some(f => f.id === id));

      // 计算置信度
      const confidence = validFragmentIds.length > 0 ? 0.8 : 0.2;

      const intent: DetectedIntent = {
        fragmentIds: validFragmentIds,
        confidence,
        reasons: [parsedResponse.reasoning || 'LLM 意图分析'],
        tokenUsage,
      };

      if (tokenUsage) {
        console.log('[IntentDetectorMicroAgent] 📊 意图检测 Token 使用:', tokenUsage);
      }

      if (validFragmentIds.length > 0) {
        console.log(`[IntentDetectorMicroAgent] ✅ 检测到需要的片段: ${validFragmentIds.join(', ')}`);
      }

      return {
        success: true,
        data: intent,
        tokenUsage,
        shouldUpdateSystemPrompt: validFragmentIds.length > 0,
        metadata: {
          intent,
        },
      };
    } catch (error) {
      console.error('[IntentDetectorMicroAgent] ❌ 意图检测失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        data: {
          fragmentIds: [],
          confidence: 0,
          reasons: [`检测失败: ${error instanceof Error ? error.message : String(error)}`],
        } as DetectedIntent,
      };
    }
  }
}
