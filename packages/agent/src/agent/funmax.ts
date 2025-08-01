import { Chat } from "@repo/llm";
import { ToolCallContextHelper } from "../tools/toolcall";
import { NEXT_STEP_PROMPT, PLAN_PROMPT, SYSTEM_PROMPT } from "../prompt/funmax";
import type { ToolConfig } from "../tools/types";
import { createMessage } from "../utils/message";
import { templateManager } from "../utils/template";
import { BaseAgentEvents } from "./base";
import { ReActAgent, ReActAgentConfig } from "./react";

export interface FunMaxConfig extends ReActAgentConfig {
  task_request: string;
  language?: string;
  tools?: ToolConfig[];
  history?: Chat.ChatCompletionMessageParam[];
  custom_prompt_templates?: Record<string, string>;
}

/**
 * 任务上下文接口
 */
export interface TaskContext {
  task_id: string;
  task_dir: string;
  organization_id: string;
}

/**
 * FunMax - 一个多功能通用代理
 * 可以使用多种工具解决各种任务的通用代理
 */
export class FunMax extends ReActAgent {
  public readonly name: string = "FunMax";
  public readonly description: string =
    "A versatile agent that can solve various tasks using multiple tools";

  // 配置属性
  public readonly language: string;
  public readonly tools: ToolConfig[];
  public readonly task_request: string;
  public readonly history: Chat.ChatCompletionMessageParam[];
  public readonly custom_prompt_templates: Record<string, string>;

  // 动态设置的提示词
  public system_prompt: string = "";
  public next_step_prompt: string = "";

  // 任务上下文
  public task_context: TaskContext;

  // 提示词模板
  private system_prompt_template: string = "";
  private next_step_prompt_template: string = "";
  private plan_prompt_template: string = "";

  // 上下文助手（暂时设为可选，实际使用时需要初始化）
  private _tool_call_context_helper?: ToolCallContextHelper;

  constructor(config: FunMaxConfig) {
    super(config);

    this.language = config.language || "English";
    this.tools = config.tools || [];
    this.task_request = config.task_request;
    this.history = config.history || [];
    this.custom_prompt_templates = config.custom_prompt_templates || {};

    // 解析任务ID以获取任务上下文
    const [organization_id, task_id] = this.task_id.split("/");
    if (!organization_id || !task_id) {
      throw new Error("Invalid task ID");
    }
    this.task_context = {
      task_id,
      task_dir: `/workspace/${organization_id}/${task_id}`,
      organization_id,
    };

    // 初始化模板
    this.initializeTemplates();

    // 只渲染固定的系统提示词
    this.renderSystemPrompt();
  }

  /**
   * 初始化提示词模板
   */
  private initializeTemplates(): void {
    this.system_prompt_template =
      this.custom_prompt_templates.system_prompt || SYSTEM_PROMPT;
    this.next_step_prompt_template =
      this.custom_prompt_templates.next_step_prompt || NEXT_STEP_PROMPT;
    this.plan_prompt_template =
      this.custom_prompt_templates.plan_prompt || PLAN_PROMPT;
  }

  /**
   * 渲染系统提示词（固定内容）
   */
  private renderSystemPrompt(): void {
    this.system_prompt = templateManager.renderTemplateSafe(
      this.system_prompt_template,
      {
        task_id: this.task_context.task_id,
        name: this.name,
        language: this.language || "English",
        max_steps: this.max_steps,
        current_time:
          new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC",
      }
    );
  }

  /**
   * 渲染下一步提示词（动态内容）
   */
  private renderNextStepPrompt(): void {
    this.next_step_prompt = templateManager.renderTemplateSafe(
      this.next_step_prompt_template,
      {
        max_steps: this.max_steps,
        current_step: this.current_step,
        remaining_steps: this.max_steps - this.current_step,
      }
    );
  }

  /**
   * 准备代理执行
   */
  public async prepare(): Promise<void> {
    await super.prepare();

    // 添加系统提示词到内存
    await this.updateMemory(createMessage.system(this.system_prompt));

    // 添加历史消息到内存
    if (this.history && this.history.length > 0) {
      for (const message of this.history) {
        await this.updateMemory(message);
      }
    }

    // 初始化上下文助手
    this._tool_call_context_helper = new ToolCallContextHelper(this);

    // 初始化工具集合
    await this.initializeTools();

    // 生成任务摘要
    const summary = await this.generateTaskSummary();
    this.emit(BaseAgentEvents.LIFECYCLE_SUMMARY, { summary });

    console.log(summary);
    console.log("--------------------------------");
    console.log(
      `prepare success, available tools: ${this._tool_call_context_helper?.availableTools.tools.map((tool) => tool.name).join(", ") || "none"}`
    );
  }

  /**
   * 初始化工具
   */
  private async initializeTools(): Promise<void> {
    if (!this._tool_call_context_helper) return;

    // 添加系统工具和MCP工具
    for (const tool of this.tools) {
      await this._tool_call_context_helper.addMcp({
        client_id: tool.id,
        url: tool.url,
        command: tool.command,
        args: tool.args,
        env: tool.env,
        headers: tool.headers,
      });
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
            "Summarize the requirements or tasks provided by the user, Ensure that the core of the task can be reflected, answer in the user's language within 15 characters"
          ),
        ],
      });

      return (
        response.choices[0]?.message?.content || "Task summary not available"
      );
    } catch (error) {
      console.error("Error generating task summary:", error);
      return "Unable to generate task summary";
    }
  }

  /**
   * 制定计划
   */
  public async plan(): Promise<string> {
    this.emit(BaseAgentEvents.LIFECYCLE_PLAN_START, {});

    const planPrompt = templateManager.renderTemplateSafe(
      this.plan_prompt_template,
      {
        language: this.language || "English",
        max_steps: this.max_steps,
        available_tools:
          this._tool_call_context_helper?.availableTools.tools
            .map((tool) => `- ${tool.name}: ${tool.description}`)
            .join("\n") || "No tools available",
      }
    );

    try {
      const response = await this.llm.chat({
        messages: [
          createMessage.system(planPrompt),
          createMessage.user(this.task_request),
        ],
      });

      const planningMessage =
        response.choices[0]?.message?.content || "Unable to create plan";

      // 将计划添加到内存
      await this.updateMemory(createMessage.user(planningMessage));
      this.emit(BaseAgentEvents.LIFECYCLE_PLAN_COMPLETE, {
        plan: planningMessage,
      });

      return planningMessage;
    } catch (error) {
      console.error("Error creating plan:", error);
      throw error;
    }
  }

  /**
   * 思考阶段 - 处理当前状态并决定下一步行动
   */
  public async think(): Promise<boolean> {
    // 更新下一步提示词
    const originalPrompt = this.next_step_prompt;
    this.renderNextStepPrompt();

    let result = false;
    if (this._tool_call_context_helper) {
      result = await this._tool_call_context_helper.askTool();
    }

    // 恢复原始提示词
    this.next_step_prompt = originalPrompt;

    return result;
  }

  /**
   * 行动阶段 - 执行决定的行动
   */
  public async act(): Promise<string> {
    if (!this._tool_call_context_helper) {
      return "No tool context helper available";
    }

    const results = await this._tool_call_context_helper.executeTool();
    return results.join("\n\n");
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
   * 清理代理资源
   */
  public async cleanupAgent(): Promise<void> {
    console.log(`🧹 Cleaning up resources for agent '${this.name}'...`);

    if (this._tool_call_context_helper) {
      await this._tool_call_context_helper.cleanup();
    }

    await super.cleanupAgent();
    console.log(`✨ Cleanup complete for agent '${this.name}'.`);
  }
}
