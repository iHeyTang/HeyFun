import { ToolResult } from '@/agents/core/tools/tool-definition';
import { prisma } from '@/lib/server/prisma';
import { workflow } from '@/lib/server/workflow';
import AIGC, { musicParamsSchema } from '@repo/llm/aigc';
import type { z } from 'zod';
import { AigcToolboxContext } from '../context';

const executor = async (args: any, context: AigcToolboxContext): Promise<ToolResult> => {
  // 使用 context.run 包装创建 task 和触发 workflow，确保只执行一次（即使 workflow 恢复也不会重复执行）
  const stepName = context.toolCallId ? `generate-music-create-${context.toolCallId}` : `generate-music-create-${Date.now()}`;
  const { error, task } = await context.workflow.run(stepName, async () => {
    const { model, lyrics, prompt, advanced } = args;

    if (!model || typeof model !== 'string') {
      return { error: 'Model is required and must be a string' };
    }

    if (!context.organizationId) {
      return { error: 'Organization ID is required' };
    }

    // 至少需要lyrics或prompt中的一个
    if (
      (!lyrics || typeof lyrics !== 'string' || lyrics.trim().length === 0) &&
      (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0)
    ) {
      return { error: 'At least one of lyrics or prompt is required and must be a non-empty string' };
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

    // 验证模型是否支持music
    if (!modelInstance.generationTypes.includes('music')) {
      return { error: `Model "${model}" does not support music generation. Supported types: ${modelInstance.generationTypes.join(', ')}` };
    }

    // 构建参数
    const params: z.infer<typeof musicParamsSchema> = {};

    if (lyrics && typeof lyrics === 'string' && lyrics.trim().length > 0) {
      params.lyrics = lyrics.trim();
    }

    if (prompt && typeof prompt === 'string' && prompt.trim().length > 0) {
      params.prompt = prompt.trim();
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
        generationType: 'music',
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
  const waitStepName = context.toolCallId ? `generate-music-wait-${context.toolCallId}` : `generate-music-wait-${task.id}`;
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

export const generateMusicTool = {
  toolName: 'generate_music',
  executor,
};
