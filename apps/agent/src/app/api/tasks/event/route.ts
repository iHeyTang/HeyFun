import { NextRequest } from "next/server";
import { sseRuntime } from "../../../../libs/sse";

export const GET = async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");

    if (!taskId) {
      return new Response("taskId is required", { status: 400 });
    }

    // 创建SSE流
    const stream = sseRuntime.createSSEStream(taskId);

    return new Response(stream, {
      headers: sseRuntime.getSSEHeaders(),
    });
  } catch (error) {
    console.error("[SSE API] GET error:", error);
    return new Response("Internal server error", { status: 500 });
  }
};
