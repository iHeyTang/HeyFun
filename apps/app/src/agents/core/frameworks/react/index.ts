/**
 * React Agent 框架
 * 基于 ReAct（Reasoning + Acting）框架的智能代理框架层
 *
 * 参考 demo/react-agent.ts 的结构，以硬编码形式实现 ReAct 循环
 * 这是一个框架层实现，提供 ReAct 循环的基础能力。
 * Preset 层可以继承此框架，配置特定的工具和提示词来完成不同场景的任务。
 */

import { ChatClient, UnifiedChat } from '@repo/llm/chat';
import { BaseAgent } from '../base';
import { MicroAgentContext, microAgentManager, MicroAgentTrigger } from '../../micro-agents';
import { getSessionDynamicSystemPrompt } from '@/agents/tools/context';

/**
 * 微代理执行详情
 */
export interface MicroAgentExecutionDetail {
  agentId: string; // 微代理 ID
  agentName: string; // 微代理名称
  trigger: string; // 触发时机
  status: 'executing' | 'success' | 'skipped' | 'failed'; // 执行状态
  startTime?: number; // 开始时间戳
  endTime?: number; // 结束时间戳
  duration?: number; // 执行时长（毫秒）
  result?: {
    success: boolean;
    data?: any;
    error?: string;
    tokenUsage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
      cost?: number;
    };
    metadata?: Record<string, any>;
  };
  message?: string; // 执行消息
}

/**
 * 迭代次数提供者接口
 * 用于在 Workflow 等外部环境中管理迭代次数，确保迭代次数可以跨步骤保持
 */
export interface IterationProvider {
  /**
   * 获取当前迭代次数
   */
  getIteration(): number;

  /**
   * 递增迭代次数并返回新的迭代次数
   */
  incrementIteration(): number;

  /**
   * 重置迭代次数（可选）
   */
  resetIteration?(): void;
}

/**
 * ReAct 流式响应块类型
 */
export interface ReactStreamChunk {
  type: 'thought' | 'action' | 'observation' | 'final_answer' | 'micro_agent';
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
  // 微代理执行详情
  microAgent?: MicroAgentExecutionDetail;
}

/**
 * React Agent 框架类
 * 提供基于 ReAct 框架的基础能力，可被子类继承
 *
 * 参考 demo 中的 ReActAgent，硬编码实现完整的 ReAct 循环
 */
export abstract class ReactAgent extends BaseAgent {
  // 静态标志，确保微代理只初始化一次
  private static microAgentsInitialized = false;

  /**
   * 初始化微代理（懒加载，只初始化一次）
   */
  private static initializeMicroAgents(): void {
    if (ReactAgent.microAgentsInitialized) {
      return;
    }

    // 意图检测和片段检索已转换为 Tool，由 LLM 按需调用
    // 不再使用微代理自动执行，改为通过系统提示词指导 LLM 在需要时主动调用
    // 这样可以：
    // 1. 减少每轮对话的延迟（只在需要时执行）
    // 2. 提供更好的用户体验（LLM 可以实时反馈当前在做什么）
    // 3. 更灵活的控制（LLM 可以根据上下文决定是否需要调用）

    // 如果需要重新启用微代理，可以取消下面的注释：
    // if (!microAgentManager.getAgent('intent-detector')) {
    //   const intentDetectorAgent = new IntentDetectorMicroAgent({ enabled: false });
    //   microAgentManager.register(intentDetectorAgent);
    //   console.log('[ReactAgent] ✅ 已注册意图检测微代理（已禁用）');
    // }
    // if (!microAgentManager.getAgent('fragment-retriever')) {
    //   const fragmentRetrieverAgent = new FragmentRetrieverMicroAgent({ enabled: false });
    //   microAgentManager.register(fragmentRetrieverAgent);
    //   console.log('[ReactAgent] ✅ 已注册片段检索微代理（已禁用）');
    // }

    // 上下文管理功能已转换为 Tool，由 LLM 按需调用
    // 不再使用微代理自动执行，改为通过系统提示词指导 LLM 在需要时主动调用
    // 这样可以：
    // 1. 减少每轮对话的延迟（只在需要时执行）
    // 2. 提供更好的用户体验（LLM 可以实时反馈当前在做什么）
    // 3. 更灵活的控制（LLM 可以根据上下文决定是否需要调用）

    // 如果需要重新启用微代理，可以取消下面的注释：
    // if (!microAgentManager.getAgent('context-retrieval')) {
    //   const contextRetrievalAgent = new ContextRetrievalMicroAgent({
    //     maxSnapshots: 3,
    //   });
    //   microAgentManager.register(contextRetrievalAgent);
    //   console.log('[ReactAgent] ✅ 已注册上下文检索微代理');
    // }
    // if (!microAgentManager.getAgent('context-window-manager')) {
    //   const contextWindowManagerAgent = new ContextWindowManagerMicroAgent({
    //     maxMessages: 30,
    //     maxTokens: 8000,
    //     strategy: 'hybrid',
    //     slidingWindowSize: 10,
    //   });
    //   microAgentManager.register(contextWindowManagerAgent);
    //   console.log('[ReactAgent] ✅ 已注册上下文窗口管理微代理');
    // }
    // if (!microAgentManager.getAgent('context-compressor')) {
    //   const contextCompressorAgent = new ContextCompressorMicroAgent();
    //   microAgentManager.register(contextCompressorAgent);
    //   console.log('[ReactAgent] ✅ 已注册上下文压缩微代理');
    // }

    // 所有上下文管理功能已转换为 Tool，由 LLM 按需调用
    // 不再需要微代理自动执行

    ReactAgent.microAgentsInitialized = true;
  }

  /**
   * 流式执行 Agent 循环
   * 参考 demo 中的 stream 方法实现
   */
  /**
   * 执行微代理并处理结果（流式版本）
   * @param trigger 触发时机
   * @param context 执行上下文
   * @param yieldChunk 用于 yield 执行详情的回调函数（可选）
   * @returns 处理后的上下文（可能被微代理修改）
   */
  private async executeMicroAgents(
    trigger: MicroAgentTrigger,
    context: MicroAgentContext,
    yieldChunk?: (chunk: ReactStreamChunk) => void,
  ): Promise<{ context: MicroAgentContext; shouldUpdateSystemPrompt: boolean; shouldRetry: boolean }> {
    const results = await microAgentManager.executeByTrigger(trigger, context);
    let shouldUpdateSystemPrompt = false;
    let shouldRetry = false;

    // 处理微代理结果并生成执行详情
    for (const result of results) {
      // 生成微代理执行详情 chunk
      if (yieldChunk) {
        const agent = microAgentManager.getAgent(result.agentId || '');
        const agentName = agent?.config.name || result.agentId || '未知微代理';

        // 判断是否为跳过的微代理
        const isSkipped = result.data?.skipped === true;
        const status: 'executing' | 'success' | 'skipped' | 'failed' = isSkipped ? 'skipped' : result.success ? 'success' : 'failed';

        const executionDetail: MicroAgentExecutionDetail = {
          agentId: result.agentId || '',
          agentName,
          trigger: trigger.toString(),
          status,
          startTime: result.startTime,
          endTime: result.endTime,
          duration: result.duration,
          result: {
            success: result.success,
            data: result.data,
            error: result.error,
            tokenUsage: result.tokenUsage,
            metadata: result.metadata,
          },
          message: isSkipped ? `微代理 ${agentName} 已跳过` : result.error || `微代理 ${agentName} 执行 ${result.success ? '成功' : '失败'}`,
        };

        yieldChunk({
          type: 'micro_agent',
          content: `微代理 ${agentName} ${isSkipped ? '已跳过' : result.success ? '执行成功' : '执行失败'}`,
          microAgent: executionDetail,
          tokenUsage: result.tokenUsage,
        });
      }

      if (!result.success) continue;

      // 处理意图检测结果（将意图信息传递给后续微代理）
      if (result.agentId === 'intent-detector' && result.metadata?.intent) {
        context.metadata = context.metadata || {};
        context.metadata.intent = result.metadata.intent;
      }

      // 处理片段检索结果（更新激活的片段）
      if (result.agentId === 'fragment-retriever' && result.data) {
        const retrieval = result.data as { fragmentIds?: string[] };
        if (retrieval.fragmentIds && context.activatedFragments) {
          retrieval.fragmentIds.forEach(id => context.activatedFragments!.add(id));
        }
      }

      // 处理系统提示词更新标志
      if (result.shouldUpdateSystemPrompt) {
        shouldUpdateSystemPrompt = true;
      }

      // 处理重试标志
      if (result.shouldRetry) {
        shouldRetry = true;
      }

      // 处理其他 metadata（允许微代理修改上下文）
      if (result.metadata) {
        // 如果微代理返回了修改后的 messages
        if (result.metadata.messages) {
          context.messages = result.metadata.messages as UnifiedChat.Message[];
        }
        // 如果微代理返回了修改后的 agentConfig
        if (result.metadata.agentConfig) {
          context.agentConfig = { ...context.agentConfig, ...result.metadata.agentConfig };
        }
        // 如果微代理返回了修改后的 llmClient（例如模型切换微代理）
        if (result.metadata.llmClient) {
          context.llmClient = result.metadata.llmClient as ChatClient;
        }
      }
    }

    return { context, shouldUpdateSystemPrompt, shouldRetry };
  }

  async *stream(
    llmClient: ChatClient,
    input: string | UnifiedChat.Message[],
    history: UnifiedChat.Message[] = [],
    options?: {
      modelId?: string;
      enableMicroAgents?: boolean;
      enabledFragmentIds?: string[];
      sessionId?: string; // 会话ID，用于获取动态系统提示词片段
      iterationProvider?: IterationProvider; // 迭代次数提供者，用于在 Workflow 等外部环境中管理迭代次数
    },
  ): AsyncGenerator<ReactStreamChunk> {
    // 用于收集微代理执行详情的队列
    const microAgentChunks: ReactStreamChunk[] = [];

    // 构建消息历史
    let messages: UnifiedChat.Message[];

    // 动态激活的片段 ID 集合
    const activatedFragments = new Set<string>(options?.enabledFragmentIds || []);

    // 初始化迭代次数提供者（在循环开始前）
    // 使用迭代次数提供者（如果提供），否则使用本地变量
    // 这样可以支持在 Workflow 等外部环境中跨步骤维护迭代次数
    const iterationProvider = options?.iterationProvider;
    let localIteration = 0;
    const getIteration = () => (iterationProvider ? iterationProvider.getIteration() : localIteration);
    const incrementIteration = () => {
      if (iterationProvider) {
        return iterationProvider.incrementIteration();
      } else {
        localIteration++;
        return localIteration;
      }
    };
    const decrementIteration = () => {
      if (iterationProvider) {
        // 对于外部提供者，我们无法直接递减，需要通过其他方式处理
        // 这里我们假设提供者会处理重试逻辑，或者我们可以通过其他机制
        // 暂时保持原逻辑：重试时递减本地计数
        localIteration = Math.max(0, localIteration - 1);
        return localIteration;
      } else {
        localIteration = Math.max(0, localIteration - 1);
        return localIteration;
      }
    };
    const getInitialIteration = () => (iterationProvider ? iterationProvider.getIteration() : 0);

    // 如果启用了 micro-agents
    if (options?.enableMicroAgents !== false) {
      // 确保微代理已初始化
      ReactAgent.initializeMicroAgents();

      const allMessages = typeof input === 'string' ? [...history, { role: 'user' as const, content: input }] : input;

      // 获取初始迭代次数（在循环开始前，使用提供者或默认为0）
      const initialIteration = getInitialIteration();

      let microAgentContext: MicroAgentContext = {
        messages: allMessages,
        agentConfig: {
          modelId: options?.modelId || '',
        },
        activatedFragments,
        llmClient, // 传递 LLM 客户端给微代理
        iteration: initialIteration,
      };

      // 1. 执行 INITIALIZATION 时机的微代理（会话开始时，仅一次）
      const initResult = await this.executeMicroAgents(MicroAgentTrigger.INITIALIZATION, microAgentContext, chunk => {
        microAgentChunks.push(chunk);
      });
      microAgentContext = initResult.context;

      // 输出收集到的微代理执行详情
      for (const chunk of microAgentChunks) {
        yield chunk;
      }
      microAgentChunks.length = 0; // 清空队列

      // 如果微代理修改了 llmClient（例如模型切换），更新
      if (microAgentContext.llmClient) {
        llmClient = microAgentContext.llmClient;
      }

      // 如果微代理要求更新系统提示词，重新构建
      let systemPrompt = await this.buildSystemPromptWithFragments(
        this.config.systemPrompt,
        Array.from(microAgentContext.activatedFragments || activatedFragments),
        options?.sessionId,
      );

      if (initResult.shouldUpdateSystemPrompt) {
        systemPrompt = await this.buildSystemPromptWithFragments(
          this.config.systemPrompt,
          Array.from(microAgentContext.activatedFragments || activatedFragments),
          options?.sessionId,
        );
      }

      // 使用微代理可能修改后的消息
      if (typeof input === 'string') {
        // 字符串输入：构建新的消息历史
        messages = [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: input }];
      } else {
        // 使用微代理可能修改后的消息，或原始输入
        messages = microAgentContext.messages.length > 0 ? microAgentContext.messages : input;
        // 确保系统提示词是最新的
        const systemMsgIndex = messages.findIndex(msg => msg.role === 'system');
        if (systemMsgIndex >= 0) {
          messages[systemMsgIndex]!.content = systemPrompt;
        } else {
          messages.unshift({ role: 'system', content: systemPrompt });
        }
      }
    } else {
      // 未启用微代理，使用原始逻辑
      const systemPrompt = await this.buildSystemPromptWithFragments(this.config.systemPrompt, Array.from(activatedFragments), options?.sessionId);

      if (typeof input === 'string') {
        messages = [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: input }];
      } else {
        const convertedMessages: UnifiedChat.Message[] = [];
        let hasSystemPrompt = false;

        for (const msg of input) {
          if (msg.role === 'system') {
            hasSystemPrompt = true;
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
          const systemMsgIndex = convertedMessages.findIndex(msg => msg.role === 'system');
          if (systemMsgIndex >= 0 && convertedMessages[systemMsgIndex]) {
            convertedMessages[systemMsgIndex]!.content = systemPrompt;
          }
        }

        messages = convertedMessages;
      }
    }

    // 累计所有迭代的 token 使用情况
    const accumulatedTokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost: 0,
    };

    const maxIterations = 100;
    let currentLlmClient = llmClient;

    while (getIteration() < maxIterations) {
      const iteration = incrementIteration();
      console.log(`[ReactAgent] 🔄 ReAct 循环 ${iteration}/${maxIterations}`);

      // 如果启用了微代理，在每次迭代前执行 PRE_ITERATION（支持动态修改）
      if (options?.enableMicroAgents !== false) {
        const microAgentContext: MicroAgentContext = {
          messages,
          agentConfig: {
            modelId: options?.modelId || '',
          },
          activatedFragments: new Set<string>(),
          llmClient: currentLlmClient,
          iteration,
        };

        const preIterResult = await this.executeMicroAgents(MicroAgentTrigger.PRE_ITERATION, microAgentContext);

        // 如果微代理修改了上下文，应用修改
        if (preIterResult.context.messages !== messages) {
          messages = preIterResult.context.messages;
        }
        if (preIterResult.context.llmClient && preIterResult.context.llmClient !== currentLlmClient) {
          currentLlmClient = preIterResult.context.llmClient;
        }
        if (preIterResult.shouldUpdateSystemPrompt) {
          const systemMsgIndex = messages.findIndex(msg => msg.role === 'system');
          if (systemMsgIndex >= 0) {
            const newSystemPrompt = await this.buildSystemPromptWithFragments(
              this.config.systemPrompt,
              Array.from(preIterResult.context.activatedFragments || new Set()),
              options?.sessionId,
            );
            messages[systemMsgIndex]!.content = newSystemPrompt;
          }
        }
        if (preIterResult.shouldRetry) {
          decrementIteration(); // 重试当前迭代
          continue;
        }
      }

      // Think + Act 阶段：调用 LLM
      // 验证消息不为空
      if (!messages || messages.length === 0) {
        throw new Error('Cannot call LLM with empty messages array');
      }

      // 验证至少有一条非系统消息
      const hasNonSystemMessage = messages.some(msg => {
        if (msg.role === 'system') return false;
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        return content && content.trim().length > 0;
      });

      if (!hasNonSystemMessage) {
        throw new Error('Cannot call LLM without at least one non-system message with content');
      }

      const chatParams: UnifiedChat.ChatCompletionParams = {
        messages,
        tools: this.config.tools.length > 0 ? this.config.tools : undefined,
        tool_choice: this.config.tools.length > 0 ? 'auto' : undefined,
      };

      const stream = currentLlmClient.chatStream(chatParams);

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
              // 如果启用了微代理，在工具调用前执行 PRE_TOOL_CALL
              if (options?.enableMicroAgents !== false) {
                for (const toolCall of validToolCalls) {
                  const microAgentContext: MicroAgentContext = {
                    messages,
                    agentConfig: {
                      modelId: options?.modelId || '',
                    },
                    activatedFragments: new Set<string>(),
                    llmClient: currentLlmClient,
                    iteration,
                    metadata: {
                      toolCall: {
                        name: toolCall.function.name,
                        arguments: toolCall.function.arguments,
                      },
                    },
                  };

                  await this.executeMicroAgents(MicroAgentTrigger.PRE_TOOL_CALL, microAgentContext, chunk => {
                    microAgentChunks.push(chunk);
                  });
                }

                // 输出收集到的微代理执行详情
                for (const chunk of microAgentChunks) {
                  yield chunk;
                }
                microAgentChunks.length = 0; // 清空队列
              }

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

              // 如果启用了微代理，在工具调用后执行 POST_TOOL_CALL
              // 注意：这里工具结果还未返回，POST_TOOL_CALL 主要用于记录和统计
              if (options?.enableMicroAgents !== false) {
                for (const toolCall of validToolCalls) {
                  const microAgentContext: MicroAgentContext = {
                    messages,
                    agentConfig: {
                      modelId: options?.modelId || '',
                    },
                    activatedFragments: new Set<string>(),
                    llmClient: currentLlmClient,
                    iteration,
                    metadata: {
                      toolCall: {
                        name: toolCall.function.name,
                        arguments: toolCall.function.arguments,
                      },
                    },
                  };

                  await this.executeMicroAgents(MicroAgentTrigger.POST_TOOL_CALL, microAgentContext, chunk => {
                    microAgentChunks.push(chunk);
                  });
                }

                // 输出收集到的微代理执行详情
                for (const chunk of microAgentChunks) {
                  yield chunk;
                }
                microAgentChunks.length = 0; // 清空队列
              }

              // 在返回前输出 token 使用情况，确保 workflow 能捕获到 token 信息
              // 使用当前迭代的 token（inputTokens/outputTokens），而不是累积的 token
              if (inputTokens > 0 || outputTokens > 0) {
                yield {
                  type: 'action',
                  content: '',
                  tokenUsage: {
                    promptTokens: inputTokens,
                    completionTokens: outputTokens,
                    totalTokens: inputTokens + outputTokens,
                  },
                };
              }

              // 注意：工具执行在浏览器端完成，这里只输出调用信息
              // 实际的工具结果需要通过消息历史传入下一轮循环
              // 这里返回，等待工具结果添加到 messages 后继续
              return;
            }
          }

          // 没有工具调用，说明是最终答案
          if (accumulatedContent || !toolCalls.length) {
            // 如果启用了微代理，在最终答案生成前执行 PRE_FINAL_ANSWER
            if (options?.enableMicroAgents !== false) {
              const microAgentContext: MicroAgentContext = {
                messages: [...messages, { role: 'assistant', content: accumulatedContent || '' }],
                agentConfig: {
                  modelId: options?.modelId || '',
                },
                activatedFragments: new Set<string>(),
                llmClient: currentLlmClient,
                iteration,
                metadata: {
                  finalAnswer: accumulatedContent,
                },
              };

              const preFinalResult = await this.executeMicroAgents(MicroAgentTrigger.PRE_FINAL_ANSWER, microAgentContext);

              // 如果微代理修改了最终答案
              if (preFinalResult.context.metadata?.finalAnswer) {
                accumulatedContent = preFinalResult.context.metadata.finalAnswer as string;
              }
            }

            // 添加助手消息到历史
            messages.push({
              role: 'assistant',
              content: accumulatedContent || '',
            });

            // 累积 token 使用情况
            accumulatedTokenUsage.promptTokens += inputTokens;
            accumulatedTokenUsage.completionTokens += outputTokens;
            accumulatedTokenUsage.totalTokens += inputTokens + outputTokens;

            // 如果启用了微代理，在迭代后执行 POST_ITERATION
            if (options?.enableMicroAgents !== false) {
              const microAgentContext: MicroAgentContext = {
                messages,
                agentConfig: {
                  modelId: options?.modelId || '',
                },
                activatedFragments: new Set<string>(),
                llmClient: currentLlmClient,
                iteration,
              };

              await this.executeMicroAgents(MicroAgentTrigger.POST_ITERATION, microAgentContext, chunk => {
                microAgentChunks.push(chunk);
              });

              // 输出收集到的微代理执行详情
              for (const chunk of microAgentChunks) {
                yield chunk;
              }
              microAgentChunks.length = 0; // 清空队列
            }

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
   * @param basePrompt 基础系统提示词
   * @param fragmentIds 片段ID列表（已废弃，保留用于兼容性，不再使用）
   * @param sessionId 会话ID，用于获取动态系统提示词片段
   */
  protected async buildSystemPromptWithFragments(basePrompt?: string, fragmentIds?: string[], sessionId?: string): Promise<string> {
    const systemPrompt = basePrompt || this.config.systemPrompt || 'You are a helpful assistant.';

    // 构建基础提示词（框架层只提供最基本的 ReAct 工作方式指导）
    let fullPrompt = `${systemPrompt}

## ReAct 工作方式

你是一个基于 ReAct（Reasoning + Acting）框架的智能代理。工作流程：

1. **Think（思考）**：分析当前情况，理解任务需求，规划下一步行动
2. **Act（行动）**：执行工具调用，获取信息或执行操作
3. **Observe（观察）**：分析工具执行结果，评估任务进度

继续循环 Think -> Act -> Observe，直到任务完成。`;

    // 从工具设置的动态系统提示词片段
    if (sessionId) {
      const dynamicSystemPrompt = getSessionDynamicSystemPrompt(sessionId);
      if (dynamicSystemPrompt) {
        fullPrompt += `\n\n${dynamicSystemPrompt}`;
      }
    }

    return fullPrompt;
  }

  /**
   * 构建系统提示词（向后兼容方法）
   * 子类可以覆盖此方法来自定义提示词构建逻辑
   */
  protected async buildSystemPrompt(basePrompt?: string, sessionId?: string): Promise<string> {
    return this.buildSystemPromptWithFragments(basePrompt, undefined, sessionId);
  }
}
