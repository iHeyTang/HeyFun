import { Chat } from '@repo/llm/chat';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import sandboxManager from '../sandbox';
import { ToolCallContextHelper } from '../tools/toolcall';
import type { AddMcpConfig } from '../tools/types';
import { createMessage } from '../utils/message';
import { renderTemplate } from '../utils/template';
import { BaseAgentEvents } from './base';
import { ReActAgent, ReActAgentConfig } from './react';

export interface PromptTemplates {
  system: string;
  next: string;
  plan: string;
}

export interface FunMaxConfig extends ReActAgentConfig {
  task_request: string;
  language?: string;
  tools?: AddMcpConfig[];
  history?: Chat.ChatCompletionMessageParam[];
  promptTemplates?: PromptTemplates;
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
  public readonly history: Chat.ChatCompletionMessageParam[];
  public readonly custom_prompt_templates: PromptTemplates;

  // 上下文助手（暂时设为可选，实际使用时需要初始化）
  private _tool_call_context_helper?: ToolCallContextHelper;

  constructor(config: FunMaxConfig) {
    super(config);

    this.language = config.language || 'English';
    this.tools = config.tools || [];
    this.task_request = config.task_request;
    this.history = config.history || [];
    this.custom_prompt_templates = config.promptTemplates || {
      system: '',
      next: '',
      plan: '',
    };
  }

  /**
   * 准备代理执行
   */
  public async prepare(): Promise<void> {
    await super.prepare();
    // 获取进程用户信息
    console.log('👤 Process User Info:');
    console.log(`   User ID: ${process.getuid ? process.getuid() : 'N/A (Windows)'}`);
    console.log(`   Group ID: ${process.getgid ? process.getgid() : 'N/A (Windows)'}`);
    console.log(`   Username: ${os.userInfo().username}`);
    console.log(`   Home Directory: ${os.homedir()}`);
    console.log(`   Platform: ${os.platform()}`);
    console.log(`   Architecture: ${os.arch()}`);
    console.log(`   Node.js Version: ${process.version}`);
    console.log(`   Process ID: ${process.pid}`);
    console.log(`   Current Working Directory: ${process.cwd()}`);

    // 添加系统提示词到内存
    const system_prompt = renderTemplate(this.custom_prompt_templates.system, {
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

    // 初始化沙盒
    this.sandbox = await sandboxManager.getOrCreateOneById(this.sandboxId);

    // 初始化上下文助手
    this._tool_call_context_helper = new ToolCallContextHelper(this);

    // 初始化工具集合
    await this.initializeTools();

    // 生成任务摘要
    setImmediate(async () => {
      const summary = await this.generateTaskSummary();
      this.emit(BaseAgentEvents.LIFECYCLE_SUMMARY, { summary });
    });
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
  private async generateTaskSummary(): Promise<string> {
    try {
      const response = await this.llm.chat({
        messages: [
          createMessage.user(this.task_request),
          createMessage.system(
            "Summarize the requirements or tasks provided by the user, Ensure that the core of the task can be reflected, answer in the user's language within 15 characters",
          ),
        ],
      });

      return response.choices[0]?.message?.content || 'Task summary not available';
    } catch (error: any) {
      console.error('Error generating task summary:', error?.message || error);
      return 'Unable to generate task summary';
    }
  }

  /**
   * 制定计划
   */
  public async plan(): Promise<string> {
    this.emit(BaseAgentEvents.LIFECYCLE_PLAN_START, {});

    const planPrompt = renderTemplate(this.custom_prompt_templates.plan, {
      language: this.language || 'English',
      max_steps: this.max_steps,
      available_tools:
        this._tool_call_context_helper?.availableTools.tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n') || 'No tools available',
    });

    try {
      const response = await this.llm.chat({
        messages: [createMessage.system(planPrompt), createMessage.user(this.task_request)],
      });

      const planningMessage = response.choices[0]?.message?.content || 'Unable to create plan';

      // 将计划添加到内存
      await this.updateMemory(createMessage.user(planningMessage));
      this.emit(BaseAgentEvents.LIFECYCLE_PLAN_COMPLETE, {
        plan: planningMessage,
      });

      return planningMessage;
    } catch (error) {
      console.error('Error creating plan:', error);
      throw error;
    }
  }

  /**
   * 思考阶段 - 处理当前状态并决定下一步行动
   */
  public async think(): Promise<boolean> {
    // 更新下一步提示词
    const next_step_prompt = renderTemplate(this.custom_prompt_templates.next, {
      max_steps: this.max_steps,
      current_step: this.current_step,
      remaining_steps: this.max_steps - this.current_step,
      language: this.language || 'English',
    });

    let result = false;
    if (this._tool_call_context_helper) {
      result = await this._tool_call_context_helper.askTool(next_step_prompt);
    }

    return result;
  }

  /**
   * 行动阶段 - 执行决定的行动
   */
  public async act(): Promise<string> {
    if (!this._tool_call_context_helper) {
      return 'No tool context helper available';
    }

    const results = await this._tool_call_context_helper.executeTool();
    return results.join('\n\n');
  }

  /**
   * 检查浏览器是否在最近使用
   */
  private checkBrowserInUseRecently(): boolean {
    const recentMessages = this.memory.messages.slice(-3);

    // 这里简化实现，实际需要检查消息中的tool_calls
    // const browserInUse = recentMessages.some(...);

    return false; // 暂时返回false
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
