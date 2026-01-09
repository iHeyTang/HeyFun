import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { prisma } from '@/lib/server/prisma';
import { workflow } from '@/lib/server/workflow';
import AIGC, { GenerationType, imageParamsSchema } from '@/llm/aigc';
import type { z } from 'zod';
import { generateImageParamsSchema } from './schema';
import { createAssetsFromAigcResults } from '@/agents/utils/aigc-asset-helper';

export const generateImageExecutor = definitionToolExecutor(generateImageParamsSchema, async (args, context) => {
  const { error, task } = await context.workflow.run(`toolcall-${context.toolCallId}`, async () => {
    const { model, prompt, referenceImage, aspectRatio, n, advanced } = args;

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

    // 构建参数
    const params: z.infer<typeof imageParamsSchema> = {
      prompt: prompt.trim(),
    };

    if (referenceImage && Array.isArray(referenceImage) && referenceImage.length > 0) {
      // 处理 referenceImage，去掉 oss:// 前缀（如果存在）
      params.referenceImage = referenceImage.map(img => {
        if (typeof img === 'string' && img.startsWith('oss://')) {
          const cleaned = img.replace('oss://', '');
          console.log(`[generate-image] Removed oss:// prefix: ${img} -> ${cleaned}`);
          return cleaned;
        }
        return img;
      });
      console.log(`[generate-image] Processed referenceImage:`, params.referenceImage);
    }

    if (aspectRatio && typeof aspectRatio === 'string') {
      params.aspectRatio = aspectRatio;
    }

    if (n && typeof n === 'string') {
      params.n = n;
    }

    if (advanced && typeof advanced === 'object') {
      params.advanced = advanced;
    }

    // 判断生成类型
    const generationType: GenerationType = params.referenceImage ? 'image-to-image' : 'text-to-image';

    // 验证模型是否支持该生成类型
    if (!modelInstance.generationTypes.includes(generationType)) {
      return {
        error: `Model "${model}" does not support generation type "${generationType}". Supported types: ${modelInstance.generationTypes.join(', ')}`,
      };
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
        generationType,
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
      defaultType: 'image',
      titlePrefix: '生成的图片',
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
