import { NextResponse } from 'next/server';
import { auth } from '@/lib/server/auth';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    console.log('email', email);
    const data = await auth.api.signInEmail({ body: { email, password } });
    return NextResponse.json({ token: data.token });
  } catch (error) {
    console.error('Signin error:', error);
    return NextResponse.json({ error: 'Signin failed' }, { status: 500 });
  }
}
