/**
 * Sandbox 工具共享辅助函数
 */

import { redis } from '@/lib/server/redis';
import type { SandboxHandle, SandboxCostProfile } from '@/lib/server/sandbox/handle';
import { getSandboxRuntimeManager } from '@/lib/server/sandbox';
import { updateSandboxHandleLastUsed } from '@/lib/server/sandbox/handle';

const SANDBOX_HANDLE_KEY_PREFIX = 'sandbox:handle:';

/**
 * 从 Redis 获取当前会话的 sandbox handle
 * Agent 无需关心 sandbox_id，框架通过 sessionId 自动管理
 */
export async function getSandboxHandleFromState(sessionId: string): Promise<SandboxHandle | null> {
  const key = `${SANDBOX_HANDLE_KEY_PREFIX}${sessionId}`;
  const data = await redis.get<SandboxHandle>(key);
  if (!data) {
    return null;
  }

  // Upstash Redis 会自动解析 JSON，所以 data 可能已经是对象，也可能是字符串
  // 需要处理两种情况
  let handle: SandboxHandle;
  if (typeof data === 'string') {
    try {
      handle = JSON.parse(data) as SandboxHandle;
    } catch (error) {
      console.error(`[SandboxUtils] Failed to parse sandbox handle from Redis:`, error);
      return null;
    }
  } else {
    handle = data as SandboxHandle;
  }

  return handle;
}

/**
 * 保存 sandbox handle 到 Redis
 * TTL 设置为 24 小时
 */
export async function saveSandboxHandleToState(sessionId: string, handle: SandboxHandle): Promise<void> {
  const key = `${SANDBOX_HANDLE_KEY_PREFIX}${sessionId}`;
  const ttl = 24 * 60 * 60; // 24 小时
  await redis.set(key, JSON.stringify(handle), { ex: ttl });
}

/**
 * 从 Redis 删除 sandbox handle
 */
export async function deleteSandboxHandleFromState(sessionId: string): Promise<void> {
  const key = `${SANDBOX_HANDLE_KEY_PREFIX}${sessionId}`;
  await redis.del(key);
}

/**
 * 确保 sandbox 存在，如果不存在则自动创建
 * 这是工具内部使用的辅助函数，用于自动初始化 sandbox
 */
export async function ensureSandbox(sessionId: string): Promise<SandboxHandle> {
  // 检查是否已有 sandbox，如果存在且状态正常，直接复用
  const existingHandle = await getSandboxHandleFromState(sessionId);
  if (existingHandle && existingHandle.status !== 'expired') {
    // 更新最后使用时间并保存
    const updatedHandle = updateSandboxHandleLastUsed(existingHandle);
    await saveSandboxHandleToState(sessionId, updatedHandle);
    return updatedHandle;
  }

  // 不存在或已过期，创建新的 sandbox
  const srm = getSandboxRuntimeManager();
  const handle = await srm.create();

  // 保存到 state
  await saveSandboxHandleToState(sessionId, handle);
  return handle;
}
