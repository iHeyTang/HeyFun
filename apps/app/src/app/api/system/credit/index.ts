import { prisma } from '@/lib/server/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const POST = async (request: NextRequest) => {
  const header = request.headers;
  const authHeader = header.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${process.env.SYSTEM_API_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { orgId, amount } = (await request.json()) as { orgId: string; amount: number };

  await prisma.$transaction(async tx => {
    const credit = await tx.credit.findUnique({
      where: { organizationId: orgId },
    });

    if (!credit) {
      await tx.credit.create({
        data: { organizationId: orgId, amount },
      });
    } else {
      await tx.credit.update({
        where: { organizationId: orgId },
        data: { amount: credit.amount + amount },
      });
    }
  });

  return NextResponse.json({ success: true });
};
