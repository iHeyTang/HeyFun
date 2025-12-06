import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';

/**
 * GET /api/auth/cookies
 * 获取当前登录用户的认证 cookies
 * 用于 Electron 应用等外部应用获取认证信息
 *
 * 注意：此端点仅返回必要的认证 cookies，不包含敏感信息
 */
export async function GET(request: NextRequest) {
  try {
    const authObj = await auth();
    const { userId } = authObj;

    // 检查用户是否已登录
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 获取所有 cookies
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();

    // 筛选出 Clerk 相关的认证 cookies
    const authCookies = allCookies
      .filter(cookie => {
        const name = cookie.name.toLowerCase();
        // 只返回 Clerk 相关的认证 cookies
        return name.includes('__session') || name.includes('__clerk') || name.includes('session');
      })
      .map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        // 可以添加其他属性如 domain, path, secure 等
      }));

    // 如果没有找到认证 cookies，返回错误
    if (authCookies.length === 0) {
      return NextResponse.json({ error: 'No authentication cookies found' }, { status: 404 });
    }

    // 返回 cookies（格式化为 cookie 字符串，方便 Electron 应用直接使用）
    const cookieString = authCookies.map(c => `${c.name}=${c.value}`).join('; ');

    return NextResponse.json({
      cookies: authCookies,
      cookieString, // 格式化的 cookie 字符串，可以直接用于 HTTP 请求
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7天后过期
    });
  } catch (error) {
    console.error('Error fetching auth cookies:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
