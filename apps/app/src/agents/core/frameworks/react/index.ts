/**
 * React Agent 框架
 * 基于 ReAct（Reasoning + Acting）框架的智能代理框架层
 *
 * 参考 demo/react-agent.ts 的结构，以硬编码形式实现 ReAct 循环
 * 这是一个框架层实现，提供 ReAct 循环的基础能力。
 * Preset 层可以继承此框架，配置特定的工具和提示词来完成不同场景的任务。
 */

import { prisma } from '@/lib/server/prisma';
import { SystemPromptSnippets } from '@prisma/client';
import { ChatClient, UnifiedChat } from '@repo/llm/chat';
import { BaseAgent } from '../base';
import { MicroAgentContext, microAgentManager, MicroAgentTrigger } from '../../micro-agents';

/**
 * ReAct 流式响应块类型
 */
export interface ReactStreamChunk {
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
 * React Agent 框架类
 * 提供基于 ReAct 框架的基础能力，可被子类继承
 *
 * 参考 demo 中的 ReActAgent，硬编码实现完整的 ReAct 循环
 */
export abstract class ReactAgent extends BaseAgent {
  /**
   * 流式执行 Agent 循环
   * 参考 demo 中的 stream 方法实现
   */
  async *stream(
    llmClient: ChatClient,
    input: string | UnifiedChat.Message[],
    history: UnifiedChat.Message[] = [],
    options?: {
      modelId?: string;
      enableMicroAgents?: boolean;
      enabledFragmentIds?: string[];
    },
  ): AsyncGenerator<ReactStreamChunk> {
    // 构建消息历史
    let messages: UnifiedChat.Message[];

    // 动态激活的片段 ID 集合
    const activatedFragments = new Set<string>(options?.enabledFragmentIds || []);

    // 如果启用了 micro-agents，执行 PRE_ITERATION 时机的微代理
    if (options?.enableMicroAgents !== false) {
      const allMessages = typeof input === 'string' ? [...history, { role: 'user' as const, content: input }] : input;

      const microAgentContext: MicroAgentContext = {
        messages: allMessages,
        agentConfig: {
          modelId: options?.modelId || '',
        },
        activatedFragments,
        llmClient, // 传递 LLM 客户端给微代理
      };

      // 执行 PRE_ITERATION 微代理
      const microAgentResults = await microAgentManager.executeByTrigger(MicroAgentTrigger.PRE_ITERATION, microAgentContext);

      // 处理微代理结果，更新激活的片段
      for (const result of microAgentResults) {
        if (result.success && result.metadata?.intent) {
          const intent = result.metadata.intent as { fragmentIds?: string[] };
          if (intent.fragmentIds) {
            intent.fragmentIds.forEach(id => activatedFragments.add(id));
          }
        }
      }
    }

    // 构建系统提示词（包含动态片段）
    const systemPrompt = await this.buildSystemPromptWithFragments(this.config.systemPrompt, Array.from(activatedFragments));

    if (typeof input === 'string') {
      // 字符串输入：构建新的消息历史
      messages = [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: input }];
    } else {
      // 消息数组输入：合并系统提示词和历史
      const convertedMessages: UnifiedChat.Message[] = [];
      let hasSystemPrompt = false;

      for (const msg of input) {
        if (msg.role === 'system') {
          hasSystemPrompt = true;
          // 合并系统提示词
          const systemContent =
            typeof msg.content === 'string'
              ? msg.content
              : Array.isArray(msg.content)
                ? msg.content
                    .filter((part: any) => part.type === 'text')
                    .map((part: any) => part.text || '')
                    .join('')
                : '';
          convertedMessages.push({
            role: 'system',
            content: `${systemContent}\n\n${this.config.systemPrompt}`,
          });
        } else {
          convertedMessages.push(msg);
        }
      }

      if (!hasSystemPrompt) {
        convertedMessages.unshift({
          role: 'system',
          content: systemPrompt,
        });
      } else {
        // 更新现有的系统提示词
        const systemMsgIndex = convertedMessages.findIndex(msg => msg.role === 'system');
        if (systemMsgIndex >= 0 && convertedMessages[systemMsgIndex]) {
          convertedMessages[systemMsgIndex]!.content = systemPrompt;
        }
      }

      messages = convertedMessages;
    }

    // 累计所有迭代的 token 使用情况
    const accumulatedTokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost: 0,
    };

    let iteration = 0;
    const maxIterations = 100;

    while (iteration < maxIterations) {
      iteration++;
      console.log(`[ReactAgent] 🔄 ReAct 循环 ${iteration}/${maxIterations}`);

      // Think + Act 阶段：调用 LLM
      const chatParams: UnifiedChat.ChatCompletionParams = {
        messages,
        tools: this.config.tools.length > 0 ? this.config.tools : undefined,
        tool_choice: this.config.tools.length > 0 ? 'auto' : undefined,
      };

      const stream = llmClient.chatStream(chatParams);

      let accumulatedContent = '';
      const toolCalls: UnifiedChat.ToolCall[] = [];
      let inputTokens = 0;
      let outputTokens = 0;

      // 处理流式响应
      for await (const chunk of stream) {
        // 累积 token 使用量
        if (chunk.usage) {
          inputTokens += chunk.usage.prompt_tokens || 0;
          outputTokens += chunk.usage.completion_tokens || 0;
        }

        const choice = chunk.choices?.[0];
        if (!choice) continue;

        // 处理文本内容
        if (choice.delta?.content) {
          const contentDelta = choice.delta.content;
          accumulatedContent += contentDelta;

          yield {
            type: 'final_answer',
            content: contentDelta,
          };
        }

        // 处理工具调用（累积）
        if (choice.delta?.tool_calls) {
          for (const toolCallDelta of choice.delta.tool_calls) {
            const index = (toolCallDelta as any).index ?? 0;
            if (!toolCalls[index]) {
              toolCalls[index] = {
                id: (toolCallDelta as any).id || `tool_${index}`,
                type: 'function',
                function: {
                  name: (toolCallDelta as any).function?.name || '',
                  arguments: (toolCallDelta as any).function?.arguments || '',
                },
              };
            } else {
              // 累加 arguments（可能分多次发送）
              if ((toolCallDelta as any).function?.arguments) {
                toolCalls[index].function.arguments += (toolCallDelta as any).function.arguments;
              }
              // 更新 name（某些 provider 可能分多次发送）
              if ((toolCallDelta as any).function?.name) {
                toolCalls[index].function.name = (toolCallDelta as any).function.name;
              }
            }
          }
        }

        // 检查是否完成
        if (choice.finish_reason) {
          // 如果有工具调用
          if (choice.finish_reason === 'tool_calls' && toolCalls.length > 0) {
            // 验证 tool calls 的完整性
            const validToolCalls = toolCalls.filter(tc => tc?.id && tc?.function?.name);

            if (validToolCalls.length > 0) {
              // 添加助手消息（包含工具调用）到历史
              messages.push({
                role: 'assistant',
                content: accumulatedContent || '',
                tool_calls: validToolCalls,
              });

              // 输出工具调用信息
              for (const toolCall of validToolCalls) {
                let toolArgs: Record<string, any> = {};
                try {
                  toolArgs = JSON.parse(toolCall.function.arguments || '{}');
                } catch (e) {
                  console.error(`[ReactAgent] 解析工具参数失败:`, e);
                }

                yield {
                  type: 'action',
                  content: `调用工具: ${toolCall.function.name}`,
                  toolName: toolCall.function.name,
                  toolArgs,
                };
              }

              // 累积 token 使用情况
              accumulatedTokenUsage.promptTokens += inputTokens;
              accumulatedTokenUsage.completionTokens += outputTokens;
              accumulatedTokenUsage.totalTokens += inputTokens + outputTokens;

              // 注意：工具执行在浏览器端完成，这里只输出调用信息
              // 实际的工具结果需要通过消息历史传入下一轮循环
              // 这里返回，等待工具结果添加到 messages 后继续
              return;
            }
          }

          // 没有工具调用，说明是最终答案
          if (accumulatedContent || !toolCalls.length) {
            // 添加助手消息到历史
            messages.push({
              role: 'assistant',
              content: accumulatedContent || '',
            });

            // 累积 token 使用情况
            accumulatedTokenUsage.promptTokens += inputTokens;
            accumulatedTokenUsage.completionTokens += outputTokens;
            accumulatedTokenUsage.totalTokens += inputTokens + outputTokens;

            // 输出最终 token 使用情况
            if (inputTokens > 0 || outputTokens > 0) {
              yield {
                type: 'final_answer',
                content: '',
                tokenUsage: {
                  promptTokens: accumulatedTokenUsage.promptTokens,
                  completionTokens: accumulatedTokenUsage.completionTokens,
                  totalTokens: accumulatedTokenUsage.totalTokens,
                },
              };
            }

            // 任务完成
            return;
          }
        }
      }
    }

    // 达到最大迭代次数
    yield {
      type: 'final_answer',
      content: '已达到最大迭代次数，无法完成任务。',
      tokenUsage: {
        promptTokens: accumulatedTokenUsage.promptTokens,
        completionTokens: accumulatedTokenUsage.completionTokens,
        totalTokens: accumulatedTokenUsage.totalTokens,
      },
    };
  }

  /**
   * 构建系统提示词（包含动态片段）
   * 子类可以覆盖此方法来自定义提示词构建逻辑
   */
  protected async buildSystemPromptWithFragments(basePrompt?: string, fragmentIds?: string[]): Promise<string> {
    const systemPrompt = basePrompt || this.config.systemPrompt || 'You are a helpful assistant.';

    // 构建基础提示词
    let fullPrompt = `${systemPrompt}

## 核心约束

你是一个基于 ReAct（Reasoning + Acting）框架的智能代理。

### ReAct 工作流程

1. **Think（思考）**：分析当前情况，理解任务需求，规划下一步行动
2. **Act（行动）**：执行工具调用，获取信息或执行操作
3. **Observe（观察）**：分析工具执行结果，评估任务进度

### 执行原则

- **自主连续执行**：一旦开始任务，连续执行直到完成，不等待用户确认
- **动态调整策略**：根据观察结果调整方法，失败时分析原因并重试
- **明确完成状态**：每轮循环判断任务是否完成，完成后给出最终答案

### 工具使用策略

- 当需要外部信息时，主动使用可用的工具
- 基于工具返回结果生成回答，避免添加未验证的推测
- 工具调用失败或返回空结果时，明确告知用户并说明原因
- 复杂查询可能需要使用多个工具，按需顺序或并行使用`;

    // 动态注入片段内容
    const fragmentsPrompt = await this.buildPromptSnippets(fragmentIds && fragmentIds.length > 0 ? fragmentIds : undefined);
    if (fragmentsPrompt) {
      fullPrompt += `\n\n${fragmentsPrompt}`;
    }

    fullPrompt += '\n\n开始工作。';

    return fullPrompt;
  }

  /**
   * 构建系统提示词（向后兼容方法）
   * 子类可以覆盖此方法来自定义提示词构建逻辑
   */
  protected async buildSystemPrompt(basePrompt?: string): Promise<string> {
    return this.buildSystemPromptWithFragments(basePrompt);
  }

  async buildPromptSnippets(fragmentIds?: string[]): Promise<string> {
    const fragments = await prisma.systemPromptSnippets.findMany({
      where: {
        ...(fragmentIds && fragmentIds.length > 0 ? { id: { in: fragmentIds } } : {}),
        enabled: true,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    if (fragments.length === 0) {
      return '';
    }

    // 按章节分组
    const fragmentsBySection = new Map<string, SystemPromptSnippets[]>();
    fragments.forEach(fragment => {
      const section = fragment.section || '其他';
      if (!fragmentsBySection.has(section)) {
        fragmentsBySection.set(section, []);
      }
      fragmentsBySection.get(section)!.push(fragment);
    });

    // 组装提示词
    let prompt = '';
    fragmentsBySection.forEach((sectionFragments, section) => {
      if (section !== '其他') {
        prompt += `\n\n## ${section}\n\n`;
      }

      sectionFragments.forEach(fragment => {
        if (fragment.content.trim().startsWith('#')) {
          prompt += fragment.content.trim();
        } else {
          prompt += `### ${fragment.name}\n\n`;
          if (fragment.description) {
            prompt += `**说明**：${fragment.description}\n\n`;
          }
          prompt += fragment.content.trim();
        }
        prompt += '\n\n';
      });
    });

    return prompt;
  }
}
