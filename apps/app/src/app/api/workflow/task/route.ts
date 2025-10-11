import { prisma } from '@/lib/server/prisma';
import redis from '@/lib/server/redis';
import { toJson } from '@/lib/utils';
import { BaseAgentEvents, FunMax, FunMaxConfig, StepResult } from '@repo/agent';
import { serve } from '@upstash/workflow/nextjs';

export const { POST } = serve<FunMaxConfig>(async context => {
  await context.run('invoke-task', async () => {
    const { orgId, taskId } = parseTaskId(context.requestPayload.task_id);
    await prisma.tasks.update({ where: { id: taskId }, data: { status: 'processing' } });
    const agent = new FunMax(context.requestPayload);
    const request = context.requestPayload.task_request;
    await prisma.taskProgresses.create({
      data: { taskId, organizationId: orgId, index: 0, step: 0, round: 1, type: BaseAgentEvents.LIFECYCLE_START, content: { request: request } },
    });
    const summary = await agent.generateTaskSummary();
    await prisma.tasks.update({ where: { id: taskId }, data: { summary: summary } });
  });

  await context.run('agent-prepare', async () => {
    const { orgId, taskId } = parseTaskId(context.requestPayload.task_id);
    const agent = new FunMax(context.requestPayload);
    for await (const progress of agent.prepare()) {
      await prisma.taskProgresses.create({
        data: { taskId, organizationId: orgId, index: 0, step: 0, round: 1, type: progress.phase, content: progress.data || {} },
      });
    }
  });

  let stepCount = 0;

  while (stepCount < (context.requestPayload.max_steps || 20)) {
    const result = await context.run(`agent-step-${stepCount}`, async () => {
      const { orgId, taskId } = parseTaskId(context.requestPayload.task_id);
      const agent = new FunMax(context.requestPayload);
      // 等待 prepare 完成
      for await (const _ of agent.prepare()) {
      }
      const previousResult = await redis.get<string>(`agent-step:${orgId}:${taskId}`);
      const previousResultJson = toJson<StepResult[]>(previousResult);
      await agent.memory.addMessage({ role: 'user', content: context.requestPayload.task_request });
      await agent.memory.addMessages(
        previousResultJson?.flatMap(item => {
          return [
            { role: 'user', content: item.prompt || '' },
            { role: 'assistant', content: item.result || '' },
          ];
        }) || [],
      );

      // 使用流式步骤处理 - 通过yield获取进度更新，通过return获取最终结果
      const stepStream = agent.step();

      let iteratorResult;
      while (!(iteratorResult = await stepStream.next()).done) {
        const progress = iteratorResult.value;

        await prisma.taskProgresses.create({
          data: { taskId, organizationId: orgId, index: 0, step: stepCount + 1, round: 1, type: progress.phase, content: progress.data || {} },
        });
      }

      // 当iteratorResult.done为true时，iteratorResult.value就是return的值
      const finalResult = iteratorResult.value;

      // 更新最终步骤结果到Redis
      await redis.set(`agent-step:${orgId}:${taskId}`, JSON.stringify([...(previousResultJson || []), finalResult]), { ex: 60 * 60 * 24 });

      return finalResult;
    });

    stepCount++;

    if (stepCount >= (context.requestPayload.max_steps || 10)) {
      break;
    }

    if (result?.terminated) {
      break;
    }
  }

  await context.run('agent-terminate', async () => {
    const { orgId, taskId } = parseTaskId(context.requestPayload.task_id);
    await prisma.taskProgresses.create({
      data: { taskId, organizationId: orgId, index: 0, step: 0, round: 1, type: BaseAgentEvents.LIFECYCLE_COMPLETE, content: {} },
    });
    await prisma.tasks.update({ where: { id: taskId }, data: { status: 'completed' } });
  });
});

const parseTaskId = (taskId: string) => {
  return { orgId: taskId.split('/')[0]!, taskId: taskId.split('/')[1]! };
};
