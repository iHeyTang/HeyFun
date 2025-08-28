import { Chat, LLMClient, LLMClientConfig } from '@repo/llm/chat';
import type { EventHandler, EventItem } from '../event';
import { AgentEvent, createEventItem } from '../event';
import { BaseAgentEvents, ReActAgentEvents, ToolCallAgentEvents } from '../event/constants';
import { Memory } from '../utils/memory';
import { createMessage } from '../utils/message';
import sandboxManager, { SandboxRunner } from '../sandbox';

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

// BaseAgent配置接口
export interface BaseAgentConfig {
  name: string;
  llm: LLMClient | LLMClientConfig;
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
  public llm: LLMClient;
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

    // Initialize LLM - 直接使用LLMClient
    this.llm = config.llm instanceof LLMClient ? config.llm : new LLMClient(config.llm);

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
   * Context manager for safe agent state transitions
   */
  public async withStateContext<T>(new_state: AgentState, operation: () => Promise<T>): Promise<T> {
    if (!Object.values(AgentState).includes(new_state)) {
      throw new Error(`Invalid state: ${new_state}`);
    }

    const previous_state = this.state;
    this.state = new_state;

    try {
      this.emit(BaseAgentEvents.STATE_CHANGE, {
        old_state: previous_state,
        new_state: this.state,
      });

      const result = await operation();
      return result;
    } catch (error) {
      this.state = AgentState.ERROR;
      this.emit(BaseAgentEvents.STATE_CHANGE, {
        old_state: this.state,
        new_state: AgentState.ERROR,
      });
      throw error;
    } finally {
      this.state = previous_state;
      this.emit(BaseAgentEvents.STATE_CHANGE, {
        old_state: this.state,
        new_state: previous_state,
      });
    }
  }

  /**
   * Add a message to the agent's memory - 直接使用OpenAI类型
   */
  public async updateMemory(message: Chat.ChatCompletionMessageParam): Promise<void> {
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
  public async chat(params?: Partial<Chat.ChatCompletionCreateParams>): Promise<Chat.ChatCompletion> {
    const messages = this.memory.getMessagesForLLM();
    return this.llm.chat({ messages, ...params });
  }

  /**
   * Prepare the agent for execution
   */
  public async prepare(): Promise<void> {
    // For now, it's a placeholder
    this.sandbox = await sandboxManager.getOrCreateOneById(this.sandboxId);
  }

  /**
   * Plan the agent's actions for the given request
   */
  public async plan(): Promise<string> {
    return '';
  }

  /**
   * Execute the agent's main loop asynchronously
   */
  public async run(request: string): Promise<string> {
    try {
      if (this.state !== AgentState.IDLE) {
        throw new Error(`Cannot run agent from state: ${this.state}`);
      }

      this.emit(BaseAgentEvents.LIFECYCLE_START, { request });

      const results: string[] = [];
      this.emit(BaseAgentEvents.LIFECYCLE_PREPARE_START, {});
      await this.prepare();
      this.emit(BaseAgentEvents.LIFECYCLE_PREPARE_COMPLETE, {});

      await this.withStateContext(AgentState.RUNNING, async () => {
        if (request) {
          await this.addUserMessage(request);
          if (this.should_plan) {
            await this.plan();
          }
        }

        while (this.current_step < this.max_steps && this.state !== AgentState.FINISHED) {
          this.current_step += 1;
          console.log(`Executing step ${this.current_step}/${this.max_steps}`);

          try {
            const step_result = await this.step();

            // Check for stuck state
            if (this.isStuck()) {
              this.emit(BaseAgentEvents.STATE_STUCK_DETECTED, {});
              this.handleStuckState();
            }

            results.push(`Step ${this.current_step}: ${step_result}`);

            if (this.signalUserTerminate) {
              this.state = AgentState.FINISHED;
            }
          } catch (error) {
            throw error;
          }
        }

        if (this.current_step >= this.max_steps) {
          this.current_step = 0;
          this.state = AgentState.IDLE;
          this.emit(BaseAgentEvents.STEP_MAX_REACHED, {
            max_steps: this.max_steps,
          });
          results.push(`Terminated: Reached max steps (${this.max_steps})`);
        }
      });

      if (this.signalUserTerminate) {
        this.emit(BaseAgentEvents.LIFECYCLE_TERMINATED, {});
      } else {
        this.emit(BaseAgentEvents.LIFECYCLE_COMPLETE, { results });
      }

      return results.length > 0 ? results.join('\n') : 'No steps executed';
    } catch (error) {
      this.emit(BaseAgentEvents.LIFECYCLE_ERROR, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      console.log(`🧹Cleaning up resources for agent '${this.name}'...`);
      await this.cleanup();
      console.log(`✨ Cleanup complete for agent '${this.name}'.`);
    }
  }

  /**
   * Execute a single step in the agent's workflow.
   * Must be implemented by subclasses to define specific behavior.
   */
  public abstract step(): Promise<string>;

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

export function createLLMConfig(providerId: string, modelId: string, apiKey: string, additionalConfig?: Partial<LLMClientConfig>): LLMClientConfig {
  return {
    providerId,
    modelId,
    apiKey,
    ...additionalConfig,
  };
}
