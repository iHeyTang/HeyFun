'use server';

import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';

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
