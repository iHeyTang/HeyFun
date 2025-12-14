/**
 * 个性化推荐微代理
 *
 * 基于用户偏好和历史行为，提供个性化推荐
 * 适用于各种推荐场景（内容、产品、服务等）
 */

import type { IMicroAgent, MicroAgentContext, MicroAgentResult, MicroAgentConfig } from './types';
import { MicroAgentTrigger } from './types';
import type { ChatMessage } from '../../llm/types/chat';
import { gatewayService } from '../../llm/services/gateway';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { mcpService } from '../../mcp/service';

/**
 * 个性化推荐结果
 */
export interface PersonalizedRecommendationResult {
  hasRecommendation: boolean; // 是否需要推荐
  recommendationType?: 'content' | 'product' | 'service' | 'activity' | 'other';
  userPreferences?: string[]; // 用户偏好标签
  recommendationContext?: string; // 推荐上下文
  suggestions?: string[]; // 推荐建议
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
 * 检查是否需要个性化推荐
 */
function needsPersonalizedRecommendation(context: MicroAgentContext): boolean {
  const recentMessages = context.chatMessages.slice(-3);
  const messageText = recentMessages
    .map((msg) => extractMessageText(msg.content))
    .join(' ')
    .toLowerCase();

  const recommendationKeywords = [
    '推荐',
    '建议',
    '适合',
    '选择',
    '哪个好',
    '什么好',
    '推荐一下',
    '给我推荐',
    '帮我选',
    '应该选',
    'recommend',
    'suggest',
    'which',
    'what',
    'choose',
  ];

  return recommendationKeywords.some((keyword) => messageText.includes(keyword));
}

/**
 * 从 Memory 获取用户偏好
 */
async function getUserPreferences(_context: MicroAgentContext): Promise<string[]> {
  try {
    // 尝试从 Memory MCP 获取用户偏好
    const memoryTools = mcpService.getToolsFromServerIds(['memory']);
    if (memoryTools.length === 0) {
      return [];
    }

    const searchMemoryTool = memoryTools.find((tool) => tool.name === 'search_memories');
    if (!searchMemoryTool) {
      return [];
    }

    // 搜索用户偏好相关的记忆
    const result = await searchMemoryTool.invoke({
      query: '用户偏好 兴趣 爱好 喜欢',
      user_id: 'default_user',
      limit: 5,
    });

    if (result && Array.isArray(result)) {
      // 从记忆内容中提取偏好标签
      const preferences: string[] = [];
      result.forEach((memory: any) => {
        if (memory.content) {
          // 简单提取关键词作为偏好标签
          const content = String(memory.content).toLowerCase();
          const commonPreferences = ['科技', '艺术', '运动', '音乐', '阅读', '旅行', '美食', '电影', '游戏', '摄影'];
          commonPreferences.forEach((pref) => {
            if (content.includes(pref.toLowerCase())) {
              preferences.push(pref);
            }
          });
        }
      });
      return [...new Set(preferences)]; // 去重
    }

    return [];
  } catch (error) {
    console.warn('[PersonalizedRecommendationAgent] 获取用户偏好失败:', error);
    return [];
  }
}

/**
 * 构建个性化推荐提示词
 */
async function buildRecommendationPrompt(context: MicroAgentContext): Promise<string> {
  const recentMessages = context.chatMessages.slice(-5);
  const conversationContext = recentMessages
    .map((msg) => {
      const text = extractMessageText(msg.content);
      if (!text) return '';
      const role = msg.role === 'user' ? '用户' : msg.role === 'assistant' ? '助手' : '系统';
      return `${role}: ${text}`;
    })
    .filter((line) => line.length > 0)
    .join('\n');

  // 获取用户偏好
  const userPreferences = await getUserPreferences(context);

  return `你是一个个性化推荐助手。请分析以下对话，判断用户是否需要个性化推荐，如果需要，请提供推荐建议。

## 对话上下文

${conversationContext || '(无上下文)'}

${
  userPreferences.length > 0
    ? `## 用户偏好（从历史记录中提取）

${userPreferences.join('、')}
`
    : ''
}

## 分析要求

1. 判断用户是否在寻求推荐（产品、内容、服务、活动等）
2. 如果不需要推荐，返回 hasRecommendation: false
3. 如果需要推荐，分析推荐类型和上下文
4. 基于用户偏好（如果有）和对话上下文，提供个性化推荐建议

## 推荐类型

- "content": 内容推荐（文章、视频、书籍等）
- "product": 产品推荐（商品、工具等）
- "service": 服务推荐（服务提供商、平台等）
- "activity": 活动推荐（活动、体验等）
- "other": 其他推荐

## 输出格式

请以 JSON 格式输出，包含以下字段：
- hasRecommendation: boolean - 是否需要推荐
- recommendationType: string - 推荐类型（如果不需要则为 null）
- userPreferences: string[] - 用户偏好标签（从对话中提取）
- recommendationContext: string - 推荐上下文（用户的需求描述）
- suggestions: string[] - 推荐建议列表（3-5 条）

示例输出（需要推荐）：
{
  "hasRecommendation": true,
  "recommendationType": "content",
  "userPreferences": ["科技", "阅读"],
  "recommendationContext": "用户想找一些关于人工智能的书籍",
  "suggestions": [
    "《人工智能：一种现代方法》- 经典教材",
    "《深度学习》- 技术深度",
    "《AI未来》- 通俗易懂"
  ]
}

示例输出（不需要推荐）：
{
  "hasRecommendation": false,
  "recommendationType": null,
  "userPreferences": [],
  "recommendationContext": "",
  "suggestions": []
}

请直接输出 JSON，不要添加其他说明文字。`;
}

/**
 * 个性化推荐微代理
 */
export class PersonalizedRecommendationMicroAgent implements IMicroAgent {
  readonly config: MicroAgentConfig;

  constructor(options?: { enabled?: boolean; priority?: number }) {
    this.config = {
      id: 'personalized-recommendation',
      name: '个性化推荐',
      description: '基于用户偏好提供个性化推荐',
      trigger: MicroAgentTrigger.PRE_ITERATION,
      enabled: options?.enabled !== false,
      priority: options?.priority ?? 20, // 中等优先级
    };
  }

  async shouldExecute(context: MicroAgentContext): Promise<boolean> {
    // 检查是否需要个性化推荐
    return needsPersonalizedRecommendation(context);
  }

  async execute(context: MicroAgentContext): Promise<MicroAgentResult> {
    try {
      // 构建推荐提示词
      const prompt = await buildRecommendationPrompt(context);

      // 创建 LLM 实例
      const llm = gatewayService.createLLM(context.agentConfig.modelId, {
        temperature: 0.7, // 稍高温度，增加推荐多样性
        maxTokens: 500,
      });

      // 调用 LLM 进行推荐分析
      const response = await llm.invoke([
        new SystemMessage('你是一个专业的个性化推荐助手，擅长理解用户需求并提供个性化推荐。'),
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
        hasRecommendation: boolean;
        recommendationType: string | null;
        userPreferences: string[];
        recommendationContext: string;
        suggestions: string[];
      };

      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('未找到 JSON 格式');
        }
      } catch (parseError) {
        console.warn('[PersonalizedRecommendationMicroAgent] ⚠️ 解析 LLM 响应失败:', parseError);
        return {
          success: true,
          data: {
            hasRecommendation: false,
            userPreferences: [],
            suggestions: [],
            tokenUsage,
          } as PersonalizedRecommendationResult,
          tokenUsage,
        };
      }

      // 如果不需要推荐，直接返回
      if (!parsedResponse.hasRecommendation) {
        return {
          success: true,
          data: {
            hasRecommendation: false,
            userPreferences: [],
            suggestions: [],
            tokenUsage,
          } as PersonalizedRecommendationResult,
          tokenUsage,
        };
      }

      const result: PersonalizedRecommendationResult = {
        hasRecommendation: true,
        recommendationType: (parsedResponse.recommendationType as any) || 'other',
        userPreferences: parsedResponse.userPreferences || [],
        recommendationContext: parsedResponse.recommendationContext || '',
        suggestions: parsedResponse.suggestions || [],
        tokenUsage,
      };

      if (tokenUsage) {
        console.log('[PersonalizedRecommendationMicroAgent] 📊 个性化推荐 Token 使用:', tokenUsage);
      }

      console.log(`[PersonalizedRecommendationMicroAgent] ✅ 生成个性化推荐: ${result.recommendationType}`);
      console.log(`  用户偏好: ${result.userPreferences?.join('、') || '无'}`);
      console.log(`  推荐建议: ${result.suggestions?.length || 0} 条`);

      return {
        success: true,
        data: result,
        tokenUsage,
        metadata: {
          recommendation: result,
        },
      };
    } catch (error) {
      console.error('[PersonalizedRecommendationMicroAgent] ❌ 个性化推荐失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        data: {
          hasRecommendation: false,
          userPreferences: [],
          suggestions: [],
        } as PersonalizedRecommendationResult,
      };
    }
  }
}
