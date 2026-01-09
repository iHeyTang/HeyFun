import { restoreAigcTaskResultToStorage } from '@/lib/server/aigc';
import { prisma } from '@/lib/server/prisma';
import storage from '@/lib/server/storage';
import { workflow } from '@/lib/server/workflow';
import { to } from '@/lib/shared/to';
import { PaintboardTasks } from '@prisma/client';
import AIGC, { SubmitTaskParams } from '@/llm/aigc';
import { serve } from '@upstash/workflow/nextjs';

export interface PaintboardWorkflowConfig {
  taskId: string;
}

export const { POST } = serve<PaintboardWorkflowConfig>(async context => {
  const { taskId } = context.requestPayload;

  // 步骤1: 准备任务 - 获取任务信息并处理 OSS URL
  const task = await context.run('paintboard-prepare', async () => {
    const task = await prisma.paintboardTasks.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new Error('Task not found');
    }

    // 获取引用OSS的URL并转换为签名URL
    const params = { ...task.params };
    if ('firstFrame' in params && params.firstFrame) {
      const fileKey =
        typeof params.firstFrame === 'string' && params.firstFrame.startsWith('oss://') ? params.firstFrame.replace('oss://', '') : params.firstFrame;
      params.firstFrame = await storage.getSignedUrl(fileKey, { expiresIn: 3600 });
    }
    if ('lastFrame' in params && params.lastFrame) {
      const fileKey =
        typeof params.lastFrame === 'string' && params.lastFrame.startsWith('oss://') ? params.lastFrame.replace('oss://', '') : params.lastFrame;
      params.lastFrame = await storage.getSignedUrl(fileKey, { expiresIn: 3600 });
    }
    if ('referenceImage' in params && params.referenceImage) {
      params.referenceImage = await Promise.all(
        params.referenceImage.map((item: string) => {
          const fileKey = typeof item === 'string' && item.startsWith('oss://') ? item.replace('oss://', '') : item;
          return storage.getSignedUrl(fileKey, { expiresIn: 3600 });
        }),
      );
    }
    if ('video' in params && params.video) {
      const fileKey = typeof params.video === 'string' && params.video.startsWith('oss://') ? params.video.replace('oss://', '') : params.video;
      params.video = await storage.getSignedUrl(fileKey, { expiresIn: 3600 });
    }
    if ('audio' in params && params.audio) {
      const fileKey = typeof params.audio === 'string' && params.audio.startsWith('oss://') ? params.audio.replace('oss://', '') : params.audio;
      params.audio = await storage.getSignedUrl(fileKey, { expiresIn: 3600 });
    }

    return { task, params };
  });

  // 步骤2: 提交任务到外部服务
  const externalTaskId = await context.run('paintboard-submit', async () => {
    const [error, externalId] = await to(AIGC.submitGenerationTask(task.task.model, task.params));

    if (error) {
      console.error('Failed to submit task:', error);
      await prisma.paintboardTasks.update({
        where: { id: taskId },
        data: { status: 'failed', error: error.message },
      });
      throw error;
    }

    // 更新任务状态和外部任务ID
    await prisma.paintboardTasks.update({
      where: { id: taskId },
      data: { status: 'processing', taskId: externalId },
    });

    return externalId;
  });

  // 步骤3: 轮询任务结果 - 将长时间轮询分解为多个步骤
  const timeoutMs = 15 * 60 * 1000; // 15分钟
  const retryDelay = 10000; // 每次重试间隔10秒（减少步骤数量）
  const maxPollAttempts = 90; // 最多轮询90次（15分钟 / 10秒）
  const startTime = Date.now();
  let pollAttempt = 0;
  let result: any = null;

  while (!result && pollAttempt < maxPollAttempts && Date.now() - startTime < timeoutMs) {
    const pollResult = await context.run(`paintboard-poll-${pollAttempt}`, async () => {
      const elapsedTime = Date.now() - startTime;
      const remainingTime = timeoutMs - elapsedTime;
      console.log(
        `Polling task ${taskId}, attempt: ${pollAttempt}, elapsed: ${Math.round(elapsedTime / 1000)}s, remaining: ${Math.round(remainingTime / 1000)}s`,
      );

      const result = await AIGC.getTaskResult({
        modelName: task.task.model,
        taskId: externalTaskId,
        params: task.params,
      });

      if (result.status === 'completed' || result.status === 'failed') {
        return { done: true, result };
      }

      // 如果还在处理中，返回 done: false，workflow 会继续下一次轮询
      return { done: false, result: null };
    });

    if (pollResult.done) {
      result = pollResult.result;
      break;
    }

    // 在 context.run 外部使用 context.sleep 来延迟（避免在 context.run 内部使用 setTimeout）
    if (pollAttempt < maxPollAttempts - 1) {
      // 计算剩余时间，确保不超过超时时间
      const elapsedTime = Date.now() - startTime;
      const remainingTime = timeoutMs - elapsedTime;
      const sleepTime = Math.min(retryDelay, remainingTime);

      if (sleepTime > 0) {
        // context.sleep 需要 step name 和 Duration 字符串格式（bigint）
        const sleepSeconds = BigInt(Math.ceil(sleepTime / 1000));
        await context.sleep(`paintboard-sleep-${pollAttempt}`, `${sleepSeconds}s`);
      }
    }

    pollAttempt++;
  }

  // 检查是否超时
  if (!result) {
    await context.run('paintboard-handle-timeout', async () => {
      const elapsedMinutes = Math.round((Date.now() - startTime) / 60000);
      await prisma.paintboardTasks.update({
        where: { id: taskId },
        data: { status: 'failed', error: `Task timed out after ${elapsedMinutes} minutes` },
      });
      await workflow.notify(`paintboard-result-${taskId}`, { taskId, error: `Task timed out after ${elapsedMinutes} minutes` });
    });
    return;
  }

  // 步骤4: 处理任务结果
  if (result.status === 'failed') {
    await context.run('paintboard-handle-failure', async () => {
      console.error(`Task ${taskId} failed:`, result.error);
      await prisma.paintboardTasks.update({
        where: { id: taskId },
        data: { status: 'failed', error: result.error || 'Task failed' },
      });
      await workflow.notify(`paintboard-result-${taskId}`, { taskId, error: result.error || 'Task failed' });
    });
    return;
  }

  // 任务成功完成，下载并上传结果文件
  const processedResults = await context.run('paintboard-process-results', async () => {
    const results: PaintboardTasks['results'] = [];

    // 下载所有结果文件并上传到OSS
    for (const item of result.data || []) {
      try {
        const processed = await restoreAigcTaskResultToStorage(task.task.organizationId, item);
        results.push(processed);
      } catch (error) {
        console.error('Error processing task result:', item, error);
      }
    }

    if (results.length === 0) {
      await prisma.paintboardTasks.update({
        where: { id: taskId },
        data: { status: 'failed', error: 'No valid results found' },
      });
      return null;
    }

    // 更新任务结果
    await prisma.paintboardTasks.update({
      where: { id: taskId },
      data: { results: results as any, status: 'completed' },
    });

    console.log(`Task ${taskId} completed successfully with ${results.length} results`);
    await workflow.notify(`paintboard-result-${taskId}`, { taskId, results });
    return results;
  });

  if (!processedResults) {
    return;
  }

  // 步骤5: 计算并扣除费用
  await context.run('paintboard-deduct-credits', async () => {
    const model = AIGC.getModel(task.task.model);
    if (!model) {
      console.error(`Model not found: ${task.task.model}`);
      return;
    }

    try {
      // 计算任务费用
      const cost = await model.calculateCost(task.params, result);

      // 扣除费用
      await prisma.credit.update({
        where: { organizationId: task.task.organizationId },
        data: { amount: { decrement: cost } },
      });

      console.log(`Deducted ${cost} credits from organization ${task.task.organizationId} for task ${taskId}`);
    } catch (error) {
      console.error(`Failed to deduct credits for task ${taskId}:`, error);
      // 即使扣费失败，也不应该影响任务结果
    }
  });
});
