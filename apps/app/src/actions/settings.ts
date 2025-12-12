'use server';
import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';
import { Prisma } from '@prisma/client';
import { ModelInfo } from '@repo/llm/chat';

export const getPreferences = withUserAuth(async ({ orgId }: AuthWrapperContext<{}>) => {
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

export const updatePreferences = withUserAuth(async ({ orgId, args }: AuthWrapperContext<UpdatePreferencesArgs>) => {
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
