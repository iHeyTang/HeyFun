import CHAT, { ChatClient, ChatClientConfig, UnifiedChat } from '@repo/llm/chat';
import type { EventHandler, EventItem } from '../event';
import { AgentEvent, createEventItem } from '../event';
import { BaseAgentEvents, ReActAgentEvents, ToolCallAgentEvents } from '../event/constants';
import sandboxManager, { SandboxRunner } from '../sandbox';
import { Memory } from '../utils/memory';
import { createMessage } from '../utils/message';

// 导出事件相关类型和常量，便于其他地方使用
export { BaseAgentEvents, ReActAgentEvents, ToolCallAgentEvents };
export type { EventHandler, EventItem };

// Agent执行状态
export enum AgentState {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  FINISHED = 'FINISHED',
  ERROR = 'ERROR',
}

export interface TokenUsage {
  input: number;
  completion: number;
}

export interface StepResult {
  success?: boolean;
  prompt?: string;
  result?: string;
  usage?: {
    think: TokenUsage;
    act: TokenUsage;
    total: TokenUsage;
  };
  terminated?: boolean;
}

// BaseAgent配置接口
export interface BaseAgentConfig {
  name: string;
  llm?: ChatClient | { modelId: string };  // 支持传入客户端或配置
  description?: string;
  should_plan?: boolean;
  task_id: string;
  memory?: Memory;
  state?: AgentState;
  max_steps?: number;
  current_step?: number;
  duplicate_threshold?: number;
  enable_event_queue?: boolean;
  sandboxId: string;
}

/**
 * Abstract base class for managing agent state and execution.
 * 直接使用LLMClient和OpenAI标准类型，无包装层。
 */
export abstract class BaseAgent {
  // Core attributes
  public readonly name: string;
  public readonly description?: string;
  public readonly should_plan: boolean;

  // Dependencies - 直接使用原生类型
  public llm: ChatClient;
  public memory: Memory;
  public state: AgentState;
  public sandboxId: string;
  public sandbox?: SandboxRunner;
  // Execution control
  public readonly max_steps: number;
  public current_step: number;
  public readonly duplicate_threshold: number;
  public readonly enable_event_queue: boolean;

  // Private attributes
  private _private_event_queue?: AgentEvent;

  public signalUserTerminate: boolean = false;

  constructor(config: BaseAgentConfig) {
    this.name = config.name;
    this.description = config.description;
    this.should_plan = config.should_plan ?? true;
    this.state = config.state ?? AgentState.IDLE;
    this.max_steps = config.max_steps ?? 20;
    this.current_step = config.current_step ?? 0;
    this.duplicate_threshold = config.duplicate_threshold ?? 2;
    this.enable_event_queue = config.enable_event_queue ?? true;
    this.sandboxId = config.sandboxId;

    // Initialize LLM - 直接使用ChatClient或根据modelId创建
    if (!config.llm) {
      throw new Error('LLM configuration is required');
    }
    
    if (config.llm instanceof ChatClient) {
      this.llm = config.llm;
    } else if ('modelId' in config.llm) {
      // 根据 modelId 创建客户端
      this.llm = CHAT.createClient(config.llm.modelId);
    } else {
      throw new Error('Invalid LLM configuration');
    }

    // Initialize memory
    this.memory = config.memory ?? new Memory({ llm: this.llm });

    // Initialize event queue - 使用事件系统
    if (this.enable_event_queue) {
      this._private_event_queue = new AgentEvent();
      this._private_event_queue.start();
    }
  }

  /**
   * Cleanup resources
   */
  protected async cleanup(): Promise<void> {}

  /**
   * Add a message to the agent's memory - 直接使用OpenAI类型
   */
  public async updateMemory(message: UnifiedChat.Message): Promise<void> {
    await this.memory.addMessage(message);
    this.emit(BaseAgentEvents.MEMORY_ADDED, {
      role: message.role,
      message: message,
    });
  }

  /**
   * 便捷方法：添加用户消息
   */
  public async addUserMessage(content: string): Promise<void> {
    await this.updateMemory(createMessage.user(content));
  }

  /**
   * 便捷方法：添加系统消息
   */
  public async addSystemMessage(content: string): Promise<void> {
    await this.updateMemory(createMessage.system(content));
  }

  /**
   * 便捷方法：添加助手消息
   */
  public async addAssistantMessage(content?: string): Promise<void> {
    await this.updateMemory(createMessage.assistant(content));
  }

  /**
   * 使用LLM进行聊天 - 直接使用LLMClient
   */
  public async chat(params?: Partial<UnifiedChat.ChatCompletionParams>): Promise<UnifiedChat.ChatCompletion> {
    const messages = this.memory.getMessagesForLLM();
    return this.llm.chat({ messages, ...params });
  }

  /**
   * Prepare the agent for execution
   */
  public async *prepare(): AsyncGenerator<{ phase: string; data: any }, void, unknown> {
    // For now, it's a placeholder
    yield { phase: BaseAgentEvents.LIFECYCLE_PREPARE_PROGRESS, data: { progress: 'Preparing agent...' } };
    this.sandbox = await sandboxManager.getOrCreateOneById(this.sandboxId);
    yield { phase: BaseAgentEvents.LIFECYCLE_PREPARE_PROGRESS, data: { progress: 'Agent prepared' } };
  }

  /**
   * Execute a single step with streaming output.
   * Must be implemented by subclasses to define specific streaming behavior.
   */
  public abstract step(): AsyncGenerator<{ phase: string; data: any }, StepResult, unknown>;

  /**
   * Handle stuck state by adding a prompt to change strategy
   */
  public handleStuckState(): void {
    const stuck_prompt = 'Observed duplicate responses. Consider new strategies and avoid repeating ineffective paths already attempted.';
    console.warn(`Agent detected stuck state. Added prompt: ${stuck_prompt}`);

    this.emit(BaseAgentEvents.STATE_STUCK_HANDLED, {
      new_prompt: stuck_prompt,
    });
  }

  /**
   * Check if the agent is stuck in a loop by detecting duplicate content
   */
  public isStuck(): boolean {
    if (this.memory.messages.length < 2) {
      return false;
    }

    const messages = this.memory.messages;
    const last_message = messages[messages.length - 1];

    // 只检查assistant消息
    if (!last_message || last_message.role !== 'assistant' || !last_message.content) {
      return false;
    }

    // Count identical content occurrences
    let duplicate_count = 0;
    for (let i = messages.length - 2; i >= 0; i--) {
      const msg = messages[i];
      if (msg && msg.role === 'assistant' && msg.content === last_message.content) {
        duplicate_count += 1;
      }
    }

    return duplicate_count >= this.duplicate_threshold;
  }

  /**
   * Register an event handler for events matching the specified pattern
   */
  public on(event_pattern: string, handler: EventHandler): void {
    if (typeof handler !== 'function') {
      throw new Error('Event handler must be a function');
    }
    if (this._private_event_queue) {
      this._private_event_queue.addHandler(event_pattern, handler);
    }
  }

  /**
   * Emit an event and add it to the processing queue
   */
  public emit(name: string, data: any, options?: { id?: string; parent_id?: string }): void {
    if (!this.enable_event_queue || !this._private_event_queue) {
      return;
    }

    const event = createEventItem(name, this.current_step, data, options);
    this._private_event_queue.put(event);
  }

  /**
   * Request to terminate the current task
   */
  public async terminate(): Promise<void> {
    this.signalUserTerminate = true;
    this.emit(BaseAgentEvents.LIFECYCLE_TERMINATING, {});
  }
}

// 简单的工厂函数
export function createAgent(config: BaseAgentConfig): BaseAgent {
  throw new Error('BaseAgent is abstract. Use a concrete implementation.');
}
