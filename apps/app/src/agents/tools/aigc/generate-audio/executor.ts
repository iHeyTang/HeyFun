import { ToolContext } from '../../context';
import { prisma } from '@/lib/server/prisma';
import { workflow } from '@/lib/server/workflow';
import AIGC, { t2aParamsSchema } from '@repo/llm/aigc';
import type { z } from 'zod';
import { generateAudioParamsSchema } from './schema';
import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { createAssetsFromAigcResults } from '@/agents/utils/aigc-asset-helper';

export const generateAudioExecutor = definitionToolExecutor(generateAudioParamsSchema, async (args, context) => {
  const { error, task } = await context.workflow.run(`toolcall-${context.toolCallId}`, async () => {
    const { model, text, voiceId, advanced } = args;

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
      return {
        error: `Model "${model}" does not support text-to-speech generation. Supported types: ${modelInstance.generationTypes.join(', ')}`,
      };
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

  // waitForEvent 需要使用不同的 step name
  const result = await context.workflow.waitForEvent<{ taskId: string; results?: PrismaJson.PaintboardTaskResult; error?: string }>(
    `toolcall-${context.toolCallId}-wait`,
    `paintboard-result-${task.id}`,
  );

  if (result.eventData?.error) {
    return {
      success: false,
      error: result.eventData.error,
    };
  }

  // 为生成的结果文件创建 Assets 记录
  if (result.eventData?.results && Array.isArray(result.eventData.results) && result.eventData.results.length > 0) {
    const assets = await createAssetsFromAigcResults(context, result.eventData.results, {
      defaultType: 'audio',
      titlePrefix: '生成的音频',
      toolArgs: args,
    });

    if (assets.length > 0) {
      return {
        success: true,
        data: {
          ...result.eventData.results,
          assets,
        },
      };
    }
  }

  return {
    success: true,
    data: result.eventData.results,
  };
});
