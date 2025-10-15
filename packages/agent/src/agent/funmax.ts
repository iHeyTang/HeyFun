import { UnifiedChat } from '@repo/llm/chat';
import NEXT_STEP_PROMPT from '../prompts/next';
import SYSTEM_PROMPT from '../prompts/system';
import { ToolCallContextHelper, ToolExecutionProgress, ToolSelectionProgress } from '../tools/toolcall';
import type { AddMcpConfig } from '../tools/types';
import { createMessage } from '../utils/message';
import { renderTemplate } from '../utils/template';
import { ReActAgent, ReActAgentConfig } from './react';
import { BaseAgentEvents } from './base';

export interface FunMaxConfig extends ReActAgentConfig {
  task_request: string;
  language?: string;
  tools?: AddMcpConfig[];
  history?: UnifiedChat.Message[];
  systemPromptTemplate?: string;
}

/**
 * FunMax - 一个多功能通用代理
 * 可以使用多种工具解决各种任务的通用代理
 */
export class FunMax extends ReActAgent {
  public readonly name: string = 'FunMax';
  public readonly description: string = 'A versatile agent that can solve various tasks using multiple tools';

  // 配置属性
  public readonly language: string;
  public readonly tools: AddMcpConfig[];
  public readonly task_request: string;
  public readonly history: UnifiedChat.Message[];
  public readonly system_prompt_template: string;

  // 上下文助手（暂时设为可选，实际使用时需要初始化）
  private _tool_call_context_helper?: ToolCallContextHelper;

  constructor(config: FunMaxConfig) {
    super(config);

    this.language = config.language || 'English';
    this.tools = config.tools || [];
    this.task_request = config.task_request;
    this.history = config.history || [];
    this.system_prompt_template = config.systemPromptTemplate || SYSTEM_PROMPT;
  }

  /**
   * 准备代理执行
   */
  public async *prepare(): AsyncGenerator<{ phase: string; data: any }, void, unknown> {
    yield { phase: BaseAgentEvents.LIFECYCLE_PREPARE_START, data: {} };
    yield* super.prepare();

    // 添加系统提示词到内存
    const system_prompt = renderTemplate(this.system_prompt_template, {
      language: this.language || 'English',
      max_steps: this.max_steps,
      current_time: new Date().toISOString(),
      workspace_dir: '/heyfun/workspace',
    });
    await this.updateMemory(createMessage.system(system_prompt));

    // 添加历史消息到内存
    if (this.history && this.history.length > 0) {
      for (const message of this.history) {
        await this.updateMemory(message);
      }
    }

    // 初始化上下文助手
    this._tool_call_context_helper = new ToolCallContextHelper(this);

    // 初始化工具集合
    yield { phase: BaseAgentEvents.LIFECYCLE_PREPARE_PROGRESS, data: { progress: 'Initializing tools...' } };
    await this.initializeTools();
    yield { phase: BaseAgentEvents.LIFECYCLE_PREPARE_PROGRESS, data: { progress: 'Tools initialized' } };
    yield { phase: BaseAgentEvents.LIFECYCLE_PREPARE_COMPLETE, data: {} };
  }

  /**
   * 初始化工具
   */
  private async initializeTools(): Promise<void> {
    if (!this._tool_call_context_helper) return;
    await this._tool_call_context_helper.initiate();

    const map = new Map<string, AddMcpConfig>();
    for (const tool of this.tools) {
      map.set(tool.id, tool);
    }

    // 添加系统工具和MCP工具;
    for (const tool of this.tools) {
      await this._tool_call_context_helper.addMcp(tool);
    }
  }

  /**
   * 生成任务摘要
   */
  async generateTaskSummary(): Promise<string> {
    try {
      const response = await this.llm.chat({
        messages: [
          createMessage.system(
            "Generate a concise title that captures the essence of the user's request or task. Do not answer the question or provide solutions - only create a descriptive title. Use the user's language and keep it within 15 characters.",
          ),
          createMessage.user(this.task_request),
        ],
      });

      const content = response.choices[0]?.message?.content;
      return typeof content === 'string' ? content : 'Task summary not available';
    } catch (error: any) {
      console.error('Error generating task summary:', error?.message || error);
      return 'Unable to generate task summary';
    }
  }

  /**
   * 思考阶段 - 处理当前状态并决定下一步行动
   */
  public async *think(): AsyncGenerator<ToolSelectionProgress, { prompt: string; result: boolean }, unknown> {
    // 更新下一步提示词
    const next_step_prompt = renderTemplate(NEXT_STEP_PROMPT, {
      max_steps: this.max_steps,
      current_step: this.current_step,
      remaining_steps: this.max_steps - this.current_step,
      language: this.language || 'English',
    });

    let result = false;
    if (this._tool_call_context_helper) {
      const askToolStream = this._tool_call_context_helper.askToolStream(next_step_prompt);
      let iteratorResult;

      while (!(iteratorResult = await askToolStream.next()).done) {
        const toolSelectionProgress = iteratorResult.value;
        yield toolSelectionProgress;
      }

      result = iteratorResult.value;
    }

    return { prompt: next_step_prompt, result };
  }

  /**
   * 行动阶段 - 执行决定的行动（流式版本）
   */
  public async *act(): AsyncGenerator<ToolExecutionProgress, string, unknown> {
    if (!this._tool_call_context_helper) {
      return 'No tool context helper available';
    }

    const toolStream = this._tool_call_context_helper.executeToolStream();
    let iteratorResult;

    while (!(iteratorResult = await toolStream.next()).done) {
      const progress = iteratorResult.value;
      yield progress;
    }

    const results = iteratorResult.value;
    return results.join('\n\n');
  }

  /**
   * 清理资源
   */
  protected async cleanup(): Promise<void> {
    if (this._tool_call_context_helper) {
      await this._tool_call_context_helper.cleanup();
    }
    await super.cleanup();
  }
}
