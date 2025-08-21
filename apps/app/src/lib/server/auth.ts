import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import { nextCookies } from 'better-auth/next-js';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
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
