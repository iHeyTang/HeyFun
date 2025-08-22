import { AuthUser } from './clerk-auth';
import { to } from '../shared/to';
import { auth, clerkClient, Organization } from '@clerk/nextjs/server';

export type AuthWrapperContext<T> = { user: AuthUser; organization: Organization; args: T };

export type AuthWrapped<T, R> = (ctx: AuthWrapperContext<T>) => Promise<R>;

export type AuthAction<T, R> = (args: T) => Promise<{ data: R; error: undefined } | { data: undefined; error: string }>;

/**
 * Authentication wrapper type
 */
export type AuthWrapper<T, R> = (fn: AuthWrapped<T, R>) => AuthAction<T, R>;

/**
 * Regular user authentication wrapper
 */
export function withUserAuth<T = unknown, R = unknown>(fn: AuthWrapped<T, R>): AuthAction<T, R> {
  return async (args: T) => {
    const [error, result] = await to(
      (async () => {
        const { userId, orgId } = await auth();
        if (!userId) {
          throw new Error('Unauthorized access');
        }
        if (!orgId) {
          throw new Error('OrganizationId not found');
        }
        const clerk = await clerkClient();
        const user = await clerk.users.getUser(userId);
        if (!user) {
          throw new Error('Unauthorized access');
        }
        const organization = await clerk.organizations.getOrganization({ organizationId: orgId });

        if (!organization) {
          throw new Error('Organization not found');
        }

        return {
          user: {
            id: user.id,
            email: user.emailAddresses[0]?.emailAddress || '',
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
          },
          organization,
        };
      })(),
    );

    if (error) {
      return { data: undefined, error: error.message };
    }

    try {
      const res = await fn({ user: result.user, organization: result.organization, args });
      return { data: res, error: undefined };
    } catch (error) {
      return { data: undefined, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };
}
