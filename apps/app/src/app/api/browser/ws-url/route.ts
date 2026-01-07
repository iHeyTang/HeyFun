/**
 * Browser WebSocket URL API
 * 获取浏览器 CDP WebSocket 连接 URL（外部可访问）
 * 将 sandbox 内部的 ws://localhost:port 转换为外部可访问的 WebSocket URL
 */

import { withUserAuthApi } from '@/lib/server/auth-wrapper';
import { getBrowserHandleFromState } from '@/agents/tools/browser/utils';
import { getSandboxHandleFromState } from '@/agents/tools/sandbox/utils';
import { getSandboxRuntimeManager } from '@/lib/server/sandbox';
import { NextResponse } from 'next/server';

/**
 * 获取浏览器 WebSocket URL（外部可访问）
 */
export const GET = withUserAuthApi<{}, { sessionId?: string }, {}>(async (request, ctx) => {
  try {
    const sessionId = ctx.query.sessionId;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // 获取浏览器 handle
    const browserHandle = await getBrowserHandleFromState(sessionId);
    if (!browserHandle || !browserHandle.wsEndpoint) {
      return NextResponse.json({ error: 'Browser not found or WebSocket endpoint not available' }, { status: 404 });
    }

    // 获取 sandbox handle（用于获取 previewUrl）
    let sandboxHandle = await getSandboxHandleFromState(sessionId);
    if (!sandboxHandle) {
      return NextResponse.json({ error: 'Sandbox not found' }, { status: 404 });
    }

    // 如果 previewUrls 为空，尝试从 sandbox 重新获取
    if (!sandboxHandle.previewUrls || Object.keys(sandboxHandle.previewUrls).length === 0) {
      console.log(`[BrowserWsUrlAPI] previewUrls is empty, attempting to refresh from sandbox...`);
      try {
        const srm = getSandboxRuntimeManager();
        // 通过 srm.get() 获取 sandbox 实例，这会触发 getSandbox() 方法
        // 在 DaytonaSRM 中，getSandbox() 会自动更新 handle 的 previewUrls
        const sandboxInstance = await srm.get(sandboxHandle);
        // 更新后的 handle 在 sandboxInstance.handle 中
        if (sandboxInstance.handle.previewUrls && Object.keys(sandboxInstance.handle.previewUrls).length > 0) {
          console.log(`[BrowserWsUrlAPI] Successfully refreshed previewUrls:`, Object.keys(sandboxInstance.handle.previewUrls).length, 'ports');
          sandboxHandle = sandboxInstance.handle;
          // 更新 Redis 中的 handle（可选，但建议更新以保持一致性）
          const { saveSandboxHandleToState } = await import('@/agents/tools/sandbox/utils');
          await saveSandboxHandleToState(sessionId, sandboxHandle);
        } else {
          console.warn(`[BrowserWsUrlAPI] Still no previewUrls after refresh`);
        }
      } catch (refreshError) {
        console.error('[BrowserWsUrlAPI] Failed to refresh sandbox:', refreshError);
      }
    }

    // 解析内部的 wsEndpoint（格式：ws://localhost:port/devtools/browser/...）
    const internalWsUrl = new URL(browserHandle.wsEndpoint);
    const debugPort = browserHandle.debugPort || parseInt(internalWsUrl.port, 10);

    if (!debugPort) {
      return NextResponse.json({ error: 'Debug port not available' }, { status: 404 });
    }

    // 获取该端口对应的外部 previewUrl
    // 注意：JSON 序列化后，对象的数字键会变成字符串，所以必须用字符串访问
    const previewUrls = sandboxHandle.previewUrls as Record<string, string> | undefined;
    const previewUrl = previewUrls?.[String(debugPort)];

    // 如果找不到对应端口的 previewUrl，尝试使用回退方案
    if (!previewUrl) {
      console.log(`[BrowserWsUrlAPI] Preview URL not found for port ${debugPort}, attempting fallback...`);
      console.log(`[BrowserWsUrlAPI] Available previewUrls:`, sandboxHandle.previewUrls);

      const availablePreviewUrls = sandboxHandle.previewUrls as Record<string, string> | undefined;
      const availableKeys = availablePreviewUrls ? Object.keys(availablePreviewUrls) : [];
      if (availablePreviewUrls && availableKeys.length > 0) {
        // 使用第一个可用的 previewUrl，并假设端口映射是 1:1 的
        const firstKey = availableKeys[0]!;
        const firstPort = parseInt(firstKey, 10);
        const firstPreviewUrl = availablePreviewUrls[firstKey]!;
        console.log(`[BrowserWsUrlAPI] Using fallback previewUrl from port ${firstPort}: ${firstPreviewUrl}`);

        // 构建基于第一个 previewUrl 的 WebSocket URL
        // 假设端口映射是 1:1 的，使用 debugPort 作为端口
        const baseUrl = new URL(firstPreviewUrl);
        const protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = baseUrl.hostname;
        // 使用 debugPort 作为端口（假设 Daytona 做了端口映射）
        const wsPath = internalWsUrl.pathname;
        const externalWsUrl = `${protocol}//${host}:${debugPort}${wsPath}`;

        return NextResponse.json({
          success: true,
          data: {
            wsUrl: externalWsUrl,
            internalWsUrl: browserHandle.wsEndpoint,
            debugPort,
            previewUrl: firstPreviewUrl,
            fallback: true,
            note: `Using fallback previewUrl from port ${firstPort}, assuming port mapping is 1:1`,
          },
        });
      }

      // 如果回退方案也失败，返回错误，包含调试信息
      return NextResponse.json(
        {
          error: `Preview URL not available for port ${debugPort}`,
          hint: 'The sandbox may not have exposed this port, or previewUrls are not configured. Try using the screenshot-based view instead.',
          debug: {
            debugPort,
            availablePorts: availablePreviewUrls ? Object.keys(availablePreviewUrls).map(k => parseInt(k, 10)) : [],
            previewUrls: availablePreviewUrls,
            sandboxId: sandboxHandle.id,
            sandboxProvider: sandboxHandle.provider,
          },
        },
        { status: 404 },
      );
    }

    // 构建外部可访问的 WebSocket URL
    // 将 ws://localhost:port/path 转换为外部可访问的 WebSocket URL
    // Daytona 的 previewUrl 通常是 HTTP/HTTPS，我们需要将其转换为 WebSocket URL
    try {
      const previewUrlObj = new URL(previewUrl);
      const protocol = previewUrlObj.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = previewUrlObj.hostname;

      // 对于 Daytona，previewUrl 可能不包含端口，或者端口映射可能不同
      // 我们需要使用 debugPort 作为端口（如果 previewUrl 有端口映射）
      // 否则，尝试使用 previewUrl 的端口，或者直接使用 debugPort
      let port: string;
      if (previewUrlObj.port) {
        // 如果 previewUrl 有端口，使用它（Daytona 可能已经做了端口映射）
        port = previewUrlObj.port;
      } else {
        // 如果没有端口，使用 debugPort（假设 Daytona 已经做了端口映射）
        port = String(debugPort);
      }

      // 构建 WebSocket URL
      // 注意：Daytona 的端口映射可能不是 1:1 的，但通常 previewUrl 的端口对应 sandbox 内部的端口
      const wsPath = internalWsUrl.pathname;
      const externalWsUrl = `${protocol}//${host}:${port}${wsPath}`;

      return NextResponse.json({
        success: true,
        data: {
          wsUrl: externalWsUrl,
          internalWsUrl: browserHandle.wsEndpoint,
          debugPort,
          previewUrl,
        },
      });
    } catch (urlError) {
      console.error('[BrowserWsUrlAPI] Failed to construct external WebSocket URL:', urlError);
      return NextResponse.json(
        {
          error: 'Failed to construct external WebSocket URL',
          details: urlError instanceof Error ? urlError.message : String(urlError),
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('[BrowserWsUrlAPI] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
});
