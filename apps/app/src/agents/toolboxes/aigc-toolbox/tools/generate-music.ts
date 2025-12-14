import { ToolResult } from '@/agents/core/tools/tool-definition';
import { AigcToolboxContext } from '../context';
import { prisma } from '@/lib/server/prisma';
import { queue } from '@/lib/server/queue';
import AIGC, { musicParamsSchema } from '@repo/llm/aigc';
import type { z } from 'zod';

const executor = async (args: any, context: AigcToolboxContext): Promise<ToolResult> => {
  try {
    const { model, lyrics, prompt, advanced } = args;

    if (!model || typeof model !== 'string') {
      return {
        success: false,
        error: 'Model is required and must be a string',
      };
    }

    if (!context.organizationId) {
      return {
        success: false,
        error: 'Organization ID is required',
      };
    }

    // 至少需要lyrics或prompt中的一个
    if ((!lyrics || typeof lyrics !== 'string' || lyrics.trim().length === 0) && (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0)) {
      return {
        success: false,
        error: 'At least one of lyrics or prompt is required and must be a non-empty string',
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

    // 验证模型是否支持music
    if (!modelInstance.generationTypes.includes('music')) {
      return {
        success: false,
        error: `Model "${model}" does not support music generation. Supported types: ${modelInstance.generationTypes.join(', ')}`,
      };
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
    const task = await prisma.paintboardTasks.create({
      data: {
        organizationId: context.organizationId,
        service: 'unknown',
        model,
        generationType: 'music',
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
        generationType: 'music',
        message: '音乐生成任务已提交，正在处理中。任务ID: ' + task.id,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
};

export const generateMusicTool = {
  toolName: 'generate_music',
  executor,
};

