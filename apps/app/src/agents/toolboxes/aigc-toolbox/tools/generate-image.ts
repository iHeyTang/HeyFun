import { ToolResult } from '@/agents/core/tools/tool-definition';
import { AigcToolboxContext } from '../context';
import { prisma } from '@/lib/server/prisma';
import { queue } from '@/lib/server/queue';
import AIGC, { imageParamsSchema, GenerationType } from '@repo/llm/aigc';
import type { z } from 'zod';

const executor = async (args: any, context: AigcToolboxContext): Promise<ToolResult> => {
  try {
    const { model, prompt, referenceImage, aspectRatio, n, advanced } = args;

    if (!model || typeof model !== 'string') {
      return {
        success: false,
        error: 'Model is required and must be a string',
      };
    }

    if (!prompt || typeof prompt !== 'string') {
      return {
        success: false,
        error: 'Prompt is required and must be a non-empty string',
      };
    }

    if (!context.organizationId) {
      return {
        success: false,
        error: 'Organization ID is required',
      };
    }

    // 获取模型信息
    const modelInstance = AIGC.getModel(model);
    if (!modelInstance) {
      return {
        success: false,
        error: `Model "${model}" not found. Use get_aigc_models to see available models.`,
      };
    }

    // 检查余额
    const credit = await prisma.credit.findUnique({ where: { organizationId: context.organizationId } });
    if (!credit || credit.amount <= 0) {
      return {
        success: false,
        error: 'Insufficient balance',
      };
    }

    // 构建参数
    const params: z.infer<typeof imageParamsSchema> = {
      prompt: prompt.trim(),
    };

    if (referenceImage && Array.isArray(referenceImage) && referenceImage.length > 0) {
      params.referenceImage = referenceImage;
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
        success: false,
        error: `Model "${model}" does not support generation type "${generationType}". Supported types: ${modelInstance.generationTypes.join(', ')}`,
      };
    }

    // 创建数据库任务记录
    const task = await prisma.paintboardTasks.create({
      data: {
        organizationId: context.organizationId,
        service: 'unknown',
        model,
        generationType,
        params: params as any,
        status: 'pending',
      },
    });

    // 发布任务到队列
    await queue.publish({
      url: '/api/queue/paintboard',
      body: { taskId: task.id },
      flowControl: { key: `paintboard-${context.organizationId}`, parallelism: 2 },
    });

    return {
      success: true,
      data: {
        taskId: task.id,
        status: task.status,
        model,
        generationType,
        message: `${generationType} 生成任务已提交，正在处理中。任务ID: ${task.id}`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
};

export const generateImageTool = {
  toolName: 'generate_image',
  executor,
};

