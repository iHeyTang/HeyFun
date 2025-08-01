import { nanoid } from 'nanoid';

// 事件相关接口和类型
export interface EventItem {
  id: string;
  parent_id?: string;
  name: string;
  step: number;
  timestamp: Date;
  content: any;
}

export type EventHandler = (event: EventItem) => Promise<void> | void;

interface EventPattern {
  pattern: RegExp;
  handler: EventHandler;
}

// AgentEvent类 - 基于Python版本移植
export class AgentEvent {
  private queue: EventItem[] = [];
  private processing = false;
  private eventFlag = false;
  private task?: Promise<void>;
  private handlers: EventPattern[] = [];
  private shouldStop = false;

  put(event: EventItem): void {
    this.queue.push(event);
    this.eventFlag = true;
    // 如果没有在处理，启动处理
    if (!this.processing) {
      this.processEvents();
    }
  }

  addHandler(event_pattern: string, handler: EventHandler): void {
    if (typeof handler !== 'function') {
      throw new Error('Event handler must be a callable');
    }
    this.handlers.push({
      pattern: new RegExp(event_pattern),
      handler
    });
  }

  private async processEvents(): Promise<void> {
    if (this.processing) return;

    this.processing = true;
    console.log('Event processing loop started');

    while (!this.shouldStop) {
      try {
        // 等待事件
        while (!this.eventFlag && !this.shouldStop) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        if (this.shouldStop) break;

        // 处理队列中的所有事件
        while (this.queue.length > 0) {
          const event = this.queue.shift()!;
          console.log(`Processing event: ${event.name}`);

          if (this.handlers.length === 0) {
            console.warn('No event handlers registered');
            continue;
          }

          let handler_found = false;
          for (const pattern of this.handlers) {
            if (pattern.pattern.test(event.name)) {
              handler_found = true;
              try {
                await pattern.handler(event);
              } catch (e) {
                console.error(`Error in event handler for ${event.name}:`, e);
              }
            }
          }

          if (!handler_found) {
            console.warn(`No matching handler found for event: ${event.name}`);
          }
        }

        // 清空事件标志
        if (this.queue.length === 0) {
          this.eventFlag = false;
        }

      } catch (e) {
        console.error('Unexpected error in event processing loop:', e);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    this.processing = false;
    console.log('Event processing loop stopped');
  }

  start(): void {
    this.shouldStop = false;
    if (!this.processing) {
      this.task = this.processEvents();
    }
  }

  stop(): void {
    this.shouldStop = true;
  }
}

// 便捷函数：创建事件项
export function createEventItem(
  name: string,
  step: number,
  content: any,
  options?: { id?: string; parent_id?: string }
): EventItem {
  return {
    id: options?.id || nanoid(),
    parent_id: options?.parent_id,
    name,
    step,
    timestamp: new Date(),
    content
  };
}
