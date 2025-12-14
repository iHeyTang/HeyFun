/**
 * ReAct Agent
 *
 * 实现真正的 ReAct (Reasoning + Acting) 框架
 * 显式的 Thought-Action-Observation 循环
 */

import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, HumanMessage, SystemMessage, ToolCall, ToolMessage, type BaseMessage } from '@langchain/core/messages';
import type { DynamicStructuredTool } from '@langchain/core/tools';
import { gatewayService } from '../../llm/services/gateway';
import type { ChatMessage } from '../../llm/types/chat';
import { mcpService } from '../../mcp/service';
import { IntentDetectorMicroAgent, microAgentManager, MicroAgentTrigger, type DetectedIntent, type MicroAgentContext } from '../micro-agents';
import { CodeQualityMicroAgent } from '../micro-agents/code-quality-agent';
import { ContextCompressorMicroAgent } from '../micro-agents/context-compressor-agent';
import { PerformanceMicroAgent } from '../micro-agents/performance-agent';
import { PersonalizedRecommendationMicroAgent } from '../micro-agents/personalized-recommendation-agent';
import { SecurityMicroAgent } from '../micro-agents/security-agent';
import { buildFragmentsPromptByIds } from '../snippets';
import { AgentConfig } from '../types';

export interface ReActStreamChunk {
  type: 'thought' | 'action' | 'observation' | 'final_answer';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, any>;
  toolResult?: string;
  isError?: boolean;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cost?: number;
  };
}

/**
 * Function Calling Agent - 使用 LLM 原生工具调用能力
 */
export class ReActAgent {
  private config: AgentConfig;
  private llm: BaseChatModel; // LLM with bound tools
  private baseLLM: BaseChatModel; // 未绑定工具的基础 LLM
  private langchainTools: DynamicStructuredTool[];
  private toolNameSet: Set<string>; // 已绑定工具的名称集合，用于去重

  constructor(config: AgentConfig, langchainTools: DynamicStructuredTool[]) {
    this.config = config;
    this.langchainTools = [...langchainTools]; // 复制数组
    this.toolNameSet = new Set(langchainTools.map((t) => t.name));

    // 初始化微代理（如果还没有注册意图检测微代理，则注册它）
    this.initializeMicroAgents();

    // 创建基础 LLM
    this.baseLLM = gatewayService.createLLM(config.modelId, {
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });

    // 绑定工具到 LLM（使用原生 Function Calling）
    if (typeof this.baseLLM.bindTools !== 'function') {
      console.error(`[FunctionCallingAgent] ❌ 模型不支持 bindTools 方法`);
      throw new Error(`不支持 Function Calling 的模型: ${config.modelId}`);
    }

    try {
      this.llm = this.baseLLM.bindTools(this.langchainTools) as BaseChatModel;
      console.log(`[FunctionCallingAgent] ✅ 已绑定 ${this.langchainTools.length} 个工具到 LLM`);
    } catch (error) {
      console.error(`[FunctionCallingAgent] ❌ 绑定工具失败:`, error);
      throw new Error(`绑定工具失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 初始化微代理
   */
  private initializeMicroAgents(): void {
    // 如果意图检测微代理还没有注册，则注册它
    if (!microAgentManager.getAgent('intent-detector')) {
      const intentDetectorAgent = new IntentDetectorMicroAgent();
      microAgentManager.register(intentDetectorAgent);
      console.log('[ReActAgent] ✅ 已注册意图检测微代理');
    }

    // 注册代码质量检测微代理
    if (!microAgentManager.getAgent('code-quality')) {
      const codeQualityAgent = new CodeQualityMicroAgent();
      microAgentManager.register(codeQualityAgent);
      console.log('[ReActAgent] ✅ 已注册代码质量检测微代理');
    }

    // 注册上下文压缩微代理
    if (!microAgentManager.getAgent('context-compressor')) {
      const contextCompressorAgent = new ContextCompressorMicroAgent();
      microAgentManager.register(contextCompressorAgent);
      console.log('[ReActAgent] ✅ 已注册上下文压缩微代理');
    }

    // 注册安全检测微代理
    if (!microAgentManager.getAgent('security-check')) {
      const securityAgent = new SecurityMicroAgent();
      microAgentManager.register(securityAgent);
      console.log('[ReActAgent] ✅ 已注册安全检测微代理');
    }

    // 注册性能分析微代理
    if (!microAgentManager.getAgent('performance-analysis')) {
      const performanceAgent = new PerformanceMicroAgent();
      microAgentManager.register(performanceAgent);
      console.log('[ReActAgent] ✅ 已注册性能分析微代理');
    }

    // 注册个性化推荐微代理
    if (!microAgentManager.getAgent('personalized-recommendation')) {
      const recommendationAgent = new PersonalizedRecommendationMicroAgent();
      microAgentManager.register(recommendationAgent);
      console.log('[ReActAgent] ✅ 已注册个性化推荐微代理');
    }
  }

  /**
   * 构建动态的系统提示词（用于 Function Calling）
   * @param fragmentIds 可选的片段 ID 列表，用于动态组装提示词
   * @param mcpToolTypes 可选的 MCP 工具类型列表，用于动态组装 MCP 工具提示词
   */
  private buildSystemPrompt(fragmentIds?: string[], mcpToolTypes?: string[]): string {
    const systemPrompt = this.config.systemPrompt || 'You are a helpful assistant.';

    // 构建基础约束
    let prompt = `${systemPrompt}

## 核心约束

你是一个无状态的代理系统，不具备任何持久化记忆能力。所有信息的获取必须通过工具调用完成。

### 信息获取原则

1. **外部依赖性**: 任何超出当前对话上下文的信息，必须通过工具查询获得
2. **禁止推测**: 不得基于训练数据或常识给出未经验证的答案
3. **语言准确性**: 禁止使用"我记得"、"根据我的了解"等暗示持久记忆的表述

### 个性化查询协议

当用户查询涉及以下特征时，必须优先执行记忆系统查询：

**触发条件**（满足任一即触发）：
- 查询主体为用户本人（包含"我"、"我的"、"我们"等第一人称）
- 涉及用户偏好、习惯、历史行为的推断需求
- 需要个性化建议或推荐的场景

**执行流程**：
1. 解析查询意图，识别个性化特征
2. 使用可用的工具查询相关信息（工具会自动调用）
3. 评估工具返回结果的相关性，筛选有效信息
4. 基于工具返回的内容生成个性化回答
5. 若工具返回空结果或不相关，明确说明并提供通用方案

**示例**：
- 查询："推荐一个餐厅" → 先查询用户饮食偏好、地理位置等记忆
- 查询："我之前的配置是什么" → 直接查询历史配置记忆
- 查询："Python怎么写循环" → 无需查询，属于通用知识（但仍需通过代码工具验证）`;

    // 动态添加 MCP 工具使用说明（根据意图检测结果）
    const toolsToUse = mcpToolTypes && mcpToolTypes.length > 0 ? mcpToolTypes : this.config.mcpTools;
    if (toolsToUse && toolsToUse.length > 0) {
      // 构建工具提示词
      const mcpToolsPrompt = mcpService.buildMCPToolsPrompt(toolsToUse);
      if (mcpToolsPrompt) {
        prompt += mcpToolsPrompt;
      }
    }

    // 动态添加提示词片段（根据场景需求）
    if (fragmentIds && fragmentIds.length > 0) {
      const fragmentsPrompt = buildFragmentsPromptByIds(fragmentIds);
      if (fragmentsPrompt) {
        prompt += fragmentsPrompt;
      }
    }

    // 添加通用指导（注意：不要描述如何调用工具，Function Calling 会自动处理）
    prompt += `

## 工具使用策略

### 何时使用工具
- 信息缺失：当前上下文无法满足查询需求时，使用工具获取信息
- 验证需求：需要确认或更新动态信息时，使用工具查询
- 个性化需求：查询涉及用户特定信息时，使用工具查询相关记忆

### 工具使用原则
1. **主动使用**: 当需要外部信息时，主动使用可用的工具
2. **结果处理**: 基于工具返回结果生成回答，避免添加未验证的推测
3. **失败处理**: 工具调用失败或返回空结果时，明确告知用户并说明原因
4. **链式使用**: 复杂查询可能需要使用多个工具，按需顺序或并行使用

### 知识库工具使用策略

**重要**：当用户询问文档内容、需要引用参考资料、或提到"文档"、"资料"、"参考"等关键词时，**必须优先使用Knowledge工具搜索知识库**。不要基于训练数据回答，必须通过search_knowledge工具查询用户上传的文档内容。

**search_knowledge 工具**：
- **触发条件**：用户询问文档内容、提到"文档"、"资料"、"参考"等关键词时，必须使用此工具
- 返回的是与查询最相关的文档片段，每个片段包含完整的内容、文件信息、位置信息
- **大多数情况下，返回的片段已经足够回答问题，无需再调用 get_file**
- 优先基于 search_knowledge 返回的片段内容生成回答
- **使用流程**：如果不确定知识库ID，先调用 list_knowledge_bases 获取知识库列表，然后调用 search_knowledge 搜索

**get_file 工具**：
- **严格限制**：这是一个高成本操作，必须谨慎使用
- **调用前必须明确说明原因**，且原因必须符合以下条件之一：
  1. 需要查看文档的整体结构、目录或大纲（必须明确说明需要什么结构信息）
  2. 需要对比文档中多个不相关的部分（必须明确说明要对比哪些部分）
  3. search_knowledge 返回的片段内容明显不完整，导致无法准确回答（必须明确说明片段缺少什么信息）
  4. 用户明确要求查看完整文档
- **默认策略**：优先使用 search_knowledge 返回的片段，只有在片段确实无法满足需求时才考虑调用 get_file
- **如果无法给出明确的、符合上述条件的理由，则不应调用此工具**

**判断流程**：
1. 先使用 search_knowledge 搜索相关内容
2. 仔细评估返回的片段是否足够回答问题
3. 如果片段足够，直接基于片段回答，**不要调用 get_file**
4. 只有在片段确实不完整或需要全文结构时，**先明确说明原因**，再调用 get_file

**重要**: 工具调用由系统自动处理，你只需要在需要时使用工具即可，无需描述调用过程。`;

    return prompt;
  }

  /**
   * 动态检测并激活需要的提示词片段和 MCP 工具
   * 在每次迭代前调用，根据当前对话上下文判断是否需要新能力
   * 返回新激活的片段 ID 列表、MCP 工具类型列表和 token 使用情况
   */
  private async detectAndActivateFragments(
    messages: BaseMessage[],
    activatedFragments: Set<string>,
    activatedMcpTools: Set<string>
  ): Promise<{ newFragments: string[]; newMcpTools: string[]; tokenUsage?: DetectedIntent['tokenUsage']; intent?: DetectedIntent }> {
    // 将 BaseMessage 转换为 ChatMessage 格式用于意图检测
    const chatMessages: ChatMessage[] = [];

    // 只看最近 5 条消息
    for (const msg of messages.slice(-5)) {
      if (msg instanceof HumanMessage) {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        chatMessages.push({ role: 'user', content });
      } else if (msg instanceof AIMessage) {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        chatMessages.push({ role: 'assistant', content });
      }
      // 忽略 SystemMessage 和 ToolMessage，因为它们不是对话的一部分
    }

    if (chatMessages.length === 0) {
      return { newFragments: [], newMcpTools: [] };
    }

    // 构建微代理执行上下文
    const context: MicroAgentContext = {
      messages,
      chatMessages,
      agentConfig: {
        modelId: this.config.modelId,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
      },
      activatedFragments,
      activatedMcpTools,
    };

    // 使用微代理管理器执行意图检测微代理
    const results = await microAgentManager.executeByTrigger(MicroAgentTrigger.PRE_ITERATION, context);

    // 查找意图检测微代理的结果
    let intent: DetectedIntent | undefined;
    let totalTokenUsage: DetectedIntent['tokenUsage'] | undefined;

    for (const result of results) {
      if (result.success && result.data && result.metadata?.intent) {
        intent = result.metadata.intent as DetectedIntent;
        if (result.tokenUsage) {
          totalTokenUsage = result.tokenUsage;
        }
        break;
      }
    }

    // 如果没有找到意图检测结果，使用空结果
    if (!intent) {
      return { newFragments: [], newMcpTools: [] };
    }

    // 找出新需要的片段（还未激活的）
    const newFragments = intent.fragmentIds.filter((id) => !activatedFragments.has(id));

    // 找出新需要的 MCP 工具（还未激活的）
    const newMcpTools = intent.mcpToolTypes.filter((type) => !activatedMcpTools.has(type));

    // 记录新激活的片段和工具
    newFragments.forEach((id) => activatedFragments.add(id));
    newMcpTools.forEach((type) => activatedMcpTools.add(type));

    if (newFragments.length > 0 || newMcpTools.length > 0) {
      console.log(`[ReActAgent] 🎯 检测到新能力需求:`, {
        newFragments,
        newMcpTools,
        reasoning: intent.reasons,
        confidence: intent.confidence,
        tokenUsage: intent.tokenUsage,
      });
    }

    return { newFragments, newMcpTools, tokenUsage: totalTokenUsage || intent.tokenUsage, intent };
  }

  /**
   * 动态绑定新工具到 LLM
   * 当检测到需要新工具时，将新工具添加到工具列表并重新绑定
   */
  private bindNewTools(mcpToolTypes: string[]): void {
    if (mcpToolTypes.length === 0) {
      return;
    }

    // 从全局 MCP 服务获取工具
    const newTools = mcpService.getTools(mcpToolTypes);

    // 过滤出尚未绑定的工具
    const toolsToAdd = newTools.filter((tool) => !this.toolNameSet.has(tool.name));

    if (toolsToAdd.length === 0) {
      console.log(`[ReActAgent] 所有需要的工具已经绑定`);
      return;
    }

    // 添加新工具到工具列表
    this.langchainTools.push(...toolsToAdd);
    toolsToAdd.forEach((tool) => this.toolNameSet.add(tool.name));

    console.log(`[ReActAgent] 🔧 动态添加 ${toolsToAdd.length} 个新工具:`, toolsToAdd.map((t) => t.name).join(', '));

    // 重新绑定所有工具到 LLM
    if (typeof this.baseLLM.bindTools !== 'function') {
      throw new Error('LLM 不支持 bindTools 方法');
    }

    try {
      this.llm = this.baseLLM.bindTools(this.langchainTools) as BaseChatModel;
      console.log(`[ReActAgent] ✅ 已重新绑定 ${this.langchainTools.length} 个工具到 LLM`);
    } catch (error) {
      console.error(`[ReActAgent] ❌ 重新绑定工具失败:`, error);
      // 回滚：移除新添加的工具
      this.langchainTools = this.langchainTools.filter((tool) => !toolsToAdd.includes(tool));
      toolsToAdd.forEach((tool) => this.toolNameSet.delete(tool.name));
      throw new Error(`重新绑定工具失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 更新消息历史中的系统提示词
   * 根据当前已激活的片段和 MCP 工具，动态构建完整的系统提示词
   * 注意：这里直接替换系统消息，因为 buildSystemPrompt 已经包含了 this.config.systemPrompt
   */
  private updateSystemPrompt(messages: BaseMessage[], activatedFragments: Set<string>, activatedMcpTools: Set<string>): void {
    // 找到第一个系统消息并更新
    const systemMessageIndex = messages.findIndex((msg) => msg instanceof SystemMessage);
    if (systemMessageIndex >= 0) {
      // 根据已激活的片段和 MCP 工具构建系统提示词
      // buildSystemPrompt 已经包含了 this.config.systemPrompt，所以直接使用即可
      const fragmentIds = Array.from(activatedFragments);
      const mcpToolTypes = Array.from(activatedMcpTools);
      const updatedSystemPrompt = this.buildSystemPrompt(
        fragmentIds.length > 0 ? fragmentIds : undefined,
        mcpToolTypes.length > 0 ? mcpToolTypes : undefined
      );
      messages[systemMessageIndex] = new SystemMessage(updatedSystemPrompt);
    }
  }

  /**
   * 流式执行 Agent 循环
   */
  async *stream(input: string | ChatMessage[]): AsyncGenerator<ReActStreamChunk> {
    // 跟踪已激活的片段和 MCP 工具，避免重复激活
    const activatedFragments = new Set<string>();
    const activatedMcpTools = new Set<string>();

    // 初始场景检测：分析消息，判断需要哪些提示词片段和 MCP 工具
    let initialFragmentIds: string[] = [];
    let initialMcpToolTypes: string[] = [];

    // 构建消息历史（初始时使用检测到的片段和 MCP 工具）
    let messages: BaseMessage[];
    if (typeof input === 'string') {
      messages = [
        new SystemMessage(
          this.buildSystemPrompt(
            initialFragmentIds.length > 0 ? initialFragmentIds : undefined,
            initialMcpToolTypes.length > 0 ? initialMcpToolTypes : undefined
          )
        ),
        new HumanMessage(input),
      ];
    } else {
      // 将 ChatMessage 转换为 LangChain 消息
      const convertedMessages: BaseMessage[] = [];
      let hasSystemPrompt = false;

      for (const msg of input) {
        if (msg.role === 'system') {
          hasSystemPrompt = true;
          // 合并系统提示词（只支持文本）
          const systemContent =
            typeof msg.content === 'string'
              ? msg.content
              : msg.content
                  .filter((part) => part.type === 'text')
                  .map((part) => part.text || '')
                  .join('');
          convertedMessages.push(
            new SystemMessage(
              `${systemContent}\n\n${this.buildSystemPrompt(
                initialFragmentIds.length > 0 ? initialFragmentIds : undefined,
                initialMcpToolTypes.length > 0 ? initialMcpToolTypes : undefined
              )}`
            )
          );
        } else if (msg.role === 'assistant') {
          // 助手消息（只支持文本）
          const assistantContent =
            typeof msg.content === 'string'
              ? msg.content
              : msg.content
                  .filter((part) => part.type === 'text')
                  .map((part) => part.text || '')
                  .join('');
          convertedMessages.push(new AIMessage(assistantContent));
        } else {
          // 用户消息（支持多模态）
          if (typeof msg.content === 'string') {
            convertedMessages.push(new HumanMessage(msg.content));
          } else {
            // 多模态内容
            convertedMessages.push(new HumanMessage({ content: msg.content }));
          }
        }
      }

      if (!hasSystemPrompt) {
        convertedMessages.unshift(
          new SystemMessage(
            this.buildSystemPrompt(
              initialFragmentIds.length > 0 ? initialFragmentIds : undefined,
              initialMcpToolTypes.length > 0 ? initialMcpToolTypes : undefined
            )
          )
        );
      }

      messages = convertedMessages;
    }

    // 累计所有迭代的 token 使用情况（包括意图检测）
    let accumulatedTokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost: 0,
    };

    // 累计初始意图检测的 token
    let initialIntent: DetectedIntent;

    // 构建初始微代理执行上下文
    const initialChatMessages: ChatMessage[] = typeof input === 'string' ? [{ role: 'user', content: input }] : input;

    const initialContext: MicroAgentContext = {
      messages: messages,
      chatMessages: initialChatMessages,
      agentConfig: {
        modelId: this.config.modelId,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
      },
      activatedFragments,
      activatedMcpTools,
    };

    // 使用微代理管理器执行初始化时机的微代理
    const initialResults = await microAgentManager.executeByTrigger(MicroAgentTrigger.INITIALIZATION, initialContext);

    // 查找意图检测微代理的结果
    let foundIntent: DetectedIntent | undefined;
    for (const result of initialResults) {
      if (result.success && result.data && result.metadata?.intent) {
        foundIntent = result.metadata.intent as DetectedIntent;
        if (result.tokenUsage) {
          accumulatedTokenUsage.promptTokens += result.tokenUsage.promptTokens ?? 0;
          accumulatedTokenUsage.completionTokens += result.tokenUsage.completionTokens ?? 0;
          accumulatedTokenUsage.totalTokens += result.tokenUsage.totalTokens ?? 0;
          accumulatedTokenUsage.cost += result.tokenUsage.cost ?? 0;
          console.log(`[ReActAgent] 📊 初始意图检测 Token:`, result.tokenUsage);
        }
        break;
      }
    }

    // 如果没有找到意图检测结果，使用空结果
    initialIntent = foundIntent || {
      fragmentIds: [],
      mcpToolTypes: [],
      confidence: 0,
      reasons: ['未检测到特殊能力需求'],
    };

    initialFragmentIds = initialIntent.fragmentIds;
    initialMcpToolTypes = initialIntent.mcpToolTypes;

    // 如果初始检测到新工具，动态绑定到 LLM
    if (initialMcpToolTypes.length > 0) {
      try {
        this.bindNewTools(initialMcpToolTypes);
      } catch (error) {
        console.error(`[ReActAgent] ❌ 初始绑定工具失败:`, error);
        // 即使绑定失败，也继续执行，但记录错误
      }
    }

    // 记录初始激活的片段和工具
    initialFragmentIds.forEach((id) => activatedFragments.add(id));
    initialMcpToolTypes.forEach((type) => activatedMcpTools.add(type));

    console.log(`[ReActAgent] 🎯 初始场景检测结果:`, {
      fragmentIds: initialFragmentIds,
      mcpToolTypes: initialMcpToolTypes,
      confidence: initialIntent.confidence,
      reasons: initialIntent.reasons,
    });

    // 构建思考内容的公共函数
    const buildThoughtContent = (fragmentIds: string[], mcpToolTypes: string[], intent: DetectedIntent, isInitial: boolean = false): string => {
      const parts: string[] = [];

      if (fragmentIds.length > 0 || mcpToolTypes.length > 0) {
        if (isInitial) {
          parts.push('检测到的能力需求：');
        } else {
          parts.push('检测到新的能力需求：');
        }

        if (fragmentIds.length > 0) {
          parts.push(`\n- 提示词片段：${fragmentIds.join(', ')}`);
        }

        if (mcpToolTypes.length > 0) {
          parts.push(`\n- MCP 工具：${mcpToolTypes.join(', ')}`);
        }
      } else if (isInitial) {
        parts.push('未检测到特殊能力需求，使用基础能力。');
      }

      if (intent.reasons && intent.reasons.length > 0) {
        parts.push(`\n\n分析理由：\n${intent.reasons.join('\n')}`);
      }

      if (isInitial && intent.confidence > 0) {
        parts.push(`\n\n置信度：${(intent.confidence * 100).toFixed(0)}%`);
      }

      return parts.join('');
    };

    if (initialIntent.fragmentIds.length > 0 || initialMcpToolTypes.length > 0 || initialIntent.reasons.length > 0) {
      yield {
        type: 'thought',
        content: buildThoughtContent(initialFragmentIds, initialMcpToolTypes, initialIntent, true),
      };
    }

    // 提取 token 使用信息的辅助函数
    const extractTokenUsage = (response: any) => {
      const metadata = response?.response_metadata;
      if (!metadata) return undefined;

      // 优先使用 usage 字段（更详细）
      if (metadata.usage) {
        return {
          promptTokens: metadata.usage.prompt_tokens ?? metadata.usage.input_tokens ?? 0,
          completionTokens: metadata.usage.completion_tokens ?? metadata.usage.output_tokens ?? 0,
          totalTokens: metadata.usage.total_tokens ?? 0,
          cost: metadata.usage.cost ?? 0,
        };
      }

      // 回退到 tokenUsage 字段
      if (metadata.tokenUsage) {
        return {
          promptTokens: metadata.tokenUsage.promptTokens ?? 0,
          completionTokens: metadata.tokenUsage.completionTokens ?? 0,
          totalTokens: metadata.tokenUsage.totalTokens ?? 0,
          cost: metadata.usage?.cost ?? 0,
        };
      }

      // 尝试从 usage_metadata 获取
      if (response.usage_metadata) {
        return {
          promptTokens: response.usage_metadata.input_tokens ?? 0,
          completionTokens: response.usage_metadata.output_tokens ?? 0,
          totalTokens: response.usage_metadata.total_tokens ?? 0,
          cost: 0, // usage_metadata 通常不包含 cost
        };
      }

      return undefined;
    };

    let iteration = 0;
    const maxIterations = 100;

    while (iteration < maxIterations) {
      iteration++;
      console.log(`[FunctionCallingAgent] 🔄 Agent 循环 ${iteration}/${maxIterations}`);

      // 在每次迭代前，动态检测是否需要激活新的能力片段和 MCP 工具
      const {
        newFragments,
        newMcpTools,
        tokenUsage: intentTokenUsage,
        intent,
      } = await this.detectAndActivateFragments(messages, activatedFragments, activatedMcpTools);

      // 累计意图检测的 token（如果进行了检测）
      if (intentTokenUsage) {
        accumulatedTokenUsage.promptTokens += intentTokenUsage.promptTokens ?? 0;
        accumulatedTokenUsage.completionTokens += intentTokenUsage.completionTokens ?? 0;
        accumulatedTokenUsage.totalTokens += intentTokenUsage.totalTokens ?? 0;
        accumulatedTokenUsage.cost += intentTokenUsage.cost ?? 0;
        console.log(`[ReActAgent] 📊 迭代意图检测 Token:`, intentTokenUsage);
      }

      // 如果检测到新能力，输出思考结果并更新系统提示词
      if (newFragments.length > 0 || newMcpTools.length > 0) {
        // 如果检测到新工具，动态绑定到 LLM
        if (newMcpTools.length > 0) {
          try {
            this.bindNewTools(newMcpTools);
          } catch (error) {
            console.error(`[ReActAgent] ❌ 动态绑定工具失败:`, error);
            // 即使绑定失败，也继续执行，但记录错误
          }
        }

        // 输出思考结果
        yield {
          type: 'thought',
          content: buildThoughtContent(newFragments, newMcpTools, intent!),
        };

        // 更新系统提示词
        this.updateSystemPrompt(messages, activatedFragments, activatedMcpTools);
        if (newFragments.length > 0) {
          console.log(`[ReActAgent] ✅ 已激活新能力片段: ${newFragments.join(', ')}`);
        }
        if (newMcpTools.length > 0) {
          console.log(`[ReActAgent] ✅ 已激活新 MCP 工具: ${newMcpTools.join(', ')}`);
        }
      }

      // 调用 LLM（已绑定工具）- 流式输出
      const stream = await this.llm.stream(messages);

      // 累积流式响应以构建完整的 AIMessage（包含 tool_calls）
      // 注意：在 LangChain 中，需要累积所有的 chunks 来构建完整的响应
      let accumulatedContent = '';
      const chunks: AIMessage[] = [];

      for await (const chunk of stream) {
        // 累积内容
        const chunkContent = typeof chunk.content === 'string' ? chunk.content : JSON.stringify(chunk.content);
        accumulatedContent += chunkContent;

        // 保存所有 chunks（用于合并工具调用信息）
        chunks.push(chunk as AIMessage);

        // 调试：检查 chunk 中的工具调用信息
        const chunkToolCalls = (chunk as any).tool_calls || (chunk as any).additional_kwargs?.tool_calls;
        if (chunkToolCalls && Array.isArray(chunkToolCalls) && chunkToolCalls.length > 0) {
          console.log(`[FunctionCallingAgent] 🔍 在流式 chunk 中检测到工具调用:`, chunkToolCalls);
        }

        // 实时 yield 流式内容（这是 agent 的回答内容，不是思考过程）
        // 注意：即使没有文本内容，也可能有工具调用，所以我们需要继续处理
        if (chunkContent) {
          yield {
            type: 'final_answer' as const,
            content: chunkContent,
          };
        }
      }

      console.log(`[FunctionCallingAgent] 📊 流式响应完成:`, {
        chunksCount: chunks.length,
        accumulatedContentLength: accumulatedContent.length,
        lastChunkToolCalls: chunks.length > 0 ? (chunks[chunks.length - 1] as any).tool_calls : null,
      });

      // 合并所有 chunks 来构建完整的 AIMessage（包含完整的 tool_calls）
      // LangChain 的流式响应中，工具调用信息可能分散在多个 chunks 中
      // 使用 LangChain 的合并方法来正确合并所有 chunks
      let response: AIMessage;
      if (chunks.length === 0) {
        response = new AIMessage(accumulatedContent);
      } else if (chunks.length === 1) {
        // 只有一个 chunk，直接使用但更新内容
        response = chunks[0];
        if (typeof response.content === 'string') {
          response.content = accumulatedContent;
        }
      } else {
        // 多个 chunks，使用 LangChain 的合并方法
        // AIMessageChunk 有 concat 方法可以合并多个 chunks
        let mergedChunk = chunks[0];
        for (let i = 1; i < chunks.length; i++) {
          // 使用 concat 方法合并 chunks（如果可用）
          if (typeof (mergedChunk as any).concat === 'function') {
            mergedChunk = (mergedChunk as any).concat(chunks[i]) as AIMessage;
          } else {
            // 如果没有 concat 方法，手动合并
            // 合并内容
            const mergedContent =
              (typeof mergedChunk.content === 'string' ? mergedChunk.content : '') + (typeof chunks[i].content === 'string' ? chunks[i].content : '');
            mergedChunk = new AIMessage(mergedContent);
            // 合并 tool_calls（使用最后一个 chunk 的 tool_calls，因为它通常包含完整信息）
            const currentChunk = chunks[i];
            if (currentChunk?.tool_calls && Array.isArray(currentChunk.tool_calls) && currentChunk.tool_calls.length > 0) {
              mergedChunk.tool_calls = currentChunk.tool_calls;
            } else if (mergedChunk.tool_calls && Array.isArray(mergedChunk.tool_calls) && mergedChunk.tool_calls.length > 0) {
              // 保留已有的 tool_calls（不需要操作）
            }
            // 合并其他属性
            if (chunks[i].response_metadata) {
              mergedChunk.response_metadata = chunks[i].response_metadata;
            }
            if (chunks[i].usage_metadata) {
              mergedChunk.usage_metadata = chunks[i].usage_metadata;
            }
          }
        }
        response = mergedChunk;
        // 确保内容是最新的累积内容
        if (typeof response.content === 'string') {
          response.content = accumulatedContent;
        }
      }

      const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

      // 将 AI 响应添加到消息历史（必须保留完整的 response，包含 tool_calls）
      messages.push(response);

      // 检查是否有工具调用 - 支持多种可能的字段位置
      // LangChain 的工具调用可能在 response.tool_calls 或 response.additional_kwargs.tool_calls
      let toolCalls = response.tool_calls;
      if (!toolCalls && response.additional_kwargs?.tool_calls) {
        toolCalls = response.additional_kwargs.tool_calls as unknown as ToolCall[];
      }

      // 调试：检查工具调用信息
      console.log('[FunctionCallingAgent] 🔍 检查工具调用:', {
        hasToolCalls: !!toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0,
        toolCallsCount: toolCalls?.length || 0,
        toolCalls: toolCalls,
        responseToolCalls: response.tool_calls,
        additionalKwargsToolCalls: response.additional_kwargs?.tool_calls,
      });

      const hasToolCalls = toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0;

      // 详细的调试日志
      console.log('[FunctionCallingAgent] 📋 响应内容:', JSON.stringify(response));

      // 如果内容中包含工具调用的文本描述，但实际没有工具调用，说明 LLM 没有使用 Function Calling
      // 这种情况需要警告，但继续处理
      if (
        !hasToolCalls &&
        content &&
        (content.includes('调用工具') || content.includes('调用:') || content.match(/add_memory|search_memory|update_memory|delete_memory/i))
      ) {
        console.warn(
          '[FunctionCallingAgent] ⚠️  检测到内容中包含工具调用文本，但响应中没有 tool_calls。这可能是 LLM 没有使用 Function Calling 格式。'
        );
        console.warn(
          '[FunctionCallingAgent] ⚠️  响应对象结构:',
          JSON.stringify({
            content: content.substring(0, 500),
            tool_calls: response.tool_calls,
            additional_kwargs: response.additional_kwargs,
          })
        );
      }

      // 提取本次迭代的 token 使用情况并累计
      const iterationTokenUsage = extractTokenUsage(response);
      if (iterationTokenUsage) {
        accumulatedTokenUsage.promptTokens += iterationTokenUsage.promptTokens;
        accumulatedTokenUsage.completionTokens += iterationTokenUsage.completionTokens;
        accumulatedTokenUsage.totalTokens += iterationTokenUsage.totalTokens;
        accumulatedTokenUsage.cost += iterationTokenUsage.cost;

        console.log(`[FunctionCallingAgent] 📊 第 ${iteration} 次迭代 Token:`, {
          prompt: iterationTokenUsage.promptTokens,
          completion: iterationTokenUsage.completionTokens,
          total: iterationTokenUsage.totalTokens,
          cost: iterationTokenUsage.cost,
        });
        console.log(`[FunctionCallingAgent] 📊 累计 Token:`, accumulatedTokenUsage);
      }

      // 如果没有工具调用，说明是最终答案
      // 注意：内容已经在流式过程中 yield 了，这里需要发送 tokenUsage 信息
      if (!hasToolCalls) {
        console.log('[FunctionCallingAgent] ✅ 收到最终答案');
        console.log('[FunctionCallingAgent] 📊 总 Token 使用情况（累计所有迭代）:', accumulatedTokenUsage);

        // 如果流式过程中没有输出任何内容（accumulatedContent 为空），yield 最终答案和 tokenUsage
        // 如果已经有内容输出，只 yield tokenUsage 信息（空内容），用于更新最后一条消息的 metadata
        if (!accumulatedContent || accumulatedContent.trim() === '') {
          yield {
            type: 'final_answer',
            content: content || '(空响应)',
            tokenUsage: {
              promptTokens: accumulatedTokenUsage.promptTokens,
              completionTokens: accumulatedTokenUsage.completionTokens,
              totalTokens: accumulatedTokenUsage.totalTokens,
              cost: accumulatedTokenUsage.cost,
            },
          };
        } else {
          // 已经有内容输出，发送一个只包含 tokenUsage 的 chunk 来更新 metadata
          yield {
            type: 'final_answer',
            content: '', // 空内容，只用于传递 tokenUsage
            tokenUsage: {
              promptTokens: accumulatedTokenUsage.promptTokens,
              completionTokens: accumulatedTokenUsage.completionTokens,
              totalTokens: accumulatedTokenUsage.totalTokens,
              cost: accumulatedTokenUsage.cost,
            },
          };
        }
        return;
      }

      // 如果有工具调用，流式输出的内容已经 yield 了（作为这一轮的回答）
      // 现在继续处理工具调用

      // 处理所有工具调用（通常一次只有一个）
      for (const toolCall of toolCalls || []) {
        const toolName = toolCall.name;
        const toolArgs = toolCall.args || {};
        const toolCallId = toolCall.id;

        console.log(`[FunctionCallingAgent] 🔧 调用工具: ${toolName}`, toolArgs);

        if (!toolCallId) {
          console.error(`[FunctionCallingAgent] ❌ 工具调用 ID 为空`);
          continue;
        }

        // 输出工具调用信息
        yield {
          type: 'action',
          content: `调用工具: ${toolName}`,
          toolName,
          toolArgs,
        };

        // 查找工具
        const tool = this.langchainTools.find((t: any) => t.name === toolName);

        if (!tool) {
          const errorMsg = `错误: 工具 ${toolName} 不存在。可用工具: ${this.langchainTools.map((t: any) => t.name).join(', ')}`;
          console.error(`[FunctionCallingAgent] ❌ ${errorMsg}`);

          // 添加错误到消息历史
          messages.push(
            new ToolMessage({
              content: errorMsg,
              tool_call_id: toolCallId,
            })
          );

          yield {
            type: 'observation',
            content: errorMsg,
            toolName,
            isError: true,
          };
          continue;
        }

        // 执行工具
        try {
          const toolResult = await tool.invoke(toolArgs);
          const resultStr = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult);

          console.log(`[FunctionCallingAgent] ✅ 工具执行成功: ${toolName}`, {
            resultLength: resultStr.length,
          });

          // 添加工具结果到消息历史
          messages.push(
            new ToolMessage({
              content: resultStr,
              tool_call_id: toolCallId,
            })
          );

          // 输出观察结果
          const displayResult = resultStr.length > 500 ? resultStr.substring(0, 500) + '...' : resultStr;
          yield {
            type: 'observation',
            content: displayResult,
            toolName,
            toolResult: resultStr,
          };
        } catch (error: any) {
          const errorMsg = `工具执行错误: ${error.message}`;
          console.error(`[FunctionCallingAgent] ❌ ${errorMsg}`);

          // 添加错误到消息历史
          messages.push(
            new ToolMessage({
              content: errorMsg,
              tool_call_id: toolCallId,
            })
          );

          yield {
            type: 'observation',
            content: errorMsg,
            toolName,
            isError: true,
          };
        }
      }
    }

    // 达到最大迭代次数
    console.error(`[ReActAgent] ⚠️ 已达到最大迭代次数`);
    yield {
      type: 'final_answer',
      content: '已达到最大迭代次数，无法完成任务。',
    };
  }
}
