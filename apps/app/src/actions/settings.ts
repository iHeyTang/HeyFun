'use server';
import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';

export const getPreferences = withUserAuth(async ({ organization }: AuthWrapperContext<{}>) => {
  const preferences = await prisma.preferences.findUnique({
    where: { organizationId: organization.id },
  });

  return preferences;
});

export const updatePreferences = withUserAuth(async ({ organization, args }: AuthWrapperContext<{ language?: string }>) => {
  const existingPreferences = await prisma.preferences.findUnique({
    where: { organizationId: organization.id },
  });

  if (!existingPreferences) {
    await prisma.preferences.create({
      data: { organizationId: organization.id, language: args.language },
    });
  } else {
    await prisma.preferences.update({
      where: { organizationId: organization.id },
      data: { language: args.language },
    });
  }
});
