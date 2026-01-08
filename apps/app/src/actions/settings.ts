'use server';
import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';
import { Prisma } from '@prisma/client';
import { ModelInfo } from '@repo/llm/chat';

export const getPreferences = withUserAuth('settings/getPreferences', async ({ orgId }: AuthWrapperContext<{}>) => {
  const preferences = await prisma.preferences.findUnique({
    where: { organizationId: orgId },
  });

  return preferences;
});

export type UpdatePreferencesArgs = {
  language?: string | undefined;
  defaultChatbotModel?: ModelInfo | null | undefined;
  defaultAgentModel?: ModelInfo | null | undefined;
};

export const updatePreferences = withUserAuth('settings/updatePreferences', async ({ orgId, args }: AuthWrapperContext<UpdatePreferencesArgs>) => {
  const existingPreferences = await prisma.preferences.findUnique({
    where: { organizationId: orgId },
  });

  if (!existingPreferences) {
    await prisma.preferences.create({
      data: {
        organizationId: orgId,
        ...(args.language !== undefined && { language: args.language }),
        defaultChatbotModel: args.defaultChatbotModel
          ? { id: args.defaultChatbotModel.id, name: args.defaultChatbotModel.name, family: args.defaultChatbotModel.family }
          : undefined,
        defaultAgentModel: args.defaultAgentModel
          ? { id: args.defaultAgentModel.id, name: args.defaultAgentModel.name, family: args.defaultAgentModel.family }
          : undefined,
      },
    });
  } else {
    const updateData: Prisma.PreferencesUpdateInput = {
      ...(args.language !== undefined && { language: args.language }),
    };

    if (args.defaultChatbotModel !== undefined) {
      updateData.defaultChatbotModel = args.defaultChatbotModel
        ? { id: args.defaultChatbotModel.id, name: args.defaultChatbotModel.name, family: args.defaultChatbotModel.family }
        : Prisma.JsonNull;
    }

    if (args.defaultAgentModel !== undefined) {
      updateData.defaultAgentModel = args.defaultAgentModel
        ? { id: args.defaultAgentModel.id, name: args.defaultAgentModel.name, family: args.defaultAgentModel.family }
        : Prisma.JsonNull;
    }

    await prisma.preferences.update({
      where: { organizationId: orgId },
      data: updateData,
    });
  }
});

export const getEnvironmentVariables = withUserAuth('settings/getEnvironmentVariables', async ({ orgId }: AuthWrapperContext<{}>) => {
  const envVars = await prisma.environmentVariables.findUnique({
    where: { organizationId: orgId },
  });

  if (!envVars) {
    // 如果不存在，返回空对象
    return { variables: {} };
  }

  return { variables: envVars.variables || {} };
});

export type UpdateEnvironmentVariablesArgs = {
  variables: Record<string, string>;
};

export const updateEnvironmentVariables = withUserAuth(
  'settings/updateEnvironmentVariables',
  async ({ orgId, args }: AuthWrapperContext<UpdateEnvironmentVariablesArgs>) => {
    const existing = await prisma.environmentVariables.findUnique({
      where: { organizationId: orgId },
    });

    if (!existing) {
      await prisma.environmentVariables.create({
        data: {
          organizationId: orgId,
          variables: args.variables,
        },
      });
    } else {
      await prisma.environmentVariables.update({
        where: { organizationId: orgId },
        data: {
          variables: args.variables,
        },
      });
    }
  },
);

// 获取单个环境变量的值（供工具使用）
export const getEnvironmentVariable = withUserAuth(
  'settings/getEnvironmentVariable',
  async ({ orgId, args }: AuthWrapperContext<{ key: string }>) => {
    const envVars = await prisma.environmentVariables.findUnique({
      where: { organizationId: orgId },
    });

    if (!envVars || !envVars.variables || typeof envVars.variables !== 'object') {
      return null;
    }

    const variables = envVars.variables as Record<string, any>;
    return variables[args.key] || null;
  },
);
