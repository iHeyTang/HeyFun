import { auth, clerkClient, Organization, User } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { AuthUser } from './clerk-auth';

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

type BaseAuthWrapper = {
  userId: string;
  orgId: string;
  getCurrentUser: () => Promise<User | null>;
  getCurrentOrg: () => Promise<Organization | null>;
};

export type AuthWrapperContext<T> = BaseAuthWrapper & { args: T };

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
    const authObj = await auth();
    const clerk = await clerkClient();
    const { userId, orgId } = authObj;
    if (!userId) {
      throw new UnauthorizedError('Unauthorized access');
    }

    if (!orgId) {
      throw new UnauthorizedError('OrganizationId not found');
    }
    try {
      const res = await fn({
        userId,
        orgId,
        getCurrentUser: () => getCurrentUser(authObj, clerk),
        getCurrentOrg: () => getCurrentOrg(authObj, clerk),
        args,
      });
      return { data: res, error: undefined };
    } catch (error) {
      throw error;
    }
  };
}

export type AuthApiWrapperContext<P, Q, B> = BaseAuthWrapper & { query: Q; params: P; body: B };
export type AuthApiWrapped<P, Q, B, R> = (ctx: AuthApiWrapperContext<P, Q, B>) => Promise<NextResponse<R>>;
export type AuthApi<P, R> = (request: NextRequest, { params }: { params?: Promise<P> }) => Promise<NextResponse<R>>;

export function withUserAuthApi<P = unknown, Q = unknown, B = unknown, R = unknown>(apiFn: AuthApiWrapped<P, Q, B, R>): AuthApi<P, R> {
  return async (request: NextRequest, { params }: { params?: Promise<P> }) => {
    const authObj = await auth();
    const clerk = await clerkClient();
    const { userId, orgId } = authObj;
    if (!userId) {
      throw new UnauthorizedError('Unauthorized access');
    }
    if (!orgId) {
      throw new UnauthorizedError('OrganizationId not found');
    }

    try {
      const ctx = {
        userId,
        orgId,
        getCurrentUser: () => getCurrentUser(authObj, clerk),
        getCurrentOrg: () => getCurrentOrg(authObj, clerk),
        query: Object.fromEntries(request.nextUrl.searchParams) as Q,
        params: (await params) || ({} as P),
        body: await request.json(),
      };
      const res = await apiFn(ctx);
      return res;
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return new NextResponse('Unauthorized', { status: 401 });
      }
      return new NextResponse('Internal Server Error: ' + (error instanceof Error ? error.message : 'Unknown error'), { status: 500 });
    }
  };
}

async function getCurrentUser(authObj: Awaited<ReturnType<typeof auth>>, clerk: Awaited<ReturnType<typeof clerkClient>>): Promise<User | null> {
  const { userId } = authObj;
  if (!userId) {
    return null;
  }

  const user = await clerk.users.getUser(userId);
  return user;
}

async function getCurrentOrg(
  authObj: Awaited<ReturnType<typeof auth>>,
  clerk: Awaited<ReturnType<typeof clerkClient>>,
): Promise<Organization | null> {
  const { orgId } = authObj;
  if (!orgId) {
    return null;
  }

  const org = await clerk.organizations.getOrganization({ organizationId: orgId });
  return org;
}
