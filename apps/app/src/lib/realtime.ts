import { Realtime, InferRealtimeEvents } from '@upstash/realtime';
import { redis } from '@/lib/server/redis';
import { z } from 'zod';
import { Redis } from '@upstash/redis';

export const schema = {
  // 消息内容更新（chunk）
  'message.content': z.object({
    sessionId: z.string(),
    messageId: z.string(),
    content: z.string(), // 完整内容
    isComplete: z.boolean().optional(),
  }),

  // 消息完整更新（包括 toolCalls、metadata 等）
  'message.update': z.object({
    sessionId: z.string(),
    messageId: z.string(),
    data: z.object({
      content: z.string().optional(),
      toolCalls: z.any().optional(),
      toolResults: z.any().optional(),
      isComplete: z.boolean().optional(),
      metadata: z.any().optional(),
    }),
  }),

  // 新消息创建
  'message.create': z.object({
    sessionId: z.string(),
    message: z.object({
      id: z.string(),
      role: z.enum(['user', 'assistant']),
      content: z.string(),
      createdAt: z.string(),
    }),
  }),

  // 会话状态更新
  'session.status': z.object({
    sessionId: z.string(),
    status: z.enum(['idle', 'pending', 'processing', 'cancelling', 'failed']),
  }),
};

export const realtime = new Realtime<{ schema: typeof schema; redis: Redis }>({ schema, redis });
export type RealtimeEvents = InferRealtimeEvents<typeof realtime>;
