import { EventItem, FunMax, FunMaxConfig } from '@repo/agent';

export interface TaskStatus {
  agent: FunMax;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  history: EventItem[];
  createdAt: Date;
  updatedAt: Date;
}

type TaskRuntimeListener = (event: EventItem) => void | Promise<void>;

export class TaskRuntime {
  private agent: FunMax;
  private status: TaskStatus['status'] = 'pending';
  private result?: unknown;
  private error?: string;
  private history: EventItem[] = [];
  private eventListeners: Map<string, TaskRuntimeListener> = new Map();
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(config: FunMaxConfig) {
    const now = new Date();
    this.createdAt = now;
    this.updatedAt = now;

    this.agent = new FunMax(config);
  }

  static createTask(config: FunMaxConfig): TaskRuntime {
    return new TaskRuntime(config);
  }

  async run(taskRequest: string): Promise<void> {
    try {
      this.status = 'running';
      this.updatedAt = new Date();

      // 监听所有agent事件
      this.agent.on('agent:*', async (event: EventItem) => {
        this.history.push(event);
        this.updatedAt = new Date();
        // 通知事件监听器
        for (const [, listener] of this.eventListeners) {
          try {
            await listener(event);
          } catch (error) {
            console.error('Event listener error:', error);
          }
        }
      });

      await this.agent.run(taskRequest);

      this.status = 'completed';
      this.updatedAt = new Date();
    } catch (error) {
      console.error('Agent execution failed:', error);
      this.status = 'failed';
      this.error = error instanceof Error ? error.message : String(error);
      this.updatedAt = new Date();
    }
  }

  getStatus(): TaskStatus {
    return {
      agent: this.agent,
      status: this.status,
      result: this.result,
      error: this.error,
      history: [...this.history],
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  async terminate(): Promise<void> {
    await this.agent.terminate();
  }

  on(eventType: string, listener: TaskRuntimeListener): void {
    this.eventListeners.set(eventType, listener);
  }
}
