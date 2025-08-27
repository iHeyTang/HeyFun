'use server';

import { FunMaxConfig } from '@repo/agent';
import { Chat } from '@repo/llm/chat';
import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { decryptTextWithPrivateKey } from '@/lib/server/crypto';
import { prisma } from '@/lib/server/prisma';
import { to } from '@/lib/shared/to';
import { mcpServerSchema } from '@/lib/shared/tools';
import type { AddMcpConfig } from '@repo/agent';
import { taskRuntime } from '@/lib/runtime';
import { sseRuntime } from '@/lib/sse';

const AGENT_URL = process.env.AGENT_URL || 'http://localhost:7200';

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

  const existingTask = taskRuntime.getTask(body.task_id);
  if (existingTask) {
    throw new Error('Task already exists');
  }

  // 创建任务
  if (!body.task_id) {
    await prisma.tasks.update({ where: { id: task.id }, data: { status: 'failed' } });
    throw new Error('Unkown Error');
  }

  await prisma.tasks.update({ where: { id: task.id }, data: { outId: body.task_id, status: 'processing' } });

  // Handle event stream in background - completely detached from current request
  setImmediate(() => {
    taskRuntime.createTask(body.task_id, body);
    handleTaskEvents(task.id, body.task_id, orgId).catch(error => {
      console.error('Failed to handle task events:', error);
    });
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

  await taskRuntime.terminateTask(task.outId!);
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
async function handleTaskEvents(taskId: string, outId: string, organizationId: string) {
  const taskProgresses = await prisma.taskProgresses.findMany({ where: { taskId }, orderBy: { index: 'asc' } });
  const rounds = taskProgresses.map(progress => progress.round);
  const round = Math.max(...rounds, 1);
  let messageIndex = taskProgresses.length || 0;
  const stream = sseRuntime.createSSEStream(outId);
  await getTaskEventStream(stream.getReader(), async parsed => {
    const type = parsed.name;
    const { step, content } = parsed;

    if (type === 'agent:lifecycle:summary') {
      await prisma.tasks.update({
        where: { id: taskId },
        data: { summary: content.summary },
      });
    } else {
      // Write message to database
      await prisma.taskProgresses.create({
        data: { taskId, organizationId, index: messageIndex++, step, round, type, content },
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

type AgentEvent = {
  id: string;
  name: string;
  step: number;
  timestamp: string;
  content: any;
};

async function getTaskEventStream(reader: ReadableStreamDefaultReader<Uint8Array>, onEvent: (event: AgentEvent) => Promise<void>): Promise<void> {
  if (!reader) throw new Error('Failed to get response stream');

  const decoder = new TextDecoder();

  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();

      if (value) {
        buffer += decoder.decode(value, { stream: true });
      }

      const lines = buffer.split('\n');
      // Keep the last line (might be incomplete) if not the final read
      buffer = done ? '' : lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;

        try {
          const parsed = JSON.parse(line.slice(6)) as {
            id: string;
            name: string;
            step: number;
            timestamp: string;
            content: any;
          };
          await onEvent(parsed);
        } catch (error) {
          console.error('Failed to process message:', error);
        }
      }
      if (done) break;
    }
    // If we reach here, the stream completed successfully
    return;
  } finally {
    reader.releaseLock();
  }
}
