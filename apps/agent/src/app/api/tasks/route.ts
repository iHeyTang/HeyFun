import { FunMaxConfig } from "@repo/agent";
import { NextRequest, NextResponse } from "next/server";
import { taskRuntime } from "../../../libs/runtime";

export const POST = async (req: NextRequest) => {
  try {
    const args = (await req.json()) as FunMaxConfig;
    const taskId = args.task_id;

    if (!taskId) {
      return NextResponse.json(
        { error: "task_id is required" },
        { status: 400 }
      );
    }

    // 检查任务是否已存在
    const existingTask = taskRuntime.getTask(taskId);
    if (existingTask) {
      return NextResponse.json(
        { error: "Task already exists" },
        { status: 409 }
      );
    }

    // 创建任务
    taskRuntime.createTask(taskId, args);

    // 立即返回 taskId
    return NextResponse.json({ taskId }, { status: 202 });
  } catch (error) {
    console.error("[Tasks API] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};

export const GET = async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json(
        { error: "taskId is required" },
        { status: 400 }
      );
    }

    const task = taskRuntime.getTask(taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("[Tasks API] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};
