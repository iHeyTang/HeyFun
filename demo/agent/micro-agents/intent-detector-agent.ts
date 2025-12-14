/**
 * 意图检测微代理
 *
 * 使用 LLM 分析用户消息，理解用户意图，判断需要哪些提示词片段和 MCP 工具
 * 实现动态提示词机制：只在需要时才加载相关片段
 */

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { gatewayService } from '../../llm/services/gateway';
import type { ChatMessage } from '../../llm/types/chat';
import { mcpService } from '../../mcp/service';
import { getAllFragments } from '../snippets';
import type { IMicroAgent, MicroAgentConfig, MicroAgentContext, MicroAgentResult } from './types';
import { MicroAgentTrigger } from './types';

/**
 * 意图检测结果（与原来的 DetectedIntent 兼容）
 */
export interface DetectedIntent {
  fragmentIds: string[]; // 需要的片段 ID 列表
  mcpToolTypes: string[]; // 需要的 MCP 工具类型列表
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
 * 获取所有可用的提示词片段列表
 */
function getAvailableFragments() {
  return getAllFragments().map((f) => ({
    id: f.id,
    name: f.name,
    description: f.description,
  }));
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
 * 构建意图分类的提示词
 */
function buildIntentClassificationPrompt(messages: ChatMessage[]): string {
  const recentMessages = messages.slice(-5);
  const conversationContext = recentMessages
    .map((msg) => {
      const text = extractMessageText(msg.content);
      if (!text) return '';
      const role = msg.role === 'user' ? '用户' : msg.role === 'assistant' ? '助手' : '系统';
      return `${role}: ${text}`;
    })
    .filter((line) => line.length > 0)
    .join('\n');

  const availableFragments = getAvailableFragments();
  const availableMcpTools = mcpService.getAvailableMcpTools();

  const fragmentsList = availableFragments.map((f, idx) => `${idx + 1}. ${f.id} (${f.name}): ${f.description}`).join('\n');
  const mcpToolsList = availableMcpTools.map((t, idx) => `${idx + 1}. ${t.type} (${t.name}): ${t.description}`).join('\n');

  return `你是一个意图分析助手。请分析以下对话上下文，判断用户当前或接下来可能需要哪些特殊能力。

## 可用能力列表

### 提示词片段（特殊语法支持）

${fragmentsList}

### MCP 工具（功能能力）

${mcpToolsList}

## 对话上下文

${conversationContext || '(无上下文)'}

## 分析要求

1. 仔细理解用户的真实意图，不要只看表面关键词
2. 考虑对话的发展趋势，用户接下来可能需要什么能力
3. 如果用户明确提到或暗示需要某种能力，必须包含对应的片段 ID 或 MCP 工具类型
4. 如果对话是普通对话，不需要特殊能力，返回空数组
5. 片段和工具可以同时需要，例如：需要地图展示（map-syntax）时，通常也需要高德地图工具（amap）

## 输出格式

请以 JSON 格式输出，包含以下字段：
- fragmentIds: string[] - 需要的片段 ID 数组（如果没有需要的能力，返回空数组 []）
- mcpToolTypes: string[] - 需要的 MCP 工具类型数组（如果没有需要的工具，返回空数组 []）
- reasoning: string - 你的分析理由（简短说明为什么需要这些能力）

示例输出：
{
  "fragmentIds": ["map-syntax"],
  "mcpToolTypes": ["amap"],
  "reasoning": "用户询问路线规划，需要地图展示能力和高德地图工具"
}

或：
{
  "fragmentIds": ["knowledge-citation"],
  "mcpToolTypes": ["knowledge"],
  "reasoning": "用户询问文档内容，需要知识库引用语法和知识库工具"
}

或：
{
  "fragmentIds": [],
  "mcpToolTypes": [],
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
      description: '分析用户消息，检测需要的提示词片段和 MCP 工具',
      trigger: [MicroAgentTrigger.INITIALIZATION, MicroAgentTrigger.PRE_ITERATION],
      enabled: options?.enabled !== false,
      priority: options?.priority ?? 10, // 高优先级，应该在其他微代理之前执行
    };
  }

  async shouldExecute(context: MicroAgentContext): Promise<boolean> {
    // 意图检测微代理应该在每次迭代时都执行（PRE_ITERATION），以便动态检测是否需要新的工具和片段
    // 只要对话历史中有任何用户消息，就应该执行

    // 优先检查 chatMessages 中是否有用户消息
    const hasTextContentInChatMessages = context.chatMessages.some((msg) => {
      if (msg.role === 'user') {
        const text = extractMessageText(msg.content);
        return text.trim().length > 0;
      }
      return false;
    });

    if (hasTextContentInChatMessages) {
      return true;
    }

    // 如果 chatMessages 中没有用户消息，检查 messages（BaseMessage 数组）中是否有 HumanMessage
    // 这在迭代过程中很有用，因为最近的消息可能只有助手或工具消息
    if (context.messages && context.messages.length > 0) {
      const hasHumanMessage = context.messages.some((msg) => {
        if (msg instanceof HumanMessage) {
          const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
          return content.trim().length > 0;
        }
        return false;
      });

      if (hasHumanMessage) {
        return true;
      }
    }

    // 如果都没有，说明对话历史为空，不应该执行
    return false;
  }

  async execute(context: MicroAgentContext): Promise<MicroAgentResult> {
    try {
      // 构建意图分类提示词
      const prompt = buildIntentClassificationPrompt(context.chatMessages);

      // 创建 LLM 实例
      const llm = gatewayService.createLLM(context.agentConfig.modelId, {
        temperature: 0.1,
        maxTokens: 200,
      });

      // 调用 LLM 进行意图分析
      const response = await llm.invoke([new SystemMessage('你是一个专业的意图分析助手，擅长理解用户真实需求。'), new HumanMessage(prompt)]);

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

        if (response.usage_metadata) {
          return {
            promptTokens: response.usage_metadata.input_tokens ?? 0,
            completionTokens: response.usage_metadata.output_tokens ?? 0,
            totalTokens: response.usage_metadata.total_tokens ?? 0,
            cost: 0,
          };
        }

        return undefined;
      };

      const tokenUsage = extractTokenUsage(response);

      // 解析 JSON 响应
      let parsedResponse: { fragmentIds: string[]; mcpToolTypes: string[]; reasoning: string };
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
          if (!parsedResponse.mcpToolTypes) {
            parsedResponse.mcpToolTypes = [];
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
            mcpToolTypes: [],
            confidence: 0,
            reasons: ['LLM 响应解析失败'],
            tokenUsage,
          } as DetectedIntent,
          tokenUsage,
        };
      }

      // 验证片段 ID 是否有效
      const availableFragments = getAvailableFragments();
      const validFragmentIds = (parsedResponse.fragmentIds || []).filter((id) => availableFragments.some((f) => f.id === id));

      // 验证 MCP 工具类型是否有效
      const availableMcpTools = mcpService.getAvailableMcpTools();
      const validMcpToolTypes = (parsedResponse.mcpToolTypes || []).filter((type) => availableMcpTools.some((t) => t.type === type));

      // 计算置信度
      const confidence = validFragmentIds.length > 0 || validMcpToolTypes.length > 0 ? 0.8 : 0.2;

      const intent: DetectedIntent = {
        fragmentIds: validFragmentIds,
        mcpToolTypes: validMcpToolTypes,
        confidence,
        reasons: [parsedResponse.reasoning || 'LLM 意图分析'],
        tokenUsage,
      };

      if (tokenUsage) {
        console.log('[IntentDetectorMicroAgent] 📊 意图检测 Token 使用:', tokenUsage);
      }

      return {
        success: true,
        data: intent,
        tokenUsage,
        shouldUpdateSystemPrompt: validFragmentIds.length > 0 || validMcpToolTypes.length > 0,
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
          mcpToolTypes: [],
          confidence: 0,
          reasons: [`检测失败: ${error instanceof Error ? error.message : String(error)}`],
        } as DetectedIntent,
      };
    }
  }
}

/**
 * 向后兼容：导出原来的 detectIntent 函数
 * 这个函数现在内部使用微代理实现
 */
export async function detectIntent(messages: ChatMessage[], modelId: string): Promise<DetectedIntent> {
  const agent = new IntentDetectorMicroAgent();
  const context: MicroAgentContext = {
    messages: [],
    chatMessages: messages,
    agentConfig: {
      modelId,
    },
  };

  const result = await agent.execute(context);

  if (result.success && result.data) {
    return result.data as DetectedIntent;
  }

  // 失败时返回空结果
  return {
    fragmentIds: [],
    mcpToolTypes: [],
    confidence: 0,
    reasons: [result.error || '检测失败'],
    tokenUsage: result.tokenUsage,
  };
}
