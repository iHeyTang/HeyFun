import { Realtime, InferRealtimeEvents } from "@upstash/realtime";
import { redis } from "@/lib/server/redis";
import { z } from "zod";

const schema = {
  // 消息内容更新（chunk）
  "message.content": {
    sessionId: z.string(),
    messageId: z.string(),
    content: z.string(), // 完整内容
    isComplete: z.boolean().optional(),
  },

  // 消息完整更新（包括 toolCalls、metadata 等）
  "message.update": {
    sessionId: z.string(),
    messageId: z.string(),
    data: z.object({
      content: z.string().optional(),
      toolCalls: z.any().optional(),
      toolResults: z.any().optional(),
      isComplete: z.boolean().optional(),
      metadata: z.any().optional(),
    }),
  },

  // 新消息创建
  "message.create": {
    sessionId: z.string(),
    message: z.object({
      id: z.string(),
      role: z.enum(["user", "assistant"]),
      content: z.string(),
      createdAt: z.string(),
    }),
  },

  // 会话状态更新
  "session.status": {
    sessionId: z.string(),
    status: z.enum(["idle", "pending", "processing", "failed"]),
  },
};

export const realtime = new Realtime({ schema, redis });
export type RealtimeEvents = InferRealtimeEvents<typeof realtime>;
