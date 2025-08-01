import { hashPassword } from '@/lib/server/password';
import { prisma } from '@/lib/server/prisma';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const needInviteCode = process.env.NEXT_PUBLIC_NEED_INVITE_CODE === 'true';
  const { email, password, name, organizationName, inviteCode } = await request.json();

  // Verify invite code
  const invite = await prisma.inviteCodes.findFirst({
    where: { code: inviteCode, email, isUsed: false },
  });

  if (needInviteCode && !invite) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 400 });
  }

  if (needInviteCode) {
    const existingOrganization = await prisma.organizations.findUnique({
      where: { name: organizationName },
    });

    if (existingOrganization) {
      return NextResponse.json({ error: 'Organization already exists' }, { status: 400 });
    }
  }

  const existingUser = await prisma.users.findUnique({
    where: { email },
  });

  if (existingUser) {
    return NextResponse.json({ error: 'User already exists' }, { status: 400 });
  }

  // Start transaction
  const result = await prisma.$transaction(async tx => {
    // Create organization
    const organization = await tx.organizations.create({
      data: { name: organizationName },
    });

    // Create user
    const user = await tx.users.create({
      data: {
        email,
        name,
        password: hashPassword(password),
        isFirstLogin: true,
      },
    });

    // Create organization user relationship
    await tx.organizationUsers.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
      },
    });

    // Mark invite code as used
    if (needInviteCode && invite) {
      await tx.inviteCodes.update({
        where: { id: invite.id },
        data: {
          isUsed: true,
          usedAt: new Date(),
        },
      });
    }

    return { user, organization };
  });

  return NextResponse.json({ message: 'Registration successful' }, { status: 201 });
}
