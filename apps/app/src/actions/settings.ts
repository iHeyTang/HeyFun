'use server';
import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';
import { Preferences } from '@prisma/client';

export const getPreferences = withUserAuth(async ({ orgId }: AuthWrapperContext<{}>) => {
  const preferences = await prisma.preferences.findUnique({
    where: { organizationId: orgId },
  });

  return preferences;
});

export type UpdatePreferencesArgs = {
  language?: string | undefined;
  defaultChatbotModel?: Preferences['defaultChatbotModel'] | undefined;
  defaultAgentModel?: Preferences['defaultAgentModel'] | undefined;
};

export const updatePreferences = withUserAuth(async ({ orgId, args }: AuthWrapperContext<UpdatePreferencesArgs>) => {
  const existingPreferences = await prisma.preferences.findUnique({
    where: { organizationId: orgId },
  });

  if (!existingPreferences) {
    await prisma.preferences.create({
      data: {
        organizationId: orgId,
        language: args.language,
        defaultChatbotModel: args.defaultChatbotModel ? { id: args.defaultChatbotModel.id, name: args.defaultChatbotModel.name } : undefined,
        defaultAgentModel: args.defaultAgentModel ? { id: args.defaultAgentModel.id, name: args.defaultAgentModel.name } : undefined,
      },
    });
  } else {
    await prisma.preferences.update({
      where: { organizationId: orgId },
      data: {
        language: args.language,
        defaultChatbotModel: args.defaultChatbotModel ? { id: args.defaultChatbotModel.id, name: args.defaultChatbotModel.name } : undefined,
        defaultAgentModel: args.defaultAgentModel ? { id: args.defaultAgentModel.id, name: args.defaultAgentModel.name } : undefined,
      },
    });
  }
});
