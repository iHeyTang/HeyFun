'use server';

import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';
import { queue } from '@/lib/server/queue';
import { SubmitTaskParams } from '@repo/llm/aigc';

// 获取用户的所有画板任务
export const getUserPaintboardTasks = withUserAuth(
  async ({ orgId, args }: AuthWrapperContext<{ page?: number; limit?: number; cursor?: string }>) => {
    const { page = 1, limit = 20, cursor } = args || {};

    // 构建查询条件
    const where: any = { organizationId: orgId };

    // 如果提供了 cursor，使用 cursor-based 分页
    if (cursor) {
      const cursorTask = await prisma.paintboardTasks.findUnique({
        where: { id: cursor },
        select: { createdAt: true },
      });

      if (cursorTask) {
        where.createdAt = { lt: cursorTask.createdAt };
      }
    }

    const tasks = await prisma.paintboardTasks.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // 检查是否还有更多数据
    const hasMore = tasks.length === limit;

    return {
      data: tasks,
      hasMore,
      nextCursor: hasMore && tasks.length > 0 ? tasks[tasks.length - 1]?.id || null : null,
    };
  },
);

// 批量获取任务状态（用于轮询）
export const getPaintboardTasksStatus = withUserAuth(async ({ args, orgId }: AuthWrapperContext<{ taskIds: string[] }>) => {
  const { taskIds } = args;

  try {
    const tasks = await prisma.paintboardTasks.findMany({
      where: {
        id: { in: taskIds },
        organizationId: orgId,
      },
    });

    return tasks;
  } catch (error) {
    console.error('Error getting paintboard tasks status:', error);
    throw new Error((error as Error).message);
  }
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

// 提交生成任务
export const submitGenerationTask = withUserAuth(async ({ args, orgId }: AuthWrapperContext<{ model: string; params: SubmitTaskParams }>) => {
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

  // 返回创建的任务信息
  return res;
});
