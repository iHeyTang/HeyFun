import { Organizations } from '@prisma/client';
import { headers } from 'next/headers';
import { auth, AuthUser } from './auth';
import { prisma } from './prisma';
import { to } from '../shared/to';

export type AuthWrapperContext<T> = { user: AuthUser; organization: Organizations; args: T };

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
    try {
    } catch (error) {
      console.error('Authentication error:', error);
      throw new Error('Authentication failed');
    }

    const [error, result] = await to(
      (async () => {
        const session = await auth.api.getSession({
          headers: await headers(),
        });
        if (!session) {
          throw new Error('Unauthorized access');
        }

        const organization = await prisma.organizations.findFirst({
          where: { ownerId: session.user.id, personal: true },
        });

        if (!organization) {
          throw new Error('Organization not found');
        }

        return {
          user: {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
          },
          organization,
        };
      })(),
    );

    if (error) {
      throw new Error('Authentication failed: ' + error.message);
    }

    const res = await fn({ user: result.user, organization: result.organization, args });
    return { data: res, error: undefined };
  };
}
