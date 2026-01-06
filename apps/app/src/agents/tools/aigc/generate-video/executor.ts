import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { prisma } from '@/lib/server/prisma';
import { workflow } from '@/lib/server/workflow';
import AIGC, { GenerationType, videoParamsSchema } from '@repo/llm/aigc';
import type { z } from 'zod';
import { generateVideoParamsSchema } from './schema';
import { createAssetsFromAigcResults } from '@/agents/utils/aigc-asset-helper';

/**
 * 根据参数推断视频生成类型
 */
function inferVideoGenerationType(params: z.infer<typeof videoParamsSchema>): GenerationType {
  if (params.video) {
    return 'video-to-video';
  }
  if (params.firstFrame && params.lastFrame) {
    return 'keyframe-to-video';
  }
  if (params.referenceImage && Array.isArray(params.referenceImage) && params.referenceImage.length > 0) {
    return 'image-to-video';
  }
  return 'text-to-video';
}

export const generateVideoExecutor = definitionToolExecutor(generateVideoParamsSchema, async (args, context) => {
  const { error, task } = await context.workflow.run(`toolcall-${context.toolCallId}`, async () => {
    const { model, prompt, firstFrame, lastFrame, referenceImage, video, audio, aspectRatio, resolution, duration, advanced } = args;

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
    const params: z.infer<typeof videoParamsSchema> = {};

    if (prompt && typeof prompt === 'string') {
      params.prompt = prompt.trim();
    }

    if (firstFrame && typeof firstFrame === 'string') {
      params.firstFrame = firstFrame.startsWith('oss://') ? firstFrame.replace('oss://', '') : firstFrame;
    }

    if (lastFrame && typeof lastFrame === 'string') {
      params.lastFrame = lastFrame.startsWith('oss://') ? lastFrame.replace('oss://', '') : lastFrame;
    }

    if (referenceImage && Array.isArray(referenceImage) && referenceImage.length > 0) {
      params.referenceImage = referenceImage.map(img => {
        if (typeof img === 'string' && img.startsWith('oss://')) {
          return img.replace('oss://', '');
        }
        return img;
      });
    }

    if (video && typeof video === 'string') {
      params.video = video.startsWith('oss://') ? video.replace('oss://', '') : video;
    }

    if (audio && typeof audio === 'string') {
      params.audio = audio.startsWith('oss://') ? audio.replace('oss://', '') : audio;
    }

    if (aspectRatio && typeof aspectRatio === 'string') {
      params.aspectRatio = aspectRatio;
    }

    if (resolution && typeof resolution === 'string') {
      params.resolution = resolution;
    }

    if (duration && typeof duration === 'string') {
      params.duration = duration;
    }

    if (advanced && typeof advanced === 'object') {
      params.advanced = advanced;
    }

    // 推断生成类型
    const generationType = inferVideoGenerationType(params);

    // 验证模型是否支持该生成类型
    if (!modelInstance.generationTypes.includes(generationType)) {
      return {
        error: `Model "${model}" does not support generation type "${generationType}". Supported types: ${modelInstance.generationTypes.join(', ')}`,
      };
    }

    // 创建数据库任务记录
    const createdTask = await prisma.paintboardTasks.create({
      data: {
        organizationId: context.organizationId!,
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
      defaultType: 'video',
      titlePrefix: '生成的视频',
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
