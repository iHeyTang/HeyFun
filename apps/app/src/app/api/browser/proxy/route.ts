/**
 * Browser Proxy API
 * 代理 CDP 请求到 sandbox 中的浏览器
 * 支持 WebSocket 和 HTTP 请求
 */

import { withUserAuthApi } from '@/lib/server/auth-wrapper';
import { getBrowserHandleFromState } from '@/agents/tools/browser/utils';
import { getSandboxRuntimeManager } from '@/lib/server/sandbox';
import { getSandboxHandleFromState } from '@/agents/tools/sandbox/utils';
import { NextRequest, NextResponse } from 'next/server';

/**
 * 处理 CDP HTTP 请求（如 /json 端点）
 */
export const GET = withUserAuthApi<{}, { sessionId?: string; path?: string }, {}>(async (request, ctx) => {
  try {
    const sessionId = ctx.query.sessionId;
    const path = ctx.query.path || '';

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // 获取浏览器 handle
    const browserHandle = await getBrowserHandleFromState(sessionId);
    if (!browserHandle || !browserHandle.debugPort) {
      return NextResponse.json({ error: 'Browser not found or debug port not available' }, { status: 404 });
    }

    // 获取 sandbox handle
    const sandboxHandle = await getSandboxHandleFromState(sessionId);
    if (!sandboxHandle) {
      return NextResponse.json({ error: 'Sandbox not found' }, { status: 404 });
    }

    // 通过 sandbox 访问浏览器 CDP 端点
    // 由于浏览器在 sandbox 中运行，我们需要通过 sandbox 的网络访问
    // 这里我们使用 curl 或类似的工具来访问 localhost:debugPort
    const srm = getSandboxRuntimeManager();

    // 构建 CDP 请求 URL
    const cdpPath = path || '/json';
    const cdpUrl = `http://localhost:${browserHandle.debugPort}${cdpPath}`;

    // 在 sandbox 中执行 curl 请求
    const result = await srm.exec(sandboxHandle, `curl -s ${cdpUrl}`, {
      timeout: 10,
    });

    if (result.exitCode !== 0) {
      return NextResponse.json(
        { error: `Failed to access CDP endpoint: ${result.stderr || result.stdout}` },
        { status: 500 },
      );
    }

    // 返回 CDP 响应
    try {
      const data = JSON.parse(result.stdout);
      return NextResponse.json(data);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON response' }, { status: 500 });
    }
  } catch (error) {
    console.error('[BrowserProxyAPI] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
});

/**
 * 处理 WebSocket 升级请求（用于 CDP WebSocket 连接）
 * 注意：Next.js API Routes 不支持 WebSocket，需要使用其他方案
 * 这里返回一个说明，实际实现需要使用 WebSocket 服务器
 */
export const POST = withUserAuthApi<{}, {}, {}>(async (request, ctx) => {
  return NextResponse.json({
    message: 'WebSocket connections require a dedicated WebSocket server',
    note: 'Consider using a WebSocket server or SSE for real-time browser viewing',
  });
});

