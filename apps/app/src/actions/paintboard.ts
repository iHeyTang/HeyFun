'use server';

import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';
import storage, { downloadFile, getBucket } from '@/lib/server/storage';
import { PaintboardTasks } from '@prisma/client';
import AIGC from '@repo/llm/aigc';
import { nanoid } from 'nanoid';

// 任务状态枚举
enum PaintboardTaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// 获取所有服务模型信息
export const getAllServiceModelInfos = withUserAuth(async ({ orgId }: AuthWrapperContext<{}>) => {
  const models = await AIGC.getAllServiceModels();
  return models.map(model => ({
    name: model.name,
    displayName: model.displayName,
    description: model.description,
    parameterLimits: model.parameterLimits,
  }));
});

// 获取用户的所有画板任务
export const getUserPaintboardTasks = withUserAuth(async ({ orgId }: AuthWrapperContext<{}>) => {
  const tasks = await prisma.paintboardTasks.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' } });
  const list = await Promise.all(
    tasks.map(async task => {
      const results = await Promise.all(task.results.map(async result => ({ ...result, url: await storage.getSignedUrl(result.key) })));
      return { ...task, results };
    }),
  );
  return list;
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
export const submitGenerationTask = withUserAuth(async ({ args, orgId }: AuthWrapperContext<{ model: string; params: any }>) => {
  const { model, params } = args;
  console.log('submitGenerationTask', args);
  // 1. 创建数据库任务记录
  const taskRecord = await prisma.paintboardTasks.create({
    data: {
      organizationId: orgId,
      service: 'unknown',
      model,
      generationType: 'unknown',
      params,
      status: PaintboardTaskStatus.PENDING,
    },
  });

  const taskId = taskRecord.id;

  // 2. 使用统一接口提交任务到外部服务
  const externalTaskId = await AIGC.submitGenerationTask(model, params);

  // 3. 检查提交结果并更新数据库
  if (externalTaskId) {
    // 更新任务状态为处理中，并记录外部任务ID
    await prisma.paintboardTasks.update({
      where: { id: taskId },
      data: { status: PaintboardTaskStatus.PROCESSING, taskId: externalTaskId },
    });

    // 4. 启动后台轮询（异步执行，不阻塞响应）
    setTimeout(async () => {
      try {
        const timeoutMs = 5 * 60 * 1000; // 5分钟

        await processPaintboardTaskResult({
          taskId,
          model,
          externalTaskId,
          timeoutMs,
          retryDelay: 2000, // 每次重试间隔2秒
        });
      } catch (error) {
        console.error('Background polling failed:', error);
      }
    }, 1000);

    return {
      success: true,
      data: {
        taskId,
        externalTaskId,
        status: 'processing',
      },
    };
  } else {
    await prisma.paintboardTasks.update({
      where: { id: taskId },
      data: { status: PaintboardTaskStatus.FAILED, error: 'Unknown error' },
    });
    throw new Error('Failed to submit task to external service');
  }
});

// 处理任务结果
const processPaintboardTaskResult = withUserAuth(
  async ({
    args,
    orgId,
  }: AuthWrapperContext<{
    taskId: string;
    model: string;
    externalTaskId: string;
    timeoutMs?: number;
    retryDelay?: number;
  }>) => {
    // 根据生成类型设置不同的超时时间
    const { taskId, model, externalTaskId, retryDelay = 3000 } = args;
    const defaultTimeout = 5 * 60 * 1000; // 5分钟
    const timeoutMs = args.timeoutMs ?? defaultTimeout;

    try {
      // 更新任务状态为处理中
      await prisma.paintboardTasks.update({
        where: { id: taskId },
        data: { status: PaintboardTaskStatus.PROCESSING, taskId: externalTaskId },
      });

      // 轮询逻辑 - 使用超时时间而不是重试次数
      const startTime = Date.now();

      while (Date.now() - startTime < timeoutMs) {
        try {
          const elapsedTime = Date.now() - startTime;
          const remainingTime = timeoutMs - elapsedTime;
          console.log(`Polling task ${taskId}, elapsed: ${Math.round(elapsedTime / 1000)}s, remaining: ${Math.round(remainingTime / 1000)}s`);

          // 使用统一接口获取任务结果
          const result = await AIGC.getTaskResult({ modelName: model, taskId: externalTaskId });

          // 检查任务是否完成
          if (result.status === 'completed' && result.data?.length) {
            const results: PaintboardTasks['results'] = [];

            // 下载所有结果文件并上传到OSS
            for (const item of result.data) {
              if (typeof item.url === 'string') {
                try {
                  // 从URL中提取文件名，移除查询参数
                  const { buffer, mimeType, extension } = await downloadFile(item.url);
                  const key = `${orgId}/${Date.now()}_${nanoid(8)}${extension}`;
                  await storage.put(key, buffer, { contentType: mimeType });
                  results.push({ bucket: getBucket(), key });
                } catch (error) {
                  console.error('Error processing result URL:', item.url, error);
                }
              }
            }

            // 更新任务结果
            if (results.length > 0) {
              await prisma.paintboardTasks.update({
                where: { id: taskId },
                data: { results: results as any, status: PaintboardTaskStatus.COMPLETED },
              });
              console.log(`Task ${taskId} completed successfully with ${results.length} results`);
              return results;
            } else {
              throw new Error('No valid results found');
            }
          } else if (result.status === 'failed') {
            throw new Error(result.error);
          } else {
            // 任务仍在处理中，等待后继续轮询
            console.log(`Task ${taskId} still processing, waiting ${retryDelay}ms before next attempt`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        } catch (error) {
          // 如果是任务失败，直接抛出错误
          if (error instanceof Error && error.message.includes('Task failed')) {
            throw error;
          }

          // 其他错误，记录并继续重试
          console.error(`Error polling task ${taskId}:`, error);

          // 等待后重试
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }

      // 超时
      const elapsedMinutes = Math.round((Date.now() - startTime) / 60000);
      throw new Error(`Task ${taskId} timed out after ${elapsedMinutes} minutes`);
    } catch (error) {
      // 更新任务状态为失败
      await prisma.paintboardTasks.update({
        where: { id: taskId },
        data: { status: PaintboardTaskStatus.FAILED, error: (error as Error).message },
      });
      throw error;
    }
  },
);
