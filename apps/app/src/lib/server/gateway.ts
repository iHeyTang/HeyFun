import { prisma } from './prisma';
import { decryptTextWithPrivateKey } from './crypto';
import CHAT from '@repo/llm/chat';
import { auth } from '@clerk/nextjs/server';

/**
 * 验证Gateway API密钥
 */
export async function verifyGatewayApiKey(apiKey: string): Promise<{ organizationId: string; apiKeyId: string } | null> {
  // API密钥格式: sk-{prefix}-{random}
  if (!apiKey.startsWith('sk-')) {
    return null;
  }

  const keyPrefix = apiKey.substring(0, 20); // 取前20个字符作为前缀

  const apiKeyRecord = await prisma.gatewayApiKeys.findFirst({
    where: {
      keyPrefix: {
        startsWith: keyPrefix,
      },
      isActive: true,
    },
  });

  if (!apiKeyRecord) {
    return null;
  }

  // 解密并验证完整密钥
  try {
    const decryptedKey = decryptTextWithPrivateKey(apiKeyRecord.encryptedKey);
    if (decryptedKey !== apiKey) {
      return null;
    }
  } catch (error) {
    console.error('Failed to decrypt API key:', error);
    return null;
  }

  // 更新最后使用时间
  await prisma.gatewayApiKeys.update({
    where: { id: apiKeyRecord.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    organizationId: apiKeyRecord.organizationId,
    apiKeyId: apiKeyRecord.id,
  };
}

/**
 * 记录Gateway使用量
 * apiKeyId 为可选，如果为 null 则不记录使用量（用于 Clerk 鉴权模式）
 */
export async function recordGatewayUsage(params: {
  organizationId: string;
  apiKeyId: string | null;
  modelId: string;
  endpoint: string;
  method: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  statusCode?: number;
  responseTime?: number;
  errorMessage?: string;
  ipAddress?: string;
}) {
  // 如果没有 apiKeyId，则不记录使用量（Clerk 鉴权模式）
  if (!params.apiKeyId) {
    return;
  }

  try {
    await prisma.gatewayUsageRecords.create({
      data: {
        organizationId: params.organizationId,
        apiKeyId: params.apiKeyId,
        modelId: params.modelId,
        endpoint: params.endpoint,
        method: params.method,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        totalTokens: params.totalTokens,
        statusCode: params.statusCode,
        responseTime: params.responseTime,
        errorMessage: params.errorMessage,
        ipAddress: params.ipAddress,
      },
    });
  } catch (error) {
    console.error('Failed to record gateway usage:', error);
    // 不抛出错误，避免影响主流程
  }
}

/**
 * 验证 Gateway 鉴权（支持两种模式：API Key 或 Clerk 用户鉴权）
 * @returns 返回 organizationId 和可选的 apiKeyId
 */
export async function verifyGatewayAuth(authHeader: string | null): Promise<{ organizationId: string; apiKeyId: string | null } | null> {
  // 模式1: 如果提供了 Authorization header，优先尝试使用 API Key 鉴权
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const apiKey = authHeader.substring(7);
    const keyInfo = await verifyGatewayApiKey(apiKey);
    if (keyInfo) {
      return {
        organizationId: keyInfo.organizationId,
        apiKeyId: keyInfo.apiKeyId,
      };
    }
    // 如果提供了 API Key 但验证失败，不尝试 Clerk 鉴权（安全考虑）
    return null;
  }

  // 模式2: 如果没有提供 Authorization header，尝试使用 Clerk 用户鉴权
  try {
    const authObj = await auth();
    const { orgId } = authObj;
    if (orgId) {
      return {
        organizationId: orgId,
        apiKeyId: null, // Clerk 鉴权模式没有 apiKeyId
      };
    }
  } catch (error) {
    // Clerk 鉴权失败，忽略错误
  }

  return null;
}

/**
 * 获取组织的模型配置映射
 */
export async function getModelConfigsMap(organizationId: string) {
  const modelConfigs = await prisma.gatewayModelConfigs.findMany({
    where: { organizationId },
  });

  return new Map(
    modelConfigs.map(
      (c: { modelId: string; isVisible: boolean; isEnabled: boolean; customConfig: any; rateLimit: number | null; maxTokens: number | null }) => [
        c.modelId,
        c,
      ],
    ),
  );
}

/**
 * 获取组织的可用模型列表（考虑模型配置）
 */
export async function getAvailableModels(_organizationId: string) {
  const allModels = CHAT.getModels();
  return allModels;
}
