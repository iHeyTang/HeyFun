import { ToolResult } from '@/agents/core/tools/tool-definition';
import { prisma } from '@/lib/server/prisma';
import { workflow } from '@/lib/server/workflow';
import AIGC, { GenerationType, videoParamsSchema } from '@repo/llm/aigc';
import type { z } from 'zod';
import { AigcToolboxContext } from '../context';

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

const executor = async (args: any, context: AigcToolboxContext): Promise<ToolResult> => {
  // 使用 context.run 包装创建 task 和触发 workflow，确保只执行一次（即使 workflow 恢复也不会重复执行）
  const stepName = context.toolCallId ? `generate-video-create-${context.toolCallId}` : `generate-video-create-${Date.now()}`;
  const { error, task } = await context.workflow.run(stepName, async () => {
    const { model, prompt, firstFrame, lastFrame, referenceImage, video, audio, aspectRatio, resolution, duration, advanced } = args;

    if (!model || typeof model !== 'string') {
      return { error: 'Model is required and must be a string' };
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

    // 构建参数
    const params: z.infer<typeof videoParamsSchema> = {};

    if (prompt && typeof prompt === 'string') {
      params.prompt = prompt.trim();
    }

    if (firstFrame && typeof firstFrame === 'string') {
      // 处理 firstFrame，去掉 oss:// 前缀（如果存在）
      params.firstFrame = firstFrame.startsWith('oss://') ? firstFrame.replace('oss://', '') : firstFrame;
    }

    if (lastFrame && typeof lastFrame === 'string') {
      // 处理 lastFrame，去掉 oss:// 前缀（如果存在）
      params.lastFrame = lastFrame.startsWith('oss://') ? lastFrame.replace('oss://', '') : lastFrame;
    }

    if (referenceImage && Array.isArray(referenceImage) && referenceImage.length > 0) {
      // 处理 referenceImage，去掉 oss:// 前缀（如果存在）
      params.referenceImage = referenceImage.map(img => {
        if (typeof img === 'string' && img.startsWith('oss://')) {
          const cleaned = img.replace('oss://', '');
          console.log(`[generate-video] Removed oss:// prefix from referenceImage: ${img} -> ${cleaned}`);
          return cleaned;
        }
        return img;
      });
      console.log(`[generate-video] Processed referenceImage:`, params.referenceImage);
    }

    if (video && typeof video === 'string') {
      // 处理 video，去掉 oss:// 前缀（如果存在）
      params.video = video.startsWith('oss://') ? video.replace('oss://', '') : video;
    }

    if (audio && typeof audio === 'string') {
      // 处理 audio，去掉 oss:// 前缀（如果存在）
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

    // 至少需要prompt、firstFrame、lastFrame、referenceImage或video中的一个
    if (!params.prompt && !params.firstFrame && !params.lastFrame && !params.referenceImage && !params.video) {
      return { error: 'At least one of prompt, firstFrame, lastFrame, referenceImage, or video is required' };
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

  // waitForEvent 不应该被 try/catch 包装，让 Upstash Workflow 框架处理错误
  // 第一个参数是 step name（使用 toolCallId 确保唯一性），第二个参数是 event name
  const waitStepName = context.toolCallId ? `generate-video-wait-${context.toolCallId}` : `generate-video-wait-${task.id}`;
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

export const generateVideoTool = {
  toolName: 'generate_video',
  executor,
};
