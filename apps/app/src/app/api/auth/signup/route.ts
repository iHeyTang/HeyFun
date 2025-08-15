import { auth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { name, email, password } = await request.json();
  const data = await auth.api.signUpEmail({ body: { name, email, password } });
  const organization = await prisma.organizations.create({
    data: { name: 'Personal', ownerId: data.user.id, personal: true },
  });
  await prisma.organizationUsers.create({
    data: { organizationId: organization.id, userId: data.user.id },
  });
  return NextResponse.json({ user: data.user });
}
