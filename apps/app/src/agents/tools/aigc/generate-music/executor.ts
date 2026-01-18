import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { createAssetsFromAigcResults } from '@/agents/utils/aigc-asset-helper';
import { prisma } from '@/lib/server/prisma';
import { workflow } from '@/lib/server/workflow';
import AIGC, { musicParamsSchema } from '@/llm/aigc';
import type { z } from 'zod';
import { generateMusicParamsSchema } from './schema';

export const generateMusicExecutor = definitionToolExecutor(generateMusicParamsSchema, async (args, context) => {
  try {
    const { model, lyrics, prompt, advanced } = args;

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

    // 触发 paintboard workflow（工具内部使用独立的 workflow）
    await workflow.trigger({
      url: '/api/workflow/paintboard',
      body: { taskId: createdTask.id },
      flowControl: { key: `paintboard-${context.organizationId}`, parallelism: 2 },
    });

    // 等待任务完成（轮询方式，因为工具不再有 workflow context）
    // 注意：这是一个长时间运行的任务，工具内部实现了独立的 workflow
    let attempts = 0;
    const maxAttempts = 120; // 最多等待 10 分钟（每 5 秒检查一次）

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 等待 5 秒

      const task = await prisma.paintboardTasks.findUnique({
        where: { id: createdTask.id },
      });

      if (!task) {
        return {
          success: false,
          error: 'Task not found',
        };
      }

      if (task.status === 'completed' && task.results) {
        const results = task.results as any;

        // 为生成的结果文件创建 Assets 记录
        if (Array.isArray(results) && results.length > 0) {
          const assets = await createAssetsFromAigcResults(context, results, {
            defaultType: 'audio',
            titlePrefix: '生成的音乐',
            toolArgs: args,
          });

          if (assets.length > 0) {
            return {
              success: true,
              data: {
                ...results,
                assets,
              },
            };
          }
        }

        return {
          success: true,
          data: results,
        };
      }

      if (task.status === 'failed') {
        return {
          success: false,
          error: task.error || 'Task failed',
        };
      }

      attempts++;
    }

    return {
      success: false,
      error: 'Task timeout: music generation took too long',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});
