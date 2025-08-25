import { EventItem, FunMax, FunMaxConfig } from '@repo/agent';
import NEXT_STEP_PROMPT from '../prompt/funmax/next';
import PLAN_PROMPT from '../prompt/funmax/plan';
import SYSTEM_PROMPT from '../prompt/funmax/system';

export interface TaskStatus {
  status: 'pending' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  history: EventItem[];
  createdAt: Date;
  updatedAt: Date;
}

class TaskRuntime {
  private tasks: Map<string, TaskStatus> = new Map();
  private eventListeners: Map<string, (event: EventItem) => void> = new Map();

  createTask(taskId: string, config: FunMaxConfig): void {
    // 设置默认提示模板
    if (!config.promptTemplates) {
      config.promptTemplates = {
        system: SYSTEM_PROMPT,
        next: NEXT_STEP_PROMPT,
        plan: PLAN_PROMPT,
      };
    }
    config.promptTemplates.system = config.promptTemplates.system || SYSTEM_PROMPT;
    config.promptTemplates.next = config.promptTemplates.next || NEXT_STEP_PROMPT;
    config.promptTemplates.plan = config.promptTemplates.plan || PLAN_PROMPT;

    const now = new Date();
    const taskStatus: TaskStatus = {
      status: 'pending',
      history: [],
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.set(taskId, taskStatus);

    // 异步执行任务
    setImmediate(async () => {
      try {
        const agent = new FunMax(config);

        // 监听所有agent事件
        agent.on('agent:*', (event: EventItem) => {
          this.addEvent(taskId, event);
        });

        await agent.run(config.task_request);

        // 任务完成
        this.updateTaskStatus(taskId, 'completed');
      } catch (error) {
        console.error(`[Task ${taskId}] Agent execution failed:`, error);
        this.updateTaskStatus(taskId, 'failed', undefined, error instanceof Error ? error.message : String(error));
      }
    });
  }

  getTask(taskId: string): TaskStatus | undefined {
    return this.tasks.get(taskId);
  }

  getAllTasks(): Map<string, TaskStatus> {
    return new Map(this.tasks);
  }

  updateTaskStatus(taskId: string, status: TaskStatus['status'], result?: unknown, error?: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
      task.result = result;
      task.error = error;
      task.updatedAt = new Date();
      this.tasks.set(taskId, task);
    }
  }

  addEvent(taskId: string, event: EventItem): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.history.push(event);
      task.updatedAt = new Date();
      this.tasks.set(taskId, task);

      // 通知事件监听器
      const listener = this.eventListeners.get(taskId);
      if (listener) {
        try {
          listener(event);
        } catch (error) {
          console.error(`[Task ${taskId}] Event listener error:`, error);
        }
      }
    }
  }

  removeTask(taskId: string): void {
    this.tasks.delete(taskId);
    this.eventListeners.delete(taskId);
  }

  // SSE相关方法
  addEventListener(taskId: string, listener: (event: EventItem) => void): void {
    this.eventListeners.set(taskId, listener);
  }

  removeEventListener(taskId: string): void {
    this.eventListeners.delete(taskId);
  }
}

// 创建全局任务运行时实例
export const taskRuntime = new TaskRuntime();
