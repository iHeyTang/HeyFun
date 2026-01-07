/**
 * Browser Interact API
 * 处理用户与浏览器的交互操作（点击、输入、滚动等）
 */

import { withUserAuthApi } from '@/lib/server/auth-wrapper';
import { getBrowserHandleFromState } from '@/agents/tools/browser/utils';
import { getBrowserRuntimeManager } from '@/lib/server/browser';
import { NextResponse } from 'next/server';

interface BrowserInteractRequest {
  sessionId: string;
  action: 'click' | 'type' | 'scroll' | 'keypress';
  selector?: string;
  text?: string;
  x?: number;
  y?: number;
  deltaX?: number;
  deltaY?: number;
  key?: string;
}

export const POST = withUserAuthApi<{}, {}, BrowserInteractRequest>(async (request, ctx) => {
  try {
    const { sessionId, action, selector, text, x, y, deltaX, deltaY, key } = ctx.body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // 获取浏览器 handle
    const browserHandle = await getBrowserHandleFromState(sessionId);
    if (!browserHandle) {
      return NextResponse.json({ error: 'Browser not found for this session' }, { status: 404 });
    }

    const brm = getBrowserRuntimeManager();
    let result;

    switch (action) {
      case 'click':
        if (selector) {
          result = await brm.click(browserHandle, selector, { sessionId });
        } else if (x !== undefined && y !== undefined) {
          result = await brm.clickAt(browserHandle, x, y, { sessionId });
        } else {
          return NextResponse.json({ error: 'Selector or x,y coordinates required for click' }, { status: 400 });
        }
        break;

      case 'type':
        if (!selector || !text) {
          return NextResponse.json({ error: 'Selector and text required for type' }, { status: 400 });
        }
        result = await brm.type(browserHandle, selector, text, { sessionId });
        break;

      case 'scroll':
        if (deltaX === undefined || deltaY === undefined) {
          return NextResponse.json({ error: 'deltaX and deltaY required for scroll' }, { status: 400 });
        }
        result = await brm.scroll(browserHandle, deltaX, deltaY, { sessionId });
        break;

      case 'keypress':
        // 按键需要通过 CDP 实现
        result = {
          success: false,
          error: 'Keypress action not yet implemented via CDP',
        };
        break;

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Interaction failed' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('[BrowserInteractAPI] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
});

