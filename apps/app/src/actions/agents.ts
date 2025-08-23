'use server';

import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';

export interface Agent {
  id: string;
  name: string;
  description: string;
  tools: string[];
  promptTemplates?: {
    system: string;
    plan: string;
    next: string;
  };
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type CreateAgentArgs = {
  name: string;
  description: string;
  tools: string[];
  promptTemplates?: {
    system: string;
    plan: string;
    next: string;
  };
  isDefault?: boolean;
};

type UpdateAgentArgs = {
  id: string;
  name: string;
  description: string;
  tools: string[];
  promptTemplates?: {
    system: string;
    plan: string;
    next: string;
  };
  isDefault?: boolean;
};

export const getAgents = withUserAuth(async ({ orgId }: AuthWrapperContext<{}>) => {
  const agents = await prisma.agents.findMany({
    where: { organizationId: orgId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });

  return agents.map(agent => ({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    tools: agent.tools as string[],
    promptTemplates: agent.promptTemplates as any,
    isDefault: agent.isDefault,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  }));
});

export const createAgent = withUserAuth(async ({ orgId, args }: AuthWrapperContext<CreateAgentArgs>) => {
  const { name, description, tools, promptTemplates, isDefault = false } = args;

  // If this is set as default, unset all other defaults
  if (isDefault) {
    await prisma.agents.updateMany({
      where: { organizationId: orgId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const agent = await prisma.agents.create({
    data: {
      name,
      description,
      organizationId: orgId,
      tools: tools,
      promptTemplates: promptTemplates,
      isDefault,
    },
  });

  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    tools: agent.tools as string[],
    promptTemplates: agent.promptTemplates as any,
    isDefault: agent.isDefault,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  };
});

export const updateAgent = withUserAuth(async ({ orgId, args }: AuthWrapperContext<UpdateAgentArgs>) => {
  const { id, name, description, tools, promptTemplates, isDefault = false } = args;

  // Verify agent belongs to organization
  const existingAgent = await prisma.agents.findUnique({
    where: { id, organizationId: orgId },
  });

  if (!existingAgent) {
    throw new Error('Agent not found');
  }

  // If this is set as default, unset all other defaults
  if (isDefault) {
    await prisma.agents.updateMany({
      where: {
        organizationId: orgId,
        isDefault: true,
        id: { not: id },
      },
      data: { isDefault: false },
    });
  }

  const agent = await prisma.agents.update({
    where: { id },
    data: {
      name,
      description,
      tools: tools,
      promptTemplates: promptTemplates,
      isDefault,
    },
  });

  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    tools: agent.tools as string[],
    promptTemplates: agent.promptTemplates as any,
    isDefault: agent.isDefault,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  };
});

export const deleteAgent = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ id: string }>) => {
  const { id } = args;

  // Verify agent belongs to organization and is not default
  const existingAgent = await prisma.agents.findUnique({
    where: { id, organizationId: orgId },
  });

  if (!existingAgent) {
    throw new Error('Agent not found');
  }

  if (existingAgent.isDefault) {
    throw new Error('Cannot delete default agent');
  }

  await prisma.agents.delete({
    where: { id },
  });

  return { success: true };
});

export const getAgent = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ id: string }>) => {
  const { id } = args;

  const agent = await prisma.agents.findUnique({
    where: { id, organizationId: orgId },
  });

  if (!agent) {
    throw new Error('Agent not found');
  }

  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    tools: agent.tools as string[],
    promptTemplates: agent.promptTemplates as any,
    isDefault: agent.isDefault,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  };
});
