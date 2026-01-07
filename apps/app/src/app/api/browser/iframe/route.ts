/**
 * Browser Iframe API
 * 获取浏览器实例的 iframe URL，用于在前端显示浏览器界面
 */

import { withUserAuthApi } from '@/lib/server/auth-wrapper';
import { getBrowserHandleFromState } from '@/agents/tools/browser/utils';
import { NextResponse } from 'next/server';

interface BrowserIframeRequest {
  sessionId: string;
}

export const GET = withUserAuthApi<{}, { sessionId?: string }, {}>(async (request, ctx) => {
  try {
    const sessionId = ctx.query.sessionId;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // 获取浏览器 handle
    const handle = await getBrowserHandleFromState(sessionId);

    if (!handle) {
      return NextResponse.json({ error: 'Browser not found for this session' }, { status: 404 });
    }

    if (!handle.wsEndpoint) {
      return NextResponse.json({ error: 'Browser WebSocket endpoint not available' }, { status: 404 });
    }

    // 返回浏览器 iframe URL
    // 前端可以通过这个 URL 在 iframe 中显示浏览器界面
    // 实际实现中，可能需要通过代理服务器将 WebSocket 转换为 HTTP
    const iframeUrl = handle.wsEndpoint
      ? `/api/browser/proxy?sessionId=${sessionId}`
      : null;

    return NextResponse.json({
      success: true,
      data: {
        sessionId,
        iframeUrl,
        debugPort: handle.debugPort,
        currentUrl: handle.currentUrl,
        status: handle.status,
      },
    });
  } catch (error) {
    console.error('[BrowserIframeAPI] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
});

