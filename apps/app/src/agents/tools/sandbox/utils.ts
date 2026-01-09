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
 * 确保 sandbox 存在，如果不存在则自动创建，并等待其就绪
 * 这是工具内部使用的辅助函数，用于自动初始化 sandbox
 * 如果 sandbox 状态为 creating，会等待其变为 ready
 */
export async function ensureSandbox(sessionId: string): Promise<SandboxHandle> {
  // 检查是否已有 sandbox
  let handle = await getSandboxHandleFromState(sessionId);

  if (handle && handle.status !== 'expired') {
    // 如果状态是 creating，需要等待其变为 ready
    if (handle.status === 'creating') {
      console.log(`[SandboxUtils] Sandbox ${handle.id} is still creating, waiting for ready...`);
      const srm = getSandboxRuntimeManager();
      // 通过 srm.get() 获取实例，这会等待 sandbox 启动完成
      const instance = await srm.get(handle);
      // 更新 handle（状态已变为 ready）
      handle = instance.handle;
      await saveSandboxHandleToState(sessionId, handle);
    } else {
      // 已就绪，更新最后使用时间
      const updatedHandle = updateSandboxHandleLastUsed(handle);
      await saveSandboxHandleToState(sessionId, updatedHandle);
      return updatedHandle;
    }
  } else {
    // 不存在或已过期，创建新的 sandbox（等待完成）
    const srm = getSandboxRuntimeManager();
    handle = await srm.create(
      {
        ports: [],
        idleTimeout: 300, // 5 分钟 idle 超时
      },
      true,
    ); // 等待启动完成

    // 保存到 state
    await saveSandboxHandleToState(sessionId, handle);
  }

  return handle;
}
