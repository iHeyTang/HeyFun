'use server';

import { restoreAigcTaskResultToStorage } from '@/lib/server/aigc';
import { prisma } from '@/lib/server/prisma';
import storage from '@/lib/server/storage';
import { to } from '@/lib/shared/to';
import { PaintboardTasks } from '@prisma/client';
import AIGC, { SubmitTaskParams } from '@repo/llm/aigc';
import { NextResponse } from 'next/server';

export const POST = async (req: Request) => {
  try {
    const body = (await req.json()) as { taskId: string };

    const task = await prisma.paintboardTasks.findUnique({ where: { id: body.taskId } });
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // 获取引用OSS的URL
    if ('firstFrame' in task.params && task.params.firstFrame) {
      task.params.firstFrame = await storage.getSignedUrl(task.params.firstFrame, { expiresIn: 3600 });
    }
    if ('lastFrame' in task.params && task.params.lastFrame) {
      task.params.lastFrame = await storage.getSignedUrl(task.params.lastFrame, { expiresIn: 3600 });
    }
    if ('referenceImage' in task.params && task.params.referenceImage) {
      task.params.referenceImage = await Promise.all(task.params.referenceImage.map(item => storage.getSignedUrl(item, { expiresIn: 3600 })));
    }
    if ('video' in task.params && task.params.video) {
      task.params.video = await storage.getSignedUrl(task.params.video, { expiresIn: 3600 });
    }
    if ('audio' in task.params && task.params.audio) {
      task.params.audio = await storage.getSignedUrl(task.params.audio, { expiresIn: 3600 });
    }

    const [error, externalTaskId] = await to(AIGC.submitGenerationTask(task.model, task.params));

    if (error) {
      console.error('Failed to submit task:', error);
      await prisma.paintboardTasks.update({ where: { id: body.taskId }, data: { status: 'failed', error: error.message } });
      return NextResponse.json({});
    }

    await prisma.paintboardTasks.update({ where: { id: body.taskId }, data: { taskId: externalTaskId } });

    const timeoutMs = 15 * 60 * 1000; // 15分钟

    const result = await processPaintboardTaskResult({
      orgId: task.organizationId,
      taskId: task.id,
      model: task.model,
      params: task.params,
      externalTaskId,
      timeoutMs,
      retryDelay: 5000, // 每次重试间隔5秒
    });

    if (result?.success) {
      // 获取模型实例并计算费用
      const model = AIGC.getModel(task.model);
      if (!model) {
        console.error(`Model not found: ${task.model}`);
      } else {
        try {
          // 计算任务费用
          const cost = await model.calculateCost(task.params, result.originalResult);

          // 扣除费用
          await prisma.credit.update({
            where: { organizationId: task.organizationId },
            data: { amount: { decrement: cost } },
          });

          console.log(`Deducted ${cost} credits from organization ${task.organizationId} for task ${task.id}`);
        } catch (error) {
          console.error(`Failed to deduct credits for task ${task.id}:`, error);
          // 即使扣费失败，也不应该影响任务结果
        }
      }
    }

    return NextResponse.json({});
  } catch (error) {
    console.error('Error in POST /api/queue/paintboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
};

// 处理任务结果
const processPaintboardTaskResult = async (args: {
  orgId: string;
  taskId: string;
  model: string;
  params: SubmitTaskParams;
  externalTaskId: string;
  timeoutMs?: number;
  retryDelay?: number;
}) => {
  // 根据生成类型设置不同的超时时间
  const { orgId, taskId, model, externalTaskId, retryDelay = 3000 } = args;
  const defaultTimeout = 15 * 60 * 1000; // 15分钟
  const timeoutMs = args.timeoutMs ?? defaultTimeout;

  try {
    // 更新任务状态为处理中
    await prisma.paintboardTasks.update({
      where: { id: taskId },
      data: { status: 'processing', taskId: externalTaskId },
    });

    // 轮询逻辑 - 使用超时时间而不是重试次数
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const elapsedTime = Date.now() - startTime;
        const remainingTime = timeoutMs - elapsedTime;
        console.log(`Polling task ${taskId}, elapsed: ${Math.round(elapsedTime / 1000)}s, remaining: ${Math.round(remainingTime / 1000)}s`);
        const result = await AIGC.getTaskResult({ modelName: model, taskId: externalTaskId, params: args.params });
        // 检查任务是否完成
        if (result.status === 'completed') {
          const results: PaintboardTasks['results'] = [];

          // 下载所有结果文件并上传到OSS
          for (const item of result.data || []) {
            try {
              const result = await restoreAigcTaskResultToStorage(orgId, item);
              results.push(result);
            } catch (error) {
              console.error('Error processing task result:', item, error);
            }
          }

          // 更新任务结果
          if (results.length > 0) {
            await prisma.paintboardTasks.update({
              where: { id: taskId },
              data: { results: results as any, status: 'completed' },
            });
            console.log(`Task ${taskId} completed successfully with ${results.length} results`);
            return { success: true, results, originalResult: result };
          } else {
            await prisma.paintboardTasks.update({
              where: { id: taskId },
              data: { status: 'failed', error: 'No valid results found' },
            });
            console.error(`Task ${taskId} failed: No valid results found`);
            return { success: false, results: [], originalResult: result };
          }
        } else if (result.status === 'failed') {
          console.error(`Task ${taskId} failed:`, result.error);
          throw new Error(result.error || 'Task failed');
        } else {
          // 任务仍在处理中，等待后继续轮询
          console.log(`Task ${taskId} still processing, waiting ${retryDelay}ms before next attempt`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      } catch (error) {
        throw error;
      }
    }

    // 超时
    const elapsedMinutes = Math.round((Date.now() - startTime) / 60000);
    throw new Error(`Task ${taskId} timed out after ${elapsedMinutes} minutes`);
  } catch (error) {
    // 更新任务状态为失败
    console.error(`Task ${taskId} failed:`, error);
    await prisma.paintboardTasks.update({
      where: { id: taskId },
      data: { status: 'failed', error: (error as Error).message },
    });
  }
};
