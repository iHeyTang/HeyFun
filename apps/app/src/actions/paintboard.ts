'use server';

import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';
import { queue } from '@/lib/server/queue';
import storage from '@/lib/server/storage';
import AIGC from '@repo/llm/aigc';
import { zodToJsonSchema } from 'zod-to-json-schema';

// 获取所有服务模型信息
export const getAllAigcModelInfos = withUserAuth(
  async (): Promise<
    {
      name: string;
      displayName: string;
      description?: string;
      costDescription?: string;
      generationTypes: string[];
      paramsSchema: any;
    }[]
  > => {
    const models = await AIGC.getAllServiceModels();
    return models.map(model => ({
      name: model.name,
      displayName: model.displayName,
      description: model.description,
      costDescription: model.costDescription,
      generationTypes: model.generationTypes,
      paramsSchema: zodToJsonSchema(model.paramsSchema),
    }));
  },
);

// 获取用户的所有画板任务
export const getUserPaintboardTasks = withUserAuth(async ({ orgId }: AuthWrapperContext<{}>) => {
  const tasks = await prisma.paintboardTasks.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' }, take: 100 });
  return tasks;
});

// 获取特定任务
export const getPaintboardTask = withUserAuth(async ({ args }: AuthWrapperContext<{ taskId: string }>) => {
  const { taskId } = args;

  try {
    const task = await prisma.paintboardTasks.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    return task;
  } catch (error) {
    console.error('Error getting paintboard task:', error);
    throw new Error((error as Error).message);
  }
});

// 获取指定模型的声音列表
export const getVoiceList = withUserAuth(async ({ args }: AuthWrapperContext<{ modelName: string }>) => {
  const { modelName } = args;

  try {
    const model = AIGC.getModel(modelName);

    if (!model) {
      throw new Error('Model not found');
    }

    // 检查模型是否有 getVoiceList 方法
    if (typeof model.getVoiceList !== 'function') {
      throw new Error('Model does not support voice selection');
    }

    const voices = await model.getVoiceList();
    return voices;
  } catch (error) {
    console.error('Error getting voice list:', error);
    throw new Error((error as Error).message);
  }
});

// 提交生成任务
export const submitGenerationTask = withUserAuth(async ({ args, orgId }: AuthWrapperContext<{ model: string; params: any }>) => {
  const { model, params } = args;

  // 检查余额
  const credit = await prisma.credit.findUnique({ where: { organizationId: orgId } });
  if (!credit || credit.amount <= 0) {
    throw new Error('Insufficient balance');
  }

  // 创建数据库任务记录
  const res = await prisma.paintboardTasks.create({
    data: {
      organizationId: orgId,
      service: 'unknown',
      model,
      generationType: 'unknown',
      params,
      status: 'pending',
    },
  });

  // 发布任务到队列 固定2个并发
  await queue.publish({ url: '/api/queue/paintboard', body: { taskId: res.id }, flowControl: { key: `paintboard-${orgId}`, parallelism: 2 } });
});
