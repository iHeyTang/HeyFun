import { auth, currentUser } from '@clerk/nextjs/server';
import { SignJWT } from 'jose';
import { NextResponse } from 'next/server';

const SECRET = new TextEncoder().encode(process.env.DESKTOP_AUTH_SECRET || process.env.CLERK_SECRET_KEY || 'default-secret-key');

export async function POST() {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 生成自定义的长期 token（7 天有效）
  const token = await new SignJWT({
    sub: userId,
    email: user.primaryEmailAddress?.emailAddress,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);

  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

  return NextResponse.json({ token, expiresAt });
}

