import type { Chat } from '@repo/llm/chat';
import { AgentState, type BaseAgent } from '../agent/base';
import { BaseAgentEvents, ToolCallAgentEvents } from '../event/constants';
import { createMessage } from '../utils/message';
import { to } from '../utils/to';
import { ToolCollection } from './collection';
import { FileSystemTool } from './tools/file-system';
import { TerminateTool } from './tools/terminate';
import type { AddMcpConfig, BaseTool } from './types';
import { TerminalTool } from './tools/terminal';

/**
 * 工具调用上下文助手实现
 */
export class ToolCallContextHelper {
  public availableTools: ToolCollection;

  // 工具选择模式
  private toolChoice: Chat.ChatCompletionToolChoiceOption = 'auto';

  // 特殊工具名称列表
  private specialToolNames: string[] = ['terminate'];

  // 当前工具调用列表
  private toolCalls: Chat.ChatCompletionMessageToolCall[] = [];

  // 最大观察长度
  private maxObserve: number = 10000;

  constructor(private agent: BaseAgent) {
    // 初始化工具集合，包含默认工具
    this.availableTools = new ToolCollection();
    this.addTool(new TerminateTool());
    this.addTool(new FileSystemTool(this.agent.sandbox!));
    this.addTool(new TerminalTool(this.agent.sandbox!));
  }

  async initiate() {
    this.agent.emit(BaseAgentEvents.LIFECYCLE_PREPARE_PROGRESS, { message: 'Initializing tools...' });
    await this.availableTools.initiate(this.agent.sandbox!);
    this.agent.emit(BaseAgentEvents.LIFECYCLE_PREPARE_PROGRESS, { message: 'Tools initialized' });
  }

  /**
   * 添加工具
   */
  addTool(tool: BaseTool): void {
    this.availableTools.addTool(tool);
  }

  /**
   * 添加MCP
   */
  async addMcp(config: AddMcpConfig): Promise<void> {
    this.agent.emit(BaseAgentEvents.LIFECYCLE_PREPARE_PROGRESS, { message: `Adding MCP: ${config.name}` });
    await this.availableTools.addMcp(config);
    this.agent.emit(BaseAgentEvents.LIFECYCLE_PREPARE_PROGRESS, { message: `MCP ${config.name} added` });
  }

  /**
   * 询问工具 - 让LLM选择要使用的工具
   */
  async askTool(prompt: string): Promise<boolean> {
    // 添加next_step_prompt作为用户消息
    if (prompt) {
      await this.agent.updateMemory(createMessage.user(prompt));
    }

    // 获取可用工具列表
    const tools = this.availableTools.toOpenAITools();

    // 发送工具调用请求
    const response = await this.agent.llm.chat({
      messages: this.agent.memory.getMessagesForLLM(),
      tools,
      tool_choice: this.toolChoice,
    });

    // 提取工具调用和内容
    this.toolCalls = this.extractToolCalls(response);
    const content = response.choices[0]?.message?.content || '';

    // 发射工具选择事件
    this.agent.emit(ToolCallAgentEvents.TOOL_SELECTED, {
      thoughts: content,
      tool_calls: this.toolCalls,
    });

    if (this.toolCalls.length > 0) {
      const toolInfo = {
        tools: this.toolCalls.map(call => call.function.name),
        arguments: this.toolCalls[0]?.function?.arguments,
      };
    }

    // 处理不同的工具选择模式
    return this.handleToolChoiceResponse(content);
  }

  /**
   * 执行工具调用
   */
  async executeTool(): Promise<string[]> {
    this.agent.emit(ToolCallAgentEvents.TOOL_START, {
      tool_calls: this.toolCalls,
    });

    if (this.toolCalls.length === 0) {
      if (this.toolChoice === 'required') {
        throw new Error('Tool calls required but none provided');
      }

      // 返回最后一条消息的内容
      const lastMessage = this.agent.memory.messages[this.agent.memory.messages.length - 1];
      const content = this.extractStringContent(lastMessage?.content);
      return [content || 'No content or commands to execute'];
    }

    const results: string[] = [];

    for (const toolCall of this.toolCalls) {
      const result = await this.executeToolCommand(toolCall);

      // 限制观察长度
      const truncatedResult = this.maxObserve ? result.substring(0, this.maxObserve) : result;

      console.log(`🎯 Tool '${toolCall.function.name}' completed! Result: ${truncatedResult.slice(0, 100)}`);

      // 添加工具响应到内存
      await this.agent.updateMemory(createMessage.tool(result, toolCall.id));

      results.push(result);
    }

    this.agent.emit(ToolCallAgentEvents.TOOL_COMPLETE, { results });
    return results;
  }

  /**
   * 执行单个工具命令
   */
  private async executeToolCommand(toolCall: Chat.ChatCompletionMessageToolCall): Promise<string> {
    if (!toolCall?.function?.name) {
      return 'Error: Invalid command format';
    }

    if (!this.availableTools.hasTool(toolCall.function.name)) {
      return `Error: Unknown tool '${toolCall.function.name}'`;
    }
    const toolInfo = this.availableTools.getTool(toolCall.function.name)!;

    try {
      const args = JSON.parse(toolCall.function.arguments || '{}');

      console.log(`🔧 Activating tool: '${toolCall.function.name}' (internal: '${toolInfo.name}')...`);

      this.agent.emit(ToolCallAgentEvents.TOOL_EXECUTE_START, {
        id: toolCall.id,
        name: toolInfo.name,
        args,
      });

      const result = await this.availableTools.execute(toolCall.function.name, args);

      this.agent.emit(ToolCallAgentEvents.TOOL_EXECUTE_COMPLETE, {
        id: toolCall.id,
        name: toolInfo.name,
        args,
        result: result,
        error: result.isError ? result.content[0]?.text : undefined,
      });

      // 处理特殊工具
      await this.handleSpecialTool(toolInfo.name, result);

      // 格式化结果显示
      const observation =
        typeof result === 'string'
          ? `Observed output of cmd \`${toolInfo.name}\` executed:\n${result}`
          : `Observed output of cmd \`${toolInfo.name}\` executed:\n${JSON.stringify(result.content)}`;

      return observation || `Cmd \`${toolInfo.name}\` completed with no output`;
    } catch (error) {
      let errorMsg: string;

      if (error instanceof SyntaxError) {
        errorMsg = `Error parsing arguments for ${toolInfo.name}: Invalid JSON format`;
        console.error(`📝 Arguments for '${toolInfo.name}' are invalid JSON: ${toolCall.function.arguments}`);
      } else {
        errorMsg = `⚠️ Tool '${toolInfo.name}' encountered a problem: ${error}`;
        console.error(errorMsg, error);
      }

      this.agent.emit(ToolCallAgentEvents.TOOL_EXECUTE_COMPLETE, {
        id: toolCall.id,
        name: toolInfo.name,
        args: {},
        error: errorMsg,
      });

      return `Error: ${errorMsg}`;
    }
  }

  /**
   * 处理特殊工具执行
   */
  private async handleSpecialTool(name: string, result: any): Promise<void> {
    if (!this.isSpecialTool(name)) {
      return;
    }

    if (this.shouldFinishExecution(name, result)) {
      console.log(`🏁 Special tool '${name}' has completed the task!`);
      this.agent.state = AgentState.FINISHED;
    }
  }

  /**
   * 检查是否为特殊工具
   */
  private isSpecialTool(name: string): boolean {
    return this.specialToolNames.some(special => special.toLowerCase() === name.toLowerCase());
  }

  /**
   * 判断是否应该结束执行
   */
  private shouldFinishExecution(name: string, result: any): boolean {
    // 对于terminate工具，总是结束执行
    return name.toLowerCase() === 'terminate';
  }

  /**
   * 清理工具资源
   */
  async cleanup(): Promise<void> {
    console.log('🧼 Cleaning up tool resources...');

    // 清理工具集合
    await this.availableTools.cleanup();

    console.log('🧼 Tool cleanup complete');
  }

  // 辅助方法

  /**
   * 提取字符串内容（处理OpenAI复杂内容类型）
   */
  private extractStringContent(content: any): string {
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      // 如果是数组，提取文本部分
      return content
        .filter(part => part.type === 'text')
        .map(part => part.text)
        .join('');
    }
    return String(content || '');
  }

  /**
   * 从响应中提取工具调用
   */
  private extractToolCalls(response: Chat.ChatCompletion): Chat.ChatCompletionMessageToolCall[] {
    const toolCalls = response.choices[0]?.message?.tool_calls;
    if (!toolCalls) return [];

    return toolCalls.map(tc => ({
      id: tc.id,
      type: 'function' as const,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments || '{}',
      },
    }));
  }

  /**
   * 处理工具选择响应
   */
  private async handleToolChoiceResponse(content: string): Promise<boolean> {
    // 处理不同模式
    if (this.toolChoice === 'none') {
      if (this.toolCalls.length > 0) {
        console.warn(`🤔 ${this.agent.name} tried to use tools when they weren't available!`);
      }
      if (content) {
        await this.agent.updateMemory(createMessage.assistant(content));
        return true;
      }
      return false;
    }

    // 创建并添加assistant消息
    const assistantMsg = createMessage.assistant(content, this.toolCalls);

    await this.agent.updateMemory(assistantMsg);

    if (this.toolChoice === 'required' && this.toolCalls.length === 0) {
      return true; // 将在act()中处理
    }

    // 对于auto模式，如果没有工具调用但有内容，继续处理
    if (this.toolChoice === 'auto' && this.toolCalls.length === 0) {
      return !!content;
    }

    return this.toolCalls.length > 0;
  }

  /**
   * 设置工具选择模式
   */
  setToolChoice(choice: Chat.ChatCompletionToolChoiceOption): void {
    this.toolChoice = choice;
  }

  /**
   * 设置最大观察长度
   */
  setMaxObserve(maxObserve: number): void {
    this.maxObserve = maxObserve;
  }

  /**
   * 添加特殊工具名称
   */
  addSpecialTool(name: string): void {
    if (!this.specialToolNames.includes(name)) {
      this.specialToolNames.push(name);
    }
  }
}
