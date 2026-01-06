/**
 * React Agent 框架
 * 基于 ReAct（Reasoning + Acting）框架的智能代理框架层
 *
 * 参考 demo/react-agent.ts 的结构，以硬编码形式实现 ReAct 循环
 * 这是一个框架层实现，提供 ReAct 循环的基础能力。
 * Preset 层可以继承此框架，配置特定的工具和提示词来完成不同场景的任务。
 */

import { buildSystemPrompt, createDynamicBlock, createFrameworkBlock, SystemPromptTemplate } from '@/agents/core/system-prompt';
import { getSessionDynamicSystemPrompt } from '@/agents/tools/context';
import { ChatClient, UnifiedChat } from '@repo/llm/chat';
import { BaseAgent } from '../base';
import { toolRegistry } from '@/agents/tools';

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

const REACT_FRAMEWORK_NEXT_STEP = `你现在需要继续执行下一步行动。请根据已经获取的信息，继续执行下一步行动。`;

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
 * 现在只负责 Reason 阶段，直接使用 BaseAgent 的返回类型
 */
export type ReactStreamChunk = {
  type: 'content' | 'tool_call' | 'token_usage';
  content?: string;
  toolCall?: UnifiedChat.ToolCall;
  tokenUsage?: { promptTokens?: number; completionTokens?: number };
};

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
   * 流式执行单次 Agent 调用
   * 不再包含循环逻辑，循环由外部（如 Workflow）管理
   * 每次调用处理一次 Think-Act 阶段
   */
  async *reason(
    llmClient: ChatClient,
    input: string | UnifiedChat.Message[],
    history: UnifiedChat.Message[] = [],
    options?: {
      modelId?: string;
      enabledFragmentIds?: string[];
      sessionId?: string; // 会话ID，用于获取动态系统提示词片段
      iterationProvider?: IterationProvider; // 迭代次数提供者（保留以兼容现有代码，但不再使用）
    },
  ): AsyncGenerator<ReactStreamChunk> {
    // 构建消息历史
    let messages: UnifiedChat.Message[];

    if (typeof input === 'string') {
      messages = [...history, { role: 'user', content: input }];
    } else {
      messages = input;
    }

    // 调用 BaseAgent 的 chatStream 方法，直接透传
    yield* this.chatStream(llmClient, messages, this.dynamicTools, {
      sessionId: options?.sessionId,
    });
  }

  getNextStepPrompt(): string {
    return REACT_FRAMEWORK_NEXT_STEP;
  }

  /**
   * 构建系统提示词
   * 分为两段：
   * 1. basePrompt（内置）：Preset + Framework，永远不变
   * 2. dynamicPrompt（动态）：Dynamic 层，可选，可以插入或替换
   *
   * @param sessionId 会话ID，用于获取动态系统提示词片段
   */
  protected async buildSystemPrompt(sessionId?: string): Promise<{ basePrompt: string; dynamicPrompt?: string }> {
    // 构建内置提示词（Preset + Framework）
    const baseTemplate: SystemPromptTemplate = {
      preset: this.config.promptBlocks,
      framework: [createFrameworkBlock('react-workflow', REACT_FRAMEWORK_TEMPLATE, { title: 'ReAct 工作方式' })],
      dynamic: [],
    };
    const basePrompt = buildSystemPrompt(baseTemplate);

    // 构建动态提示词（Dynamic 层）
    let dynamicPrompt: string | undefined;
    if (sessionId) {
      const dynamicSystemPrompt = getSessionDynamicSystemPrompt(sessionId);
      if (dynamicSystemPrompt) {
        const dynamicTemplate: SystemPromptTemplate = {
          preset: [],
          framework: [],
          dynamic: [createDynamicBlock('retrieved-fragments', dynamicSystemPrompt, { title: '任务相关指导' })],
        };
        dynamicPrompt = buildSystemPrompt(dynamicTemplate);
      }
    }

    return { basePrompt, dynamicPrompt };
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
