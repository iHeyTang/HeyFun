'use server';

import { FunMaxConfig } from '@repo/agent';
import { Chat } from '@repo/llm';
import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { decryptTextWithPrivateKey } from '@/lib/server/crypto';
import { LANGUAGE_CODES } from '@/lib/shared/language';
import { prisma } from '@/lib/server/prisma';
import { to } from '@/lib/shared/to';
import { mcpServerSchema } from '@/lib/shared/tools';
import fs from 'fs';
import path from 'path';
import type { ToolConfig } from '@repo/agent';
import { Daytona } from '@daytonaio/sdk';
import sandboxManager from '@/lib/server/sandbox';
import { SandboxRunner } from '@/lib/server/sandbox/base';

const AGENT_URL = process.env.AGENT_URL || 'http://localhost:7200';

const privateKey = fs.readFileSync(path.join(process.cwd(), 'keys', 'private.pem'), 'utf8');

export const getTask = withUserAuth(async ({ organization, args }: AuthWrapperContext<{ taskId: string }>) => {
  const { taskId } = args;
  const task = await prisma.tasks.findUnique({
    where: { id: taskId, organizationId: organization.id },
    include: { progresses: { orderBy: { index: 'asc' } } },
  });
  return task;
});

export const pageTasks = withUserAuth(async ({ organization, args }: AuthWrapperContext<{ page: number; pageSize: number }>) => {
  const { page = 1, pageSize = 10 } = args || {};
  const tasks = await prisma.tasks.findMany({
    where: { organizationId: organization.id },
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: { createdAt: 'desc' },
  });
  const total = await prisma.tasks.count();
  return { tasks, total };
});

type CreateTaskArgs = {
  taskId?: string;
  modelProvider: string;
  modelId: string;
  prompt: string;
  toolIds: string[];
  files: File[];
  shouldPlan: boolean;
};
export const createTask = withUserAuth(async ({ organization, args }: AuthWrapperContext<CreateTaskArgs>) => {
  const { taskId, modelProvider, modelId, prompt, toolIds, files, shouldPlan } = args;
  const crpytedProviderConfig = await prisma.modelProviderConfigs.findFirst({ where: { provider: modelProvider, organizationId: organization.id } });
  if (!crpytedProviderConfig) throw new Error('Model provider not found');
  const providerConfig = crpytedProviderConfig.config ? JSON.parse(decryptTextWithPrivateKey(crpytedProviderConfig.config, privateKey)) : {};
  if (!providerConfig) throw new Error('Model provider config not found');

  const preferences = await prisma.preferences.findUnique({
    where: { organizationId: organization.id },
  });

  // Query tool configurations
  const agentTools = await prisma.agentTools.findMany({
    where: { organizationId: organization.id, id: { in: toolIds } },
    include: { schema: true },
  });

  // Build tool list, use configuration if available, otherwise use tool name
  const processedTools = toolIds.map(tool => {
    const agentTool = agentTools.find(at => at.id === tool);
    if (agentTool) {
      if (agentTool.source === 'STANDARD' && agentTool.schema) {
        const env = agentTool.env ? JSON.parse(decryptTextWithPrivateKey(agentTool.env, privateKey)) : {};
        const query = agentTool.query ? JSON.parse(decryptTextWithPrivateKey(agentTool.query, privateKey)) : {};
        const fullUrl = buildMcpSseFullUrl(agentTool.schema.url, query);
        const headers = agentTool.headers ? JSON.parse(decryptTextWithPrivateKey(agentTool.headers, privateKey)) : {};

        const tool: ToolConfig = {
          id: agentTool.id,
          name: agentTool.name || agentTool.schema?.name,
          command: agentTool.schema?.command,
          args: agentTool.schema?.args || [],
          env: env,
          url: fullUrl,
          headers: headers,
        };
        return tool;
      } else if (agentTool.source === 'CUSTOM') {
        const customConfig = agentTool.customConfig ? JSON.parse(decryptTextWithPrivateKey(agentTool.customConfig, privateKey)) : {};
        const validationResult = mcpServerSchema.safeParse(customConfig);
        if (!validationResult.success) {
          throw new Error(`Invalid config: ${validationResult.error.message}`);
        }
        const server = validationResult.data;
        const fullUrl = buildMcpSseFullUrl(server.url || '', server.query || {});
        const tool: ToolConfig = {
          id: agentTool.id,
          name: agentTool.name || agentTool.id,
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
  const { task, history } = await createOrFetchTask(organization.id, { taskId, prompt, llmId: modelId, tools: toolIds });

  const body: FunMaxConfig = {
    name: 'FunMax',
    task_id: `${organization.id}/${task.id}`,
    task_request: prompt,
    language: preferences?.language || 'en',
    llm: {
      model: modelId,
      baseUrl: providerConfig.baseUrl,
      apiKey: providerConfig.apiKey,
      providerId: modelProvider,
      modelId: modelId,
    },
    should_plan: shouldPlan,
    tools: processedTools.filter(tool => tool !== undefined) as ToolConfig[],
    history: history as Chat.ChatCompletionMessageParam[],
  };

  const sandbox = await sandboxManager.create();
  const [error, response] = await to(
    fetch(`${sandbox.getRunnerDomain()}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    }).then(async res => {
      if (res.status >= 200 && res.status < 300) {
        return (await res.json()) as Promise<{ taskId: string }>;
      }
      throw Error(`Server Error: ${JSON.stringify(await res.json())}`);
    }),
  );

  if (error || !response.taskId) {
    await prisma.tasks.update({ where: { id: task.id }, data: { status: 'failed' } });
    throw error || new Error('Unkown Error');
  }

  await prisma.tasks.update({ where: { id: task.id }, data: { outId: response.taskId, status: 'processing' } });

  // Handle event stream in background
  handleTaskEvents(task.id, response.taskId, organization.id, sandbox).catch(error => {
    console.error('Failed to handle task events:', error);
  });

  return { id: task.id, outId: response.taskId };
});

export const terminateTask = withUserAuth(async ({ organization, args }: AuthWrapperContext<{ taskId: string }>) => {
  const { taskId } = args;

  const task = await prisma.tasks.findUnique({ where: { id: taskId, organizationId: organization.id } });
  if (!task) throw new Error('Task not found');
  if (task.status !== 'processing' && task.status !== 'terminating') {
    return;
  }

  const [error] = await to(
    fetch(`${AGENT_URL}/tasks/terminate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: `${organization.id}/${taskId}` }),
    }),
  );
  if (error && error.message !== 'Task not found') throw new Error('Failed to terminate task');

  await prisma.tasks.update({ where: { id: taskId, organizationId: organization.id }, data: { status: 'terminated' } });
});

export const shareTask = withUserAuth(async ({ organization, args }: AuthWrapperContext<{ taskId: string; expiresAt: number }>) => {
  const { taskId, expiresAt } = args;
  const task = await prisma.tasks.findUnique({ where: { id: taskId, organizationId: organization.id } });
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
async function handleTaskEvents(taskId: string, outId: string, organizationId: string, sandbox: SandboxRunner) {
  const streamResponse = await fetch(`${sandbox.getRunnerDomain()}/api/tasks/event?taskId=${outId}`);
  const reader = streamResponse.body?.getReader();
  if (!reader) throw new Error('Failed to get response stream');

  const decoder = new TextDecoder();

  const taskProgresses = await prisma.taskProgresses.findMany({ where: { taskId }, orderBy: { index: 'asc' } });
  const rounds = taskProgresses.map(progress => progress.round);
  const round = Math.max(...rounds, 1);
  let messageIndex = taskProgresses.length || 0;
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
            break;
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
            break;
          }
        } catch (error) {
          console.error('Failed to process message:', error);
        }
      }

      if (done) break;
    }
  } finally {
    console.log('xxxxxxxxx done');
    reader.releaseLock();
    await sandboxManager.delete(sandbox.id);
  }
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
    where: { taskId: task.id, type: { in: ['agent:lifecycle:start', 'agent:lifecycle:complete'] } },
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
