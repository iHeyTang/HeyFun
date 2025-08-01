import { NextRequest } from "next/server";
import { EventItem } from "../../../../../../../packages/agent/src/event";

// 从主路由导入任务状态（这里需要共享状态）
declare global {
  var sseConnections: Map<string, ReadableStreamDefaultController>;
  var taskStatus: Map<
    string,
    {
      status: "pending" | "completed" | "failed";
      result?: any;
      error?: string;
      history: EventItem[];
    }
  >;
}

// 确保全局变量存在
if (!global.taskStatus) {
  global.taskStatus = new Map();
}
if (!global.sseConnections) {
  global.sseConnections = new Map();
}

// 辅助函数：安全地发送SSE事件
const sendSSEEvent = (
  controller: ReadableStreamDefaultController,
  event: any
) => {
  try {
    controller.enqueue(
      new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)
    );
    return true;
  } catch (error) {
    console.error(`[SSE] Failed to send event:`, error);
    return false;
  }
};

export const GET = async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get("taskId");

  if (!taskId) {
    return new Response("taskId is required", { status: 400 });
  }

  const task = global.taskStatus.get(taskId);
  if (!task) {
    return new Response("Task not found", { status: 404 });
  }

  // 创建 SSE 流
  const stream = new ReadableStream({
    start(controller) {
      // 存储控制器引用
      global.sseConnections.set(taskId, controller);

      // 发送已有的历史事件
      if (task.history && task.history.length > 0) {
        console.log(
          `[SSE ${taskId}] Sending ${task.history.length} historical events`
        );
        task.history.forEach((event: any, index: number) => {
          const success = sendSSEEvent(controller, event);
          if (success) {
            console.log(
              `[SSE ${taskId}] Historical event ${index + 1} sent:`,
              event.name
            );
          }
        });
      }

      if (task.status === "completed") {
        controller.close();
        global.sseConnections.delete(taskId);
      } else if (task.status === "failed") {
        controller.close();
        global.sseConnections.delete(taskId);
      }
    },
    cancel() {
      // 清理连接
      global.sseConnections.delete(taskId);
      console.log(`[SSE ${taskId}] Connection cancelled by client`);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    },
  });
};
