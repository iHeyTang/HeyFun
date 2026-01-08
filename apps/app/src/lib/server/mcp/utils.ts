/**
 * MCP 工具共享辅助函数
 */

import { redis } from '@/lib/server/redis';
import type { MCPHandle } from '@/lib/server/mcp/handle';
import { getMCPRuntimeManager } from '@/lib/server/mcp/providers/base';
import { updateMCPHandleLastUsed } from '@/lib/server/mcp/handle';
import { prisma } from '@/lib/server/prisma';
import { decryptTextWithPrivateKey } from '@/lib/server/crypto';
import { mcpServerSchema } from '@/lib/shared/tools';
import type { z } from 'zod';

const MCP_HANDLE_KEY_PREFIX = 'mcp:handle:';

/**
 * 从 Redis 获取当前会话的 MCP handle
 */
export async function getMCPHandleFromState(sessionId: string, configId: string): Promise<MCPHandle | null> {
  const key = `${MCP_HANDLE_KEY_PREFIX}${sessionId}:${configId}`;
  const data = await redis.get<MCPHandle>(key);
  if (!data) {
    return null;
  }

  let handle: MCPHandle;
  if (typeof data === 'string') {
    try {
      handle = JSON.parse(data) as MCPHandle;
    } catch (error) {
      console.error(`[MCPUtils] Failed to parse MCP handle from Redis:`, error);
      return null;
    }
  } else {
    handle = data as MCPHandle;
  }

  return handle;
}

/**
 * 保存 MCP handle 到 Redis
 * TTL 设置为 24 小时
 */
export async function saveMCPHandleToState(sessionId: string, handle: MCPHandle): Promise<void> {
  const key = `${MCP_HANDLE_KEY_PREFIX}${sessionId}:${handle.configId}`;
  const ttl = 24 * 60 * 60; // 24 小时
  await redis.set(key, JSON.stringify(handle), { ex: ttl });
}

/**
 * 从 Redis 删除 MCP handle
 */
export async function deleteMCPHandleFromState(sessionId: string, configId: string): Promise<void> {
  const key = `${MCP_HANDLE_KEY_PREFIX}${sessionId}:${configId}`;
  await redis.del(key);
}

/**
 * 确保 MCP 连接存在，如果不存在则自动创建
 */
export async function ensureMCP(
  sessionId: string,
  organizationId: string,
  configId: string,
): Promise<MCPHandle> {
  // 检查是否已有连接，如果存在且状态正常，直接复用
  const existingHandle = await getMCPHandleFromState(sessionId, configId);
  if (existingHandle && existingHandle.status === 'ready') {
    // 更新最后使用时间并保存
    const updatedHandle = updateMCPHandleLastUsed(existingHandle);
    await saveMCPHandleToState(sessionId, updatedHandle);
    return updatedHandle;
  }

  // 从数据库获取配置
  const configRecord = await prisma.mcpServerConfigs.findUnique({
    where: { id: configId },
  });

  if (!configRecord || configRecord.organizationId !== organizationId) {
    throw new Error(`MCP config not found: ${configId}`);
  }

  // 解密配置
  const decryptedConfig = decryptTextWithPrivateKey(configRecord.encryptedConfig);
  const config = mcpServerSchema.parse(JSON.parse(decryptedConfig)) as z.infer<typeof mcpServerSchema>;

  // 确定传输类型
  // 注意：mcpServerSchema 已经验证了要么有 url 要么有 command
  let transportType: 'streamable' | 'sse' | 'stdio';
  if (config.url) {
    // 根据 URL 判断是 streamable 还是 sse
    // 可以通过配置指定，或者默认使用 streamable
    // 这里先默认使用 streamable，后续可以根据需要扩展
    transportType = 'streamable';
  } else if (config.command) {
    transportType = 'stdio';
  } else {
    throw new Error('Invalid MCP config: either url or command must be provided');
  }

  // 构建 MCP 配置
  const mcpConfig = {
    type: transportType,
    url: config.url,
    command: config.command,
    args: config.args,
    env: config.env,
    headers: config.headers,
    query: config.query,
  };

  // 创建 MCP 连接
  const mrm = getMCPRuntimeManager();
  const handle = await mrm.create(configId, mcpConfig, sessionId, organizationId);

  // 保存到 state
  await saveMCPHandleToState(sessionId, handle);

  return handle;
}

/**
 * 获取组织所有已配置的 MCP
 */
export async function getOrganizationMCPs(organizationId: string): Promise<Array<{ id: string; name: string }>> {
  const configs = await prisma.mcpServerConfigs.findMany({
    where: { organizationId },
    select: { id: true, name: true },
  });

  return configs;
}
