import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import { nextCookies } from 'better-auth/next-js';
import { headers } from 'next/headers';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

export async function verifyToken(): Promise<AuthUser> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error('Invalid token');
  }
  return session.user;
}

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
  },
  database: new Pool({
    connectionString: process.env.BETTER_AUTH_DATABASE_URL,
  }),
  plugins: [nextCookies()],
});
