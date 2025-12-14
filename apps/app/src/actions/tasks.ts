'use server';

import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { decryptTextWithPrivateKey } from '@/lib/server/crypto';
import { prisma } from '@/lib/server/prisma';
import { workflow } from '@/lib/server/workflow';
import { mcpServerSchema } from '@/lib/shared/tools';
import type { AddMcpConfig } from '@repo/agent';
import { FunMaxConfig } from '@repo/agent';
import { UnifiedChat } from '@repo/llm/chat';
import { union } from 'lodash';

export const getTask = withUserAuth('tasks/getTask', async ({ orgId, args }: AuthWrapperContext<{ taskId: string }>) => {
  const { taskId } = args;
  const task = await prisma.tasks.findUnique({
    where: { id: taskId, organizationId: orgId },
    include: { progresses: { orderBy: { createdAt: 'asc' } } },
  });
  return task;
});

export const pageTasks = withUserAuth('tasks/pageTasks', async ({ orgId, args }: AuthWrapperContext<{ page: number; pageSize: number }>) => {
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
  modelId: string;
  prompt: string;
  toolIds: string[];
  files: File[];
};

const getAgent = async (
  orgId: string,
  agentId: string | undefined,
): Promise<{ name: string; tools: string[]; systemPromptTemplate: string | undefined }> => {
  if (!agentId) {
    return {
      name: 'FunMax',
      tools: [],
      systemPromptTemplate: undefined,
    };
  }
  const agent = await prisma.agents.findUnique({
    where: { id: agentId, organizationId: orgId },
  });
  if (!agent) throw new Error('Agent not found');
  return {
    name: agent.name,
    tools: agent.tools as string[],
    systemPromptTemplate: agent.systemPromptTemplate || undefined,
  };
};

const getTools = async (orgId: string, toolIds: string[]) => {
  const agentTools = await prisma.agentTools.findMany({ where: { organizationId: orgId, id: { in: toolIds } }, include: { schema: true } });
  const tools = agentTools.map(agentTool => {
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
  });
  return tools.filter(tool => tool !== undefined) as AddMcpConfig[];
};

export const createTask = withUserAuth('tasks/createTask', async ({ orgId, args }: AuthWrapperContext<CreateTaskArgs>) => {
  const { taskId, agentId, modelId, prompt, toolIds, files } = args;
  const preferences = await prisma.preferences.findUnique({
    where: { organizationId: orgId },
  });

  // Get agent configuration if agentId is provided
  const agent = await getAgent(orgId, agentId);

  // Build tool list, use configuration if available, otherwise use tool name
  const processedTools = await getTools(orgId, union([...agent.tools, ...toolIds]));

  // Create task or restart task
  const { task, history } = await createOrFetchTask(orgId, { taskId, prompt, llmId: modelId, tools: processedTools.map(tool => tool.id) });
  if (task.status === 'completed' || task.status === 'terminated' || task.status === 'failed') {
    throw new Error('Task already exists');
  }

  const body: FunMaxConfig = {
    name: agent.name,
    task_id: `${orgId}/${task.id}`,
    task_request: prompt,
    language: preferences?.language || 'en',
    llm: {
      modelId: modelId,
    },
    tools: processedTools.filter(tool => tool !== undefined) as AddMcpConfig[],
    history: history as UnifiedChat.Message[],
    systemPromptTemplate: agent.systemPromptTemplate,
    sandboxId: orgId,
  };

  const workflowRunId = await workflow.trigger({ url: '/api/workflow/task', body });
  console.log('workflowRunId', workflowRunId);

  return { id: task.id, outId: body.task_id };
});

export const terminateTask = withUserAuth('tasks/terminateTask', async ({ orgId, args }: AuthWrapperContext<{ taskId: string }>) => {
  const { taskId } = args;

  const task = await prisma.tasks.findUnique({ where: { id: taskId, organizationId: orgId } });
  if (!task) throw new Error('Task not found');
  if (task.status !== 'processing' && task.status !== 'terminating') {
    return;
  }
});

export const shareTask = withUserAuth('tasks/shareTask', async ({ orgId, args }: AuthWrapperContext<{ taskId: string; expiresAt: number }>) => {
  const { taskId, expiresAt } = args;
  const task = await prisma.tasks.findUnique({ where: { id: taskId, organizationId: orgId } });
  if (!task) throw new Error('Task not found');
  await prisma.tasks.update({ where: { id: taskId }, data: { shareExpiresAt: new Date(expiresAt) } });
});

export const getSharedTask = withUserAuth('tasks/getSharedTask', async ({ orgId, args }: AuthWrapperContext<{ taskId: string }>) => {
  const { taskId } = args;
  const task = await prisma.tasks.findUnique({
    where: { id: taskId },
    include: { progresses: { orderBy: { createdAt: 'asc' } } },
  });
  if (!task) throw new Error('Task not found');
  if (task.shareExpiresAt && task.shareExpiresAt < new Date()) {
    throw new Error('Task Share Link expired');
  }
  return { data: task, error: null };
});

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
    orderBy: { createdAt: 'asc' },
  });

  const history = progresses.reduce((acc, progress) => {
    if (progress.type === 'agent:lifecycle:start') {
      acc.push({ role: 'user', content: (progress.content as { request: string }).request });
    } else if (progress.type === 'agent:lifecycle:complete') {
      const latestUserProgress = acc.reverse().find(item => item.role === 'user');
      if (latestUserProgress) {
        acc.push({ role: 'assistant', content: (progress.content as { results: string[] }).results.join('\n') });
      }
    } else if (progress.type === 'agent:lifecycle:error') {
      const latestUserProgress = acc.reverse().find(item => item.role === 'user');
      if (latestUserProgress) {
        acc.push({ role: 'assistant', content: (progress.content as { error: string }).error });
      }
    }
    return acc;
  }, [] as UnifiedChat.Message[]);

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
