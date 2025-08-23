'use server';
import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';

export const getPreferences = withUserAuth(async ({ orgId }: AuthWrapperContext<{}>) => {
  const preferences = await prisma.preferences.findUnique({
    where: { organizationId: orgId },
  });

  return preferences;
});

export const updatePreferences = withUserAuth(async ({ orgId, args }: AuthWrapperContext<{ language?: string }>) => {
  const existingPreferences = await prisma.preferences.findUnique({
    where: { organizationId: orgId },
  });

  if (!existingPreferences) {
    await prisma.preferences.create({
      data: { organizationId: orgId, language: args.language },
    });
  } else {
    await prisma.preferences.update({
      where: { organizationId: orgId },
      data: { language: args.language },
    });
  }
});
