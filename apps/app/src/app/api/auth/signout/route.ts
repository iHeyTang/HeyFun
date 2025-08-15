import { NextResponse } from 'next/server';
import { auth } from '@/lib/server/auth';
import { headers } from 'next/headers';

export async function POST(request: Request) {
  try {
    await auth.api.signOut({
      headers: await headers(),
    });
  } catch (error) {
    console.error('Signout error:', error);
  } finally {
    return NextResponse.redirect(new URL('/signin', request.url));
  }
}
