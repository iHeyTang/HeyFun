'use server';

import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';

export const getMe = withUserAuth(async ({ getCurrentUser, getCurrentOrg }: AuthWrapperContext<{}>) => {
  const user = await getCurrentUser();
  const organization = await getCurrentOrg();
  if (!user) {
    throw new Error('User not found');
  }
  if (!organization) {
    throw new Error('Organization not found');
  }

  return {
    id: user.id,
    email: user.emailAddresses[0]?.emailAddress || '',
    name: user.fullName,
    organizationId: organization.id,
    organizationName: organization.name,
  };
});
