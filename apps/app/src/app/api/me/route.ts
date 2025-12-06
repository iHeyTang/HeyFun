import { withUserAuthApi } from '@/lib/server/auth-wrapper';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/me
 * 获取当前登录用户的个人信息
 * 需要认证：通过 Clerk session 或 API Key
 */
export const GET = withUserAuthApi<{}, {}, {}>(async (request: NextRequest, ctx) => {
  try {
    const user = await ctx.getCurrentUser();
    const organization = await ctx.getCurrentOrg();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 401 });
    }

    return NextResponse.json({
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress || '',
      name: user.fullName,
      organizationId: organization.id,
      organizationName: organization.name,
    });
  } catch (error) {
    console.error('Error fetching user info:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
});
