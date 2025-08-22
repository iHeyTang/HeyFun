import { auth, clerkClient, Organization } from '@clerk/nextjs/server';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { userId, orgId } = await auth();

  if (!userId) {
    return null;
  }

  const clerk = await clerkClient();

  // Get user details from Clerk
  const user = await clerk.users.getUser(userId);
  return {
    id: userId,
    email: user.emailAddresses[0]?.emailAddress || '',
    name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
  };
}
