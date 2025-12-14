'use server';

import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';

export const getCredit = withUserAuth('credit/getCredit', async ({ orgId }: AuthWrapperContext<{}>) => {
  const credit = await prisma.credit.findUnique({ where: { organizationId: orgId } });
  return credit?.amount || 0;
});
