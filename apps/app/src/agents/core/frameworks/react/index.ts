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
import { getSessionDynamicSystemPrompt } from '@/agents/tools/context';
import { toolRegistry } from '@/agents/tools';
import { buildSystemPrompt, createFrameworkBlock, createDynamicBlock, SystemPromptTemplate, SystemPromptBlock } from '@/agents/core/system-prompt';

// ============================================================================
// ReAct 框架层提示词模板
// ============================================================================

const REACT_FRAMEWORK_TEMPLATE = `
你是一个基于 ReAct（Reasoning + Acting）框架的智能代理。

## 工作流程

1. **Think（思考）**：分析当前情况，理解任务需求，规划下一步行动
2. **Act（行动）**：执行工具调用，获取信息或执行操作
3. **Observe（观察）**：分析工具执行结果，评估任务进度

继续循环 Think -> Act -> Observe，直到任务完成。
`.trim();

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
  // 动态工具列表（运行时添加的工具）
  private dynamicTools: UnifiedChat.Tool[] = [];

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
      enabledFragmentIds?: string[];
      sessionId?: string; // 会话ID，用于获取动态系统提示词片段
      iterationProvider?: IterationProvider; // 迭代次数提供者，用于在 Workflow 等外部环境中管理迭代次数
    },
  ): AsyncGenerator<ReactStreamChunk> {
    // 构建消息历史
    let messages: UnifiedChat.Message[];

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

    // 构建系统提示词
    const systemPrompt = await this.buildSystemPrompt(options?.sessionId);

    if (typeof input === 'string') {
      messages = [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: input }];
    } else {
      // 过滤掉原有的 system 消息，使用新构建的 systemPrompt
      const nonSystemMessages = input.filter(msg => msg.role !== 'system');
      messages = [{ role: 'system', content: systemPrompt }, ...nonSystemMessages];
    }

    // 累计所有迭代的 token 使用情况
    const accumulatedTokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost: 0,
    };

    const maxIterations = 100;
    const currentLlmClient = llmClient;

    while (getIteration() < maxIterations) {
      const iteration = incrementIteration();
      console.log(`[ReactAgent] 🔄 ReAct 循环 ${iteration}/${maxIterations}`);

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

      // 合并基础工具和动态添加的工具
      const allTools = [...this.config.tools, ...this.dynamicTools];

      const chatParams: UnifiedChat.ChatCompletionParams = {
        messages,
        tools: allTools.length > 0 ? allTools : undefined,
        tool_choice: allTools.length > 0 ? 'auto' : undefined,
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
                  const args = toolCall.function.arguments;
                  if (typeof args === 'string') {
                    // 检查是否是 "[object Object]" 这种错误转换的字符串
                    if (args === '[object Object]') {
                      console.error(`[ReactAgent] Tool ${toolCall.function.name} has invalid arguments: "[object Object]"`);
                      toolArgs = {};
                    } else {
                      toolArgs = JSON.parse(args || '{}');
                    }
                  } else if (typeof args === 'object' && args !== null) {
                    toolArgs = args;
                  }
                } catch (e) {
                  console.error(`[ReactAgent] 解析工具参数失败 (tool: ${toolCall.function.name}):`, e);
                  // 解析失败时使用空对象，避免工具执行时出错
                  toolArgs = {};
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

              // 在返回前输出 token 使用情况，确保 workflow 能捕获到 token 信息
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
   * 获取框架层的提示词 Blocks
   * 子类可以覆盖此方法来添加或修改框架层 Blocks
   */
  protected getFrameworkBlocks(): SystemPromptBlock[] {
    return [
      createFrameworkBlock('react-workflow', REACT_FRAMEWORK_TEMPLATE, {
        title: 'ReAct 工作方式',
        priority: 100,
      }),
    ];
  }

  /**
   * 构建系统提示词
   * 使用分层模板系统组装最终的系统提示词
   *
   * 组装顺序：
   * 1. Preset 层 Blocks（来自 config.promptBlocks）
   * 2. 框架层 Blocks（ReAct 工作方式）
   * 3. 动态层 Blocks（检索到的提示词片段）
   *
   * @param sessionId 会话ID，用于获取动态系统提示词片段
   */
  protected async buildSystemPrompt(sessionId?: string): Promise<string> {
    // 构建提示词模板
    const template: SystemPromptTemplate = {
      preset: this.config.promptBlocks,
      framework: this.getFrameworkBlocks(),
      dynamic: [],
    };

    // 动态层：从工具设置的动态系统提示词片段
    if (sessionId) {
      const dynamicSystemPrompt = getSessionDynamicSystemPrompt(sessionId);
      if (dynamicSystemPrompt) {
        template.dynamic = [
          createDynamicBlock('retrieved-fragments', dynamicSystemPrompt, {
            title: '任务相关指导',
            priority: 0,
          }),
        ];
      }
    }

    // 使用 builder 组装最终的系统提示词
    return buildSystemPrompt(template);
  }

  /**
   * 动态添加工具到agent的可用工具列表
   * 当检索到新工具时，调用此方法将工具添加到可用工具列表
   */
  addTools(tools: UnifiedChat.Tool[]): void {
    for (const tool of tools) {
      // 检查工具是否已经添加
      const toolName = tool.function?.name;
      if (!toolName) continue;

      const exists = this.dynamicTools.some(t => t.function?.name === toolName);
      if (!exists) {
        this.dynamicTools.push(tool);
        console.log(`[ReactAgent] ✅ 动态添加工具: ${toolName}`);
      }
    }
  }

  /**
   * 根据工具名称列表添加工具（从工具注册表中获取）
   */
  addToolsByName(toolNames: string[]): void {
    const tools: UnifiedChat.Tool[] = [];

    for (const toolName of toolNames) {
      const toolDef = toolRegistry.getToolDefinition(toolName);
      if (toolDef) {
        tools.push({
          type: 'function',
          function: {
            name: toolDef.name,
            description: toolDef.description,
            parameters: toolDef.parameters,
          },
        });
      }
    }

    this.addTools(tools);
  }
}
