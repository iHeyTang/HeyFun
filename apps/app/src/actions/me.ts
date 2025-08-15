'use server';

import { prisma } from '@/lib/server/prisma';
import { verifyPassword, hashPassword } from '@/lib/server/password';
import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';

/**
 * Modify password
 * @param oldPassword Current password
 * @param newPassword New password
 * @returns Update result
 */
export const modifyPassword = withUserAuth(async ({ user, args }: AuthWrapperContext<{ oldPassword: string; newPassword: string }>) => {
  const { oldPassword, newPassword } = args;
  const dbUser = await prisma.users.findUnique({
    where: { id: user.id },
  });

  if (!dbUser) {
    throw new Error('User not found');
  }

  if (!verifyPassword(oldPassword, dbUser.password)) {
    throw new Error('Invalid old password');
  }

  const newHashedPassword = hashPassword(newPassword);

  await prisma.users.update({
    where: { id: user.id },
    data: {
      password: newHashedPassword,
    },
  });

  return { message: 'Password updated successfully' };
});

export const getMe = withUserAuth(async ({ user, organization }: AuthWrapperContext<{}>) => {
  if (!user.id) {
    throw new Error('User not found');
  }

  if (!organization) {
    throw new Error('Organization not found');
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    organizationId: organization.id,
    organizationName: organization.name,
    isRoot: user.email === process.env.ROOT_USER_EMAIL,
  };
});
