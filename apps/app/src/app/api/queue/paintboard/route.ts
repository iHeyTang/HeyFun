'use server';

import { prisma } from '@/lib/server/prisma';
import storage, { downloadFile, getBucket } from '@/lib/server/storage';
import { to } from '@/lib/shared/to';
import { PaintboardTasks } from '@prisma/client';
import AIGC from '@repo/llm/aigc';
import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';

export const POST = async (req: Request) => {
  const body = (await req.json()) as { taskId: string };

  const task = await prisma.paintboardTasks.findUnique({ where: { id: body.taskId } });
  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const [error, externalTaskId] = await to(AIGC.submitGenerationTask(task.model, task.params as any));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await prisma.paintboardTasks.update({ where: { id: body.taskId }, data: { taskId: externalTaskId } });

  const timeoutMs = 5 * 60 * 1000; // 5分钟

  await processPaintboardTaskResult({
    orgId: task.organizationId,
    taskId: task.id,
    model: task.model,
    externalTaskId,
    timeoutMs,
    retryDelay: 2000, // 每次重试间隔2秒
  });

  return NextResponse.json({});
};

// 处理任务结果
const processPaintboardTaskResult = async (args: {
  orgId: string;
  taskId: string;
  model: string;
  externalTaskId: string;
  timeoutMs?: number;
  retryDelay?: number;
}) => {
  // 根据生成类型设置不同的超时时间
  const { orgId, taskId, model, externalTaskId, retryDelay = 3000 } = args;
  const defaultTimeout = 5 * 60 * 1000; // 5分钟
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
              data: { results: results as any, status: 'completed' },
            });
            console.log(`Task ${taskId} completed successfully with ${results.length} results`);
            return results;
          } else {
            throw new Error('No valid results found');
          }
        } else if (result.status === 'failed') {
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
