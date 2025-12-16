import { ToolResult } from '@/agents/core/tools/tool-definition';
import { prisma } from '@/lib/server/prisma';
import { workflow } from '@/lib/server/workflow';
import AIGC, { t2aParamsSchema } from '@repo/llm/aigc';
import type { z } from 'zod';
import { GeneralToolboxContext } from '../context';

const executor = async (args: any, context: GeneralToolboxContext): Promise<ToolResult> => {
  // 使用 context.run 包装创建 task 和触发 workflow，确保只执行一次（即使 workflow 恢复也不会重复执行）
  const stepName = `generate-audio-create-${context.toolCallId}`;
  const { error, task } = await context.workflow.run(stepName, async () => {
    const { model, text, voiceId, advanced } = args;

    if (!model || typeof model !== 'string') {
      return { error: 'Model is required and must be a string' };
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return { error: 'Text is required and must be a non-empty string' };
    }

    if (!context.organizationId) {
      return { error: 'Organization ID is required' };
    }

    // 获取模型信息
    const modelInstance = AIGC.getModel(model);
    if (!modelInstance) {
      return { error: `Model "${model}" not found. Use get_aigc_models to see available models.` };
    }

    // 检查余额
    const credit = await prisma.credit.findUnique({ where: { organizationId: context.organizationId } });
    if (!credit || credit.amount <= 0) {
      return { error: 'Insufficient balance' };
    }

    // 验证模型是否支持text-to-speech
    if (!modelInstance.generationTypes.includes('text-to-speech')) {
      return { error: `Model "${model}" does not support text-to-speech generation. Supported types: ${modelInstance.generationTypes.join(', ')}` };
    }

    // 构建参数
    const params: z.infer<typeof t2aParamsSchema> = {
      text: text.trim(),
    };

    if (voiceId && typeof voiceId === 'string') {
      params.voice_id = voiceId;
    }

    if (advanced && typeof advanced === 'object') {
      params.advanced = advanced;
    }

    // 创建数据库任务记录
    if (!context.organizationId) {
      return { error: 'Organization ID is required' };
    }
    const createdTask = await prisma.paintboardTasks.create({
      data: {
        organizationId: context.organizationId,
        service: 'unknown',
        model,
        generationType: 'text-to-speech',
        params: params as any,
        status: 'pending',
      },
    });

    // 触发 paintboard workflow
    await workflow.trigger({
      url: '/api/workflow/paintboard',
      body: { taskId: createdTask.id },
      flowControl: { key: `paintboard-${context.organizationId}`, parallelism: 2 },
    });

    return { task: createdTask };
  });

  if (error || !task) {
    return {
      success: false,
      error: error || 'Task creation failed',
    };
  }

  // waitForEvent 不应该被 try/catch 包装，让 Upstash Workflow 框架处理错误
  // 第一个参数是 step name（使用 toolCallId 确保唯一性），第二个参数是 event name
  const waitStepName = context.toolCallId ? `generate-audio-wait-${context.toolCallId}` : `generate-audio-wait-${task.id}`;
  const result = await context.workflow.waitForEvent<{ taskId: string; results?: PrismaJson.PaintboardTaskResult; error?: string }>(
    waitStepName,
    `paintboard-result-${task.id}`,
  );

  if (result.eventData?.error) {
    return {
      success: false,
      error: result.eventData.error,
    };
  }

  return {
    success: true,
    data: result.eventData.results,
  };
};

export const generateAudioTool = {
  toolName: 'generate_audio',
  executor,
};
