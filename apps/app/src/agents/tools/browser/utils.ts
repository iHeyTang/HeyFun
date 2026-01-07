/**
 * 浏览器工具共享辅助函数
 */

import { redis } from '@/lib/server/redis';
import type { BrowserHandle } from '@/lib/server/browser/handle';
import { getBrowserRuntimeManager } from '@/lib/server/browser';
import { updateBrowserHandleLastUsed } from '@/lib/server/browser/handle';
import { ensureSandbox } from '../sandbox/utils';

const BROWSER_HANDLE_KEY_PREFIX = 'browser:handle:';

/**
 * 从 Redis 获取当前会话的 browser handle
 * Agent 无需关心 browser_id，框架通过 sessionId 自动管理
 */
export async function getBrowserHandleFromState(sessionId: string): Promise<BrowserHandle | null> {
  const key = `${BROWSER_HANDLE_KEY_PREFIX}${sessionId}`;
  const data = await redis.get<BrowserHandle>(key);
  if (!data) {
    return null;
  }

  // Upstash Redis 会自动解析 JSON，所以 data 可能已经是对象，也可能是字符串
  let handle: BrowserHandle;
  if (typeof data === 'string') {
    try {
      handle = JSON.parse(data) as BrowserHandle;
    } catch (error) {
      console.error(`[BrowserUtils] Failed to parse browser handle from Redis:`, error);
      return null;
    }
  } else {
    handle = data as BrowserHandle;
  }

  return handle;
}

/**
 * 保存 browser handle 到 Redis
 * TTL 设置为 24 小时
 */
export async function saveBrowserHandleToState(sessionId: string, handle: BrowserHandle): Promise<void> {
  const key = `${BROWSER_HANDLE_KEY_PREFIX}${sessionId}`;
  const ttl = 24 * 60 * 60; // 24 小时
  await redis.set(key, JSON.stringify(handle), { ex: ttl });
}

/**
 * 从 Redis 删除 browser handle
 */
export async function deleteBrowserHandleFromState(sessionId: string): Promise<void> {
  const key = `${BROWSER_HANDLE_KEY_PREFIX}${sessionId}`;
  await redis.del(key);
}

/**
 * 确保 browser 存在，如果不存在则自动创建
 * 这是工具内部使用的辅助函数，用于自动初始化 browser
 * Browser 在 sandbox 中运行，所以需要先确保 sandbox 存在
 */
export async function ensureBrowser(sessionId: string): Promise<BrowserHandle> {
  // 检查是否已有 browser，如果存在且状态正常，直接复用
  const existingHandle = await getBrowserHandleFromState(sessionId);
  if (existingHandle && existingHandle.status !== 'expired') {
    // 更新最后使用时间并保存
    const updatedHandle = updateBrowserHandleLastUsed(existingHandle);
    await saveBrowserHandleToState(sessionId, updatedHandle);
    return updatedHandle;
  }

  // 确保 sandbox 存在（browser 在 sandbox 中运行）
  const sandboxHandle = await ensureSandbox(sessionId);

  // 不存在或已过期，创建新的 browser（在 sandbox 中）
  const brm = getBrowserRuntimeManager();
  const handle = await brm.create(sandboxHandle.id, sessionId, {
    headless: true, // sandbox 环境中没有 X server，必须使用 headless 模式
  });

  // 保存到 state
  await saveBrowserHandleToState(sessionId, handle);
  return handle;
}
