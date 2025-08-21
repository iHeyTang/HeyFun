import { EventItem } from "@repo/agent";
import { taskRuntime } from "./runtime";

class SSERuntime {
  private connections: Map<string, ReadableStreamDefaultController> = new Map();

  // 创建SSE流
  createSSEStream(taskId: string): ReadableStream {
    return new ReadableStream({
      start: (controller) => {
        // 检查任务是否存在
        const task = taskRuntime.getTask(taskId);
        if (!task) {
          controller.close();
          return;
        }

        // 建立连接
        this.createConnection(taskId, controller);

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
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    };
  }

  private createConnection(
    taskId: string,
    controller: ReadableStreamDefaultController
  ): void {
    this.connections.set(taskId, controller);

    // 注册事件监听器
    taskRuntime.addEventListener(taskId, (event: EventItem) => {
      this.sendEvent(taskId, event);
      if (event.name === "agent:lifecycle:complete") {
        console.log(`[SSE ${taskId}] Task completed, closing connection`);
        this.removeConnection(taskId);
      }
    });

    console.log(`[SSE ${taskId}] Connection established`);
  }

  private removeConnection(taskId: string): void {
    const controller = this.connections.get(taskId);
    if (controller) {
      controller.close();
      console.log(`[SSE ${taskId}] Connection closed`);
    }
    this.connections.delete(taskId);
    taskRuntime.removeEventListener(taskId);
    console.log(`[SSE ${taskId}] Connection removed`);
  }

  private sendEvent(taskId: string, event: EventItem): boolean {
    const controller = this.connections.get(taskId);
    if (!controller) {
      return false;
    }

    try {
      controller.enqueue(
        new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)
      );
      console.debug(`[SSE ${taskId}] Event sent:`, event.name);
      return true;
    } catch (error) {
      console.error(`[SSE ${taskId}] Failed to send event:`, error);
      return false;
    }
  }

  private sendHistoricalEvents(
    taskId: string,
    controller: ReadableStreamDefaultController
  ): void {
    const task = taskRuntime.getTask(taskId);
    if (!task || !task.history || task.history.length === 0) {
      return;
    }

    console.log(
      `[SSE ${taskId}] Sending ${task.history.length} historical events`
    );

    task.history.forEach((event: EventItem, index: number) => {
      try {
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)
        );
        console.log(
          `[SSE ${taskId}] Historical event ${index + 1} sent:`,
          event.name
        );
      } catch (error) {
        console.error(
          `[SSE ${taskId}] Failed to send historical event ${index + 1}:`,
          error
        );
      }
    });
  }
}

// 创建全局SSE运行时实例
export const sseRuntime = new SSERuntime();
