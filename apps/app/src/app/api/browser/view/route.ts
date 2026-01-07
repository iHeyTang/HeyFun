/**
 * Browser View API
 * 获取浏览器视图（通过截图或 CDP）
 * 用于前端实时显示浏览器界面
 */

import { withUserAuthApi } from '@/lib/server/auth-wrapper';
import { getBrowserHandleFromState } from '@/agents/tools/browser/utils';
import { getBrowserRuntimeManager } from '@/lib/server/browser';
import { NextResponse } from 'next/server';

/**
 * 获取浏览器截图（用于实时显示）
 */
export const GET = withUserAuthApi<{}, { sessionId?: string }, {}>(async (request, ctx) => {
  try {
    const sessionId = ctx.query.sessionId;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // 获取浏览器 handle
    const browserHandle = await getBrowserHandleFromState(sessionId);
    if (!browserHandle) {
      return NextResponse.json({ error: 'Browser not found for this session' }, { status: 404 });
    }

    // 获取浏览器截图
    const brm = getBrowserRuntimeManager();
    const result = await brm.screenshot(browserHandle, {
      fullPage: false,
      format: 'png',
      sessionId,
      organizationId: ctx.orgId, // 添加 organizationId 用于文件上传
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to capture screenshot' }, { status: 500 });
    }

    // 返回截图（base64）
    return NextResponse.json({
      success: true,
      data: {
        screenshot: result.data?.screenshot,
        format: result.data?.format || 'png',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[BrowserViewAPI] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
});

