'use server';

import { FunMaxConfig } from '@repo/agent';
import { Chat } from '@repo/llm/chat';
import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { decryptTextWithPrivateKey } from '@/lib/server/crypto';
import { prisma } from '@/lib/server/prisma';
import { mcpServerSchema } from '@/lib/shared/tools';
import type { AddMcpConfig } from '@repo/agent';
import { TaskRuntime } from '@/lib/runtime';

export const getTask = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ taskId: string }>) => {
  const { taskId } = args;
  const task = await prisma.tasks.findUnique({
    where: { id: taskId, organizationId: orgId },
    include: { progresses: { orderBy: { index: 'asc' } } },
  });
  return task;
});

export const pageTasks = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ page: number; pageSize: number }>) => {
  const { page = 1, pageSize = 10 } = args || {};
  const tasks = await prisma.tasks.findMany({
    where: { organizationId: orgId },
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: { createdAt: 'desc' },
  });
  const total = await prisma.tasks.count();
  return { tasks, total };
});

type CreateTaskArgs = {
  taskId?: string;
  agentId?: string;
  modelProvider: string;
  modelId: string;
  prompt: string;
  toolIds: string[];
  files: File[];
  shouldPlan: boolean;
};
export const createTask = withUserAuth(async ({ orgId, args }: AuthWrapperContext<CreateTaskArgs>) => {
  const { taskId, agentId, modelProvider, modelId, prompt, toolIds, files, shouldPlan } = args;
  const crpytedProviderConfig = await prisma.modelProviderConfigs.findFirst({ where: { provider: modelProvider, organizationId: orgId } });
  const providerConfig = crpytedProviderConfig?.config ? JSON.parse(decryptTextWithPrivateKey(crpytedProviderConfig.config)) : {};
  const preferences = await prisma.preferences.findUnique({
    where: { organizationId: orgId },
  });

  // Get agent configuration if agentId is provided
  let agent = null;
  let finalToolIds = toolIds;
  let promptTemplates = undefined;

  if (agentId) {
    agent = await prisma.agents.findUnique({
      where: { id: agentId, organizationId: orgId },
    });
    if (!agent) throw new Error('Agent not found');

    // Use agent's tools if no tools specified
    if (toolIds.length === 0 && agent.tools) {
      finalToolIds = agent.tools as string[];
    }

    // Use agent's prompt templates
    promptTemplates = agent.promptTemplates;
  }

  // Query tool configurations
  const agentTools = await prisma.agentTools.findMany({
    where: { organizationId: orgId, id: { in: finalToolIds } },
    include: { schema: true },
  });

  // Build tool list, use configuration if available, otherwise use tool name
  const processedTools = finalToolIds.map(tool => {
    const agentTool = agentTools.find(at => at.id === tool);
    if (agentTool) {
      if (agentTool.source === 'STANDARD' && agentTool.schema) {
        const env = agentTool.env ? JSON.parse(decryptTextWithPrivateKey(agentTool.env)) : {};
        const query = agentTool.query ? JSON.parse(decryptTextWithPrivateKey(agentTool.query)) : {};
        const fullUrl = buildMcpSseFullUrl(agentTool.schema.url, query);
        const headers = agentTool.headers ? JSON.parse(decryptTextWithPrivateKey(agentTool.headers)) : {};

        const tool: AddMcpConfig = {
          id: agentTool.id,
          name: agentTool.name || agentTool.schema?.name,
          version: '',
          command: agentTool.schema?.command,
          args: agentTool.schema?.args || [],
          env: env,
          url: fullUrl,
          headers: headers,
        };
        return tool;
      } else if (agentTool.source === 'CUSTOM') {
        const customConfig = agentTool.customConfig ? JSON.parse(decryptTextWithPrivateKey(agentTool.customConfig)) : {};
        const validationResult = mcpServerSchema.safeParse(customConfig);
        if (!validationResult.success) {
          throw new Error(`Invalid config: ${validationResult.error.message}`);
        }
        const server = validationResult.data;
        const fullUrl = buildMcpSseFullUrl(server.url || '', server.query || {});
        const tool: AddMcpConfig = {
          id: agentTool.id,
          name: agentTool.name || agentTool.id,
          version: '',
          command: server.command || '',
          args: server.args || [],
          env: server.env || {},
          url: fullUrl,
          headers: server.headers || {},
        };
        return tool;
      }
    }
  });

  // Create task or restart task
  const { task, history } = await createOrFetchTask(orgId, { taskId, prompt, llmId: modelId, tools: finalToolIds });
  if (task.status === 'completed' || task.status === 'terminated' || task.status === 'failed') {
    throw new Error('Task already exists');
  }

  const body: FunMaxConfig = {
    name: agent?.name || 'FunMax',
    task_id: `${orgId}/${task.id}`,
    task_request: prompt,
    language: preferences?.language || 'en',
    llm: {
      model: modelId,
      baseUrl: providerConfig?.baseUrl,
      apiKey: providerConfig?.apiKey,
      providerId: modelProvider,
      modelId: modelId,
    },
    should_plan: shouldPlan,
    tools: processedTools.filter(tool => tool !== undefined) as AddMcpConfig[],
    history: history as Chat.ChatCompletionMessageParam[],
    promptTemplates: promptTemplates,
    sandboxId: orgId,
  };

  // 创建任务
  if (!body.task_id) {
    await prisma.tasks.update({ where: { id: task.id }, data: { status: 'failed' } });
    throw new Error('Unkown Error');
  }

  await prisma.tasks.update({ where: { id: task.id }, data: { outId: body.task_id, status: 'processing' } });

  const taskRuntime = TaskRuntime.createTask(body);

  // Handle event stream in background - completely detached from current request
  setImmediate(async () => {
    handleTaskEvents(orgId, task.id, taskRuntime);
    await taskRuntime.run(body.task_request);
  });

  return { id: task.id, outId: body.task_id };
});

export const terminateTask = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ taskId: string }>) => {
  const { taskId } = args;

  const task = await prisma.tasks.findUnique({ where: { id: taskId, organizationId: orgId } });
  if (!task) throw new Error('Task not found');
  if (task.status !== 'processing' && task.status !== 'terminating') {
    return;
  }
});

export const shareTask = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ taskId: string; expiresAt: number }>) => {
  const { taskId, expiresAt } = args;
  const task = await prisma.tasks.findUnique({ where: { id: taskId, organizationId: orgId } });
  if (!task) throw new Error('Task not found');
  await prisma.tasks.update({ where: { id: taskId }, data: { shareExpiresAt: new Date(expiresAt) } });
});

export const getSharedTask = async ({ taskId }: { taskId: string }) => {
  const task = await prisma.tasks.findUnique({
    where: { id: taskId },
    include: { progresses: { orderBy: { index: 'asc' } } },
  });
  if (!task) throw new Error('Task not found');
  if (task.shareExpiresAt && task.shareExpiresAt < new Date()) {
    throw new Error('Task Share Link expired');
  }
  return { data: task, error: null };
};

// Handle event stream in background
function handleTaskEvents(orgId: string, taskId: string, taskRuntime: TaskRuntime) {
  const round = 1;
  let messageIndex = 0;
  taskRuntime.on('agent:*', async event => {
    const type = event.name;
    const { step, content } = event;

    if (type === 'agent:lifecycle:summary') {
      await prisma.tasks.update({
        where: { id: taskId },
        data: { summary: content.summary },
      });
    } else {
      // Write message to database
      await prisma.taskProgresses.create({
        data: { taskId, organizationId: orgId, index: messageIndex++, step, round, type, content },
      });
    }

    // If complete message, update task status
    if (type === 'agent:lifecycle:complete') {
      await prisma.tasks.update({
        where: { id: taskId },
        data: { status: 'completed' },
      });
    }
    if (type === 'agent:lifecycle:terminating') {
      await prisma.tasks.update({
        where: { id: taskId },
        data: { status: 'terminating' },
      });
    }
    if (type === 'agent:lifecycle:terminated') {
      await prisma.tasks.update({
        where: { id: taskId },
        data: { status: 'terminated' },
      });
    }
    if (type === 'agent:lifecycle:error') {
      await prisma.tasks.update({
        where: { id: taskId },
        data: { status: 'failed' },
      });
    }
  });
}

async function createOrFetchTask(organizationId: string, config: { taskId: string } | { prompt: string; llmId: string; tools: string[] }) {
  if (!('taskId' in config) || !config.taskId) {
    const { prompt, llmId, tools } = config as { prompt: string; llmId: string; tools: string[] };
    const task = await prisma.tasks.create({
      data: {
        prompt,
        status: 'pending',
        llmId,
        organizationId,
        tools,
      },
    });
    return { task, history: [] };
  }

  const task = await prisma.tasks.findUnique({ where: { id: config.taskId, organizationId } });
  if (!task) throw new Error('Task not found');
  if (task.status !== 'completed' && task.status !== 'terminated' && task.status !== 'failed') throw new Error('Task is processing');

  const progresses = await prisma.taskProgresses.findMany({
    where: { taskId: task.id, type: { in: ['agent:lifecycle:start', 'agent:lifecycle:complete', 'agent:lifecycle:error'] } },
    select: { type: true, content: true },
    orderBy: { index: 'asc' },
  });

  const history = progresses.reduce(
    (acc, progress) => {
      if (progress.type === 'agent:lifecycle:start') {
        acc.push({ role: 'user', message: (progress.content as { request: string }).request });
      } else if (progress.type === 'agent:lifecycle:complete') {
        const latestUserProgress = acc.reverse().find(item => item.role === 'user');
        if (latestUserProgress) {
          acc.push({ role: 'assistant', message: (progress.content as { results: string[] }).results.join('\n') });
        }
      } else if (progress.type === 'agent:lifecycle:error') {
        const latestUserProgress = acc.reverse().find(item => item.role === 'user');
        if (latestUserProgress) {
          acc.push({ role: 'assistant', message: (progress.content as { error: string }).error });
        }
      }
      return acc;
    },
    [] as { role: string; message: string }[],
  );

  return { task, history };
}

/**
 * Build full url for MCP SSE
 *
 * url is stored in the config of the tool schema
 * query is stored in the tool
 * so we need to build the full url with query parameters
 *
 * @param url - The base URL
 * @param query - The query parameters
 * @returns The full URL with query parameters
 */
const buildMcpSseFullUrl = (url: string, query: Record<string, string>) => {
  if (!url) return '';
  let fullUrl = url;
  if (Object.keys(query).length > 0) {
    const queryParams = new URLSearchParams(query);
    fullUrl = `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}${queryParams.toString()}`;
  }
  return fullUrl;
};
