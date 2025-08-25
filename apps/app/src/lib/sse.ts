import { EventItem } from '@repo/agent';
import { taskRuntime } from './runtime';

class SSERuntime {
  private connections: Map<string, ReadableStreamDefaultController> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  private heartbeatFailures: Map<string, number> = new Map();
  private readonly HEARTBEAT_INTERVAL = 3000; // 3秒心跳间隔
  private readonly MAX_HEARTBEAT_FAILURES = 3; // 最大心跳失败次数

  // 创建SSE流
  createSSEStream(taskId: string): ReadableStream {
    return new ReadableStream({
      start: controller => {
        // 检查任务是否存在
        const task = taskRuntime.getTask(taskId);
        if (!task) {
          controller.close();
          return;
        }

        // 建立连接
        this.createConnection(taskId, controller);

        // 启动心跳机制
        this.startHeartbeat(taskId);

        // 发送历史消息
        this.sendHistoricalEvents(taskId, controller);
      },
      cancel: () => {
        // 客户端取消连接
        this.removeConnection(taskId);
        console.log(`[SSE ${taskId}] Connection cancelled by client`);
      },
    });
  }

  // 获取SSE响应头
  getSSEHeaders(): HeadersInit {
    return {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    };
  }

  private createConnection(taskId: string, controller: ReadableStreamDefaultController): void {
    this.connections.set(taskId, controller);

    // 注册事件监听器
    taskRuntime.addEventListener(taskId, (event: EventItem) => {
      this.sendEvent(taskId, event);
      if (event.name === 'agent:lifecycle:complete') {
        console.log(`[SSE ${taskId}] Task completed, closing connection`);
        this.removeConnection(taskId);
      }
    });

    console.log(`[SSE ${taskId}] Connection established`);
  }

  private removeConnection(taskId: string): void {
    const controller = this.connections.get(taskId);
    if (controller) {
      try {
        controller.close();
        console.log(`[SSE ${taskId}] Connection closed`);
      } catch (error) {
        console.error(`[SSE ${taskId}] Error closing controller:`, error);
      }
    }
    this.connections.delete(taskId);

    // 清理心跳定时器
    this.stopHeartbeat(taskId);

    // 清理心跳失败计数
    this.heartbeatFailures.delete(taskId);

    taskRuntime.removeEventListener(taskId);
    console.log(`[SSE ${taskId}] Connection removed`);
  }

  private sendEvent(taskId: string, event: EventItem): boolean {
    const controller = this.connections.get(taskId);
    if (!controller) {
      return false;
    }

    try {
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
      console.debug(`[SSE ${taskId}] Event sent:`, event.name);
      return true;
    } catch (error) {
      console.error(`[SSE ${taskId}] Failed to send event:`, error);
      return false;
    }
  }

  private sendHistoricalEvents(taskId: string, controller: ReadableStreamDefaultController): void {
    const task = taskRuntime.getTask(taskId);
    if (!task || !task.history || task.history.length === 0) {
      return;
    }

    console.log(`[SSE ${taskId}] Sending ${task.history.length} historical events`);

    task.history.forEach((event: EventItem, index: number) => {
      try {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
        console.log(`[SSE ${taskId}] Historical event ${index + 1} sent:`, event.name);
      } catch (error) {
        console.error(`[SSE ${taskId}] Failed to send historical event ${index + 1}:`, error);
      }
    });
  }

  private startHeartbeat(taskId: string): void {
    // 如果已有心跳定时器，先清理
    this.stopHeartbeat(taskId);

    const heartbeatInterval = setInterval(() => {
      try {
        const success = this.sendHeartbeat(taskId);
        if (!success) {
          const failures = (this.heartbeatFailures.get(taskId) || 0) + 1;
          this.heartbeatFailures.set(taskId, failures);

          console.log(`[SSE ${taskId}] Heartbeat failed (${failures}/${this.MAX_HEARTBEAT_FAILURES})`);

          if (failures >= this.MAX_HEARTBEAT_FAILURES) {
            console.log(`[SSE ${taskId}] Max heartbeat failures reached, cleaning up connection`);
            this.removeConnection(taskId);
          }
        } else {
          // 心跳成功，重置失败计数
          this.heartbeatFailures.set(taskId, 0);
        }
      } catch (error) {
        console.error(`[SSE ${taskId}] Heartbeat interval error:`, error);
        this.removeConnection(taskId);
      }
    }, this.HEARTBEAT_INTERVAL);

    this.heartbeatIntervals.set(taskId, heartbeatInterval);
    console.log(`[SSE ${taskId}] Heartbeat started with ${this.HEARTBEAT_INTERVAL}ms interval`);
  }

  private stopHeartbeat(taskId: string): void {
    const interval = this.heartbeatIntervals.get(taskId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(taskId);
      console.log(`[SSE ${taskId}] Heartbeat stopped`);
    }
  }

  private sendHeartbeat(taskId: string): boolean {
    const controller = this.connections.get(taskId);
    if (!controller) {
      return false;
    }

    try {
      controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'));
      console.log(`[SSE ${taskId}] Heartbeat sent`);
      return true;
    } catch (error) {
      console.error(`[SSE ${taskId}] Failed to send heartbeat:`, error);
      return false;
    }
  }
}

// 创建全局SSE运行时实例
export const sseRuntime = new SSERuntime();
