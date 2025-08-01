import { FunMax, FunMaxConfig } from "@repo/agent";
import { Chat } from "@repo/llm";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { EventItem } from "../../../../../../packages/agent/src/event";

// 声明全局变量
declare global {
  var taskStatus: Map<
    string,
    {
      status: "pending" | "completed" | "failed";
      result?: any;
      error?: string;
      history: EventItem[];
    }
  >;
  var sseConnections: Map<string, ReadableStreamDefaultController>;
}

// 确保全局变量存在
if (!global.taskStatus) {
  global.taskStatus = new Map();
}
if (!global.sseConnections) {
  global.sseConnections = new Map();
}

// 辅助函数：立即推送事件到history和SSE
const pushEventImmediately = (taskId: string, event: EventItem) => {
  try {
    // 立即更新history
    const currentTask = global.taskStatus.get(taskId);
    if (currentTask) {
      const updatedTask = {
        ...currentTask,
        history: [...currentTask.history, event],
      };
      global.taskStatus.set(taskId, updatedTask);

      // 立即推送到SSE流
      const controller = global.sseConnections.get(taskId);
      if (controller) {
        try {
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)
          );
          console.log(`[SSE ${taskId}] Event pushed immediately:`, event.name);
        } catch (error) {
          console.error(`[SSE ${taskId}] Failed to send event:`, error);
        }
      }
    }
  } catch (error) {
    console.error(`[Task ${taskId}] Failed to push event:`, error);
  }
};

export const POST = async (req: NextRequest) => {
  const args = (await req.json()) as FunMaxConfig;
  console.log(JSON.stringify(args, null, 2));
  const taskId = args.task_id;

  // 初始化任务状态
  global.taskStatus.set(taskId, { status: "pending", history: [] });

  // 立即返回，后台执行
  setImmediate(async () => {
    try {
      const agent = new FunMax(args);

      // 监听所有agent事件，确保及时推送
      agent.on("agent:*", (e) => {
        pushEventImmediately(taskId, e);
      });

      await agent.run(args.task_request);
    } catch (error) {
      console.error(`[Task ${taskId}] Agent execution failed:`, error);
    }
  });

  // 立即返回 taskId
  return NextResponse.json({ taskId }, { status: 202 });
};

// 添加获取任务状态的端点
export const GET = async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get("taskId");

  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  const task = global.taskStatus.get(taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json(task);
};
