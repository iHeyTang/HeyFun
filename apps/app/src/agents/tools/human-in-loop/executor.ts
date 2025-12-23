import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import type { A2UIMessage } from '@/components/features/a2ui';
import { prisma } from '@/lib/server/prisma';
import { humanInLoopParamsSchema } from './schema';

/**
 * Human-in-Loop Executor
 * 等待用户交互的工具
 * 这个工具不会立即返回，而是等待用户在前端提交后才完成
 */
export const humanInLoopExecutor = definitionToolExecutor(humanInLoopParamsSchema, async (args, context) => {
  // 第一阶段：在 run 中保存初始数据到 toolResults
  const { error, eventName } = await context.workflow.run(`toolcall-${context.toolCallId}`, async () => {
    const { title, description, a2uiMessage, required } = args;

    // 验证 A2UI 消息
    if (!a2uiMessage || (!a2uiMessage.component && !a2uiMessage.components)) {
      return {
        error: 'A2UI 消息必须包含 component 或 components',
      };
    }

    if (!context.messageId) {
      return {
        error: 'Message ID is required',
      };
    }

    // 构建完整的 A2UI 消息
    const message: A2UIMessage = {
      type: (a2uiMessage.type as A2UIMessage['type']) || 'ui/init',
      id: a2uiMessage.id || `a2ui-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      component: a2uiMessage.component,
      components: a2uiMessage.components,
    };

    // 生成 eventName，用于 workflow.notify 继续执行
    const eventName = `human-in-loop-${context.toolCallId}`;

    // 保存初始数据到 toolResults，让前端可以渲染界面
    const existingToolResults = (
      await prisma.chatMessages.findUnique({
        where: { id: context.messageId },
        select: { toolResults: true },
      })
    )?.toolResults as PrismaJson.ToolResult[] | null;

    const newToolResults: PrismaJson.ToolResult[] = [...(existingToolResults || [])];

    const initialData: PrismaJson.ToolResult = {
      toolCallId: context.toolCallId!,
      toolName: 'human_in_loop',
      success: true,
      data: {
        title,
        description,
        message,
        required: required !== false,
        waiting: true,
        toolCallId: context.toolCallId,
        eventName,
      },
    };

    const existingResultIndex = newToolResults.findIndex(tr => tr.toolCallId === context.toolCallId);
    if (existingResultIndex >= 0) {
      newToolResults[existingResultIndex] = initialData;
    } else {
      newToolResults.push(initialData);
    }

    // 更新 assistant 消息，保存初始数据和 eventName
    await prisma.chatMessages.update({
      where: { id: context.messageId },
      data: {
        toolResults: newToolResults,
        finishReason: JSON.stringify({ eventName, waiting: true }),
      },
    });

    return { eventName };
  });

  if (error || !eventName) {
    return {
      success: false,
      error: error || 'Failed to initialize human-in-loop',
    };
  }

  // 第二阶段：调用 waitForEvent 等待用户提交
  // 这个调用会阻塞 workflow，直到 tool-result API 调用 workflow.notify(eventName, data)
  // 注意：waitForEvent 需要使用不同的 step name
  const eventResult = await context.workflow.waitForEvent<{
    submitted: boolean;
    formData: Record<string, any>;
  }>(`toolcall-${context.toolCallId}-wait`, eventName);

  // 返回用户提交的数据（这是工具的最终结果）
  return {
    success: true,
    data: {
      submitted: eventResult.eventData?.submitted ?? false,
      formData: eventResult.eventData?.formData ?? {},
    },
  };
});
