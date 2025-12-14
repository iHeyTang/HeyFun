import { auth, clerkClient, Organization, User } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { to } from '../shared/to';
import { serverActionLogger } from './logger';

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
export function withUserAuth<T = unknown, R = unknown>(fn: AuthWrapped<T, R>): AuthAction<T, R>;
export function withUserAuth<T = unknown, R = unknown>(actionName: string, fn: AuthWrapped<T, R>): AuthAction<T, R>;
export function withUserAuth<T = unknown, R = unknown>(actionName: string | AuthWrapped<T, R>, _fn?: AuthWrapped<T, R>): AuthAction<T, R> {
  let fn: AuthWrapped<T, R>;
  if (typeof actionName === 'function') {
    fn = actionName;
    actionName = 'unknown-action';
  } else {
    fn = _fn!;
  }
  if (!fn) {
    throw new Error('Server action function not found');
  }

  const wrappedFn = async (args: T) => {
    const startTime = Date.now();
    const authObj = await auth();
    const clerk = await clerkClient();
    const { userId, orgId } = authObj;

    // 记录开始日志
    serverActionLogger.start(actionName, {
      userId,
      orgId,
      args: typeof args === 'object' && args !== null ? JSON.stringify(args).substring(0, 200) : args,
      timestamp: new Date().toISOString(),
    });

    if (!userId) {
      serverActionLogger.warn(actionName, 'Unauthorized: userId not found', { userId, orgId });
      throw new UnauthorizedError('Unauthorized access');
    }

    if (!orgId) {
      serverActionLogger.warn(actionName, 'Unauthorized: orgId not found', { userId, orgId });
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
      const duration = Date.now() - startTime;

      // 记录成功日志
      serverActionLogger.success(actionName, duration, {
        userId,
        orgId,
        timestamp: new Date().toISOString(),
      });

      return { data: res, error: undefined };
    } catch (error) {
      const duration = Date.now() - startTime;

      // 记录错误日志
      serverActionLogger.error(actionName, duration, error instanceof Error ? error : new Error('Unknown error'), {
        userId,
        orgId,
        timestamp: new Date().toISOString(),
      });

      return { data: undefined, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };

  // 保留原始函数名以便日志识别
  Object.defineProperty(wrappedFn, 'name', { value: actionName, writable: false });

  return wrappedFn;
}

export type AuthApiWrapperContext<P, Q, B> = BaseAuthWrapper & { query: Q; params: P; body: B };
export type AuthApiWrapped<P, Q, B, R> = (request: NextRequest, ctx: AuthApiWrapperContext<P, Q, B>) => Promise<NextResponse<R> | Response>;
export type AuthApi<P, R> = (request: NextRequest, { params }: { params: Promise<P> }) => Promise<NextResponse<R> | Response>;

export function withUserAuthApi<P = unknown, Q = unknown, B = unknown, R = unknown>(apiFn: AuthApiWrapped<P, Q, B, R>): AuthApi<P, R> {
  return async (request: NextRequest, { params }: { params: Promise<P> }) => {
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
        body: (await to(request.json()))[1] as B,
      };
      const res = await apiFn(request, ctx);
      return res;
    } catch (error) {
      serverActionLogger.error('API Route', 0, error instanceof Error ? error : new Error('Unknown error'), {
        path: request.nextUrl.pathname,
        method: request.method,
      });
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
