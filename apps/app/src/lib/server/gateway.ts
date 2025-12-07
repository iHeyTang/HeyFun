import { prisma } from './prisma';
import { decryptTextWithPrivateKey } from './crypto';
import { ModelRegistry, type ModelInfo } from '@repo/llm/chat';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { jwtVerify } from 'jose';
import { getDesktopAuthSecret } from './desktop-auth';

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
 * 验证桌面端 JWT token
 */
async function verifyDesktopToken(token: string): Promise<{ userId: string } | null> {
  try {
    const SECRET = getDesktopAuthSecret();
    const { payload } = await jwtVerify(token, SECRET);

    console.log('Desktop token payload:', { sub: payload.sub, email: payload.email });

    if (payload.sub && typeof payload.sub === 'string') {
      return { userId: payload.sub };
    }
  } catch (error) {
    // JWT 验证失败
    console.error('Desktop token verification failed:', error instanceof Error ? error.message : error);
  }

  return null;
}

/**
 * 通过 userId 获取用户的组织 ID
 */
async function getOrganizationIdByUserId(userId: string): Promise<string | null> {
  try {
    // 方法1: 尝试从数据库查询用户的组织（通过 OrganizationUsers 表）
    const orgUser = await prisma.organizationUsers.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' }, // 获取最早加入的组织（通常是主组织）
    });

    if (orgUser) {
      console.log('Found organization for userId:', userId, 'orgId:', orgUser.organizationId);
      return orgUser.organizationId;
    }

    console.warn('No organization found in OrganizationUsers for userId:', userId);

    // 方法2: 尝试通过 ownerId 查找用户拥有的组织
    const ownedOrg = await prisma.organizations.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
    });

    if (ownedOrg) {
      console.log('Found owned organization for userId:', userId, 'orgId:', ownedOrg.id);
      return ownedOrg.id;
    }

    console.warn('No owned organization found for userId:', userId);

    // 方法3: 如果数据库中没有，尝试通过 Clerk API 获取用户的组织列表
    try {
      const clerk = await clerkClient();

      // 获取用户的组织成员关系列表
      const organizationMemberships = await clerk.users.getOrganizationMembershipList({
        userId,
      });

      if (organizationMemberships.data && organizationMemberships.data.length > 0) {
        // 获取第一个组织的 ID（通常是主组织）
        const firstMembership = organizationMemberships.data[0];
        if (!firstMembership || !firstMembership.organization) {
          console.warn('Invalid organization membership data');
          return null;
        }

        const orgId = firstMembership.organization.id;
        const orgName = firstMembership.organization.name || 'Default Organization';
        console.log('Found organization from Clerk API for userId:', userId, 'orgId:', orgId);

        // 可选：将组织信息同步到数据库（如果不存在）
        try {
          const existingOrg = await prisma.organizations.findUnique({
            where: { id: orgId },
          });

          if (!existingOrg) {
            // 如果数据库中没有该组织，创建它
            await prisma.organizations.create({
              data: {
                id: orgId,
                name: orgName,
                ownerId: userId,
                personal: true,
              },
            });
            console.log('Created organization in database:', orgId);
          }

          // 确保 OrganizationUsers 记录存在
          const existingOrgUser = await prisma.organizationUsers.findFirst({
            where: {
              userId,
              organizationId: orgId,
            },
          });

          if (!existingOrgUser) {
            await prisma.organizationUsers.create({
              data: {
                userId,
                organizationId: orgId,
              },
            });
            console.log('Created OrganizationUsers record for userId:', userId, 'orgId:', orgId);
          }
        } catch (dbError) {
          console.error('Failed to sync organization to database:', dbError);
          // 即使数据库同步失败，也返回组织 ID
        }

        return orgId;
      }

      // 如果用户没有组织，尝试从用户元数据获取
      const user = await clerk.users.getUser(userId);
      if (user.publicMetadata?.primaryOrganizationId) {
        const orgId = user.publicMetadata.primaryOrganizationId as string;
        console.log('Found organization from user metadata:', orgId);
        return orgId;
      }

      console.warn('No organization found for userId:', userId);
    } catch (clerkError) {
      console.error('Failed to get organization from Clerk:', clerkError);
    }
  } catch (error) {
    console.error('Failed to get organization by userId:', error);
  }

  return null;
}

/**
 * 验证 Gateway 鉴权（支持三种模式：API Key、桌面端 JWT token 或 Clerk 用户鉴权）
 * @returns 返回 organizationId 和可选的 apiKeyId
 */
export async function verifyGatewayAuth(authHeader: string | null): Promise<{ organizationId: string; apiKeyId: string | null } | null> {
  console.log('verifyGatewayAuth called with authHeader:', authHeader ? `${authHeader.substring(0, 20)}...` : 'null');

  // 模式1: 如果提供了 Authorization header，优先尝试使用 API Key 鉴权
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    console.log('Token type check:', token.startsWith('sk-') ? 'API Key' : 'JWT Token');

    // 尝试作为 Gateway API Key 验证（格式: sk-{prefix}-{random}）
    if (token.startsWith('sk-')) {
      const keyInfo = await verifyGatewayApiKey(token);
      if (keyInfo) {
        console.log('API Key verification successful');
        return {
          organizationId: keyInfo.organizationId,
          apiKeyId: keyInfo.apiKeyId,
        };
      }
      console.log('API Key verification failed');
      // 如果提供了 API Key 但验证失败，不尝试其他方式（安全考虑）
      return null;
    }

    // 尝试作为桌面端 JWT token 验证
    console.log('Attempting desktop token verification...');
    const desktopTokenInfo = await verifyDesktopToken(token);
    if (desktopTokenInfo) {
      console.log('Desktop token verified, userId:', desktopTokenInfo.userId);
      const organizationId = await getOrganizationIdByUserId(desktopTokenInfo.userId);
      if (organizationId) {
        console.log('Organization ID found:', organizationId);
        return {
          organizationId,
          apiKeyId: null, // 桌面端 token 鉴权模式没有 apiKeyId
        };
      } else {
        console.error('Failed to get organization ID for userId:', desktopTokenInfo.userId);
      }
    } else {
      console.error('Desktop token verification failed');
    }

    // 如果提供了 token 但验证失败，不尝试 Clerk session 鉴权（安全考虑）
    return null;
  }

  // 模式2: 如果没有提供 Authorization header，尝试使用 Clerk 用户鉴权
  console.log('No Authorization header, trying Clerk session auth...');
  try {
    const authObj = await auth();
    const { orgId } = authObj;
    if (orgId) {
      console.log('Clerk session auth successful, orgId:', orgId);
      return {
        organizationId: orgId,
        apiKeyId: null, // Clerk 鉴权模式没有 apiKeyId
      };
    } else {
      console.log('Clerk session auth failed: no orgId');
    }
  } catch (error) {
    // Clerk 鉴权失败，忽略错误
    console.error('Clerk session auth error:', error);
  }

  console.log('All authentication methods failed');
  return null;
}

/**
 * 从数据库加载模型定义
 */
let cachedModels: ModelInfo[] | null = null;
let lastCacheTime: number = 0;
const CACHE_TTL = 60000; // 缓存 60 秒

async function getModelsFromDatabase(): Promise<ModelInfo[]> {
  const now = Date.now();

  // 如果缓存有效，直接返回
  if (cachedModels && now - lastCacheTime < CACHE_TTL) {
    return cachedModels;
  }

  // 从数据库加载模型定义
  const definitions = await (prisma as any).systemModelDefinitions.findMany({
    orderBy: { createdAt: 'asc' },
  });

  const modelInfos: ModelInfo[] = definitions.map((def: any) => ({
    id: def.modelId,
    name: def.name,
    provider: def.provider,
    family: def.family,
    type: (def.type as 'language' | 'embedding' | 'image') || undefined,
    description: def.description || undefined,
    contextLength: def.contextLength || undefined,
    supportsStreaming: def.supportsStreaming,
    supportsFunctionCalling: def.supportsFunctionCalling,
    supportsVision: def.supportsVision,
    pricing: def.pricing as ModelInfo['pricing'] | undefined,
    enabled: def.enabled,
    metadata: (def.metadata as Record<string, any>) || undefined,
  }));

  cachedModels = modelInfos;
  lastCacheTime = now;

  return modelInfos;
}

/**
 * 获取组织的可用模型列表
 */
export async function getModels() {
  // 从数据库加载模型定义
  const allModels = await getModelsFromDatabase();

  // 只返回启用的模型
  return allModels.filter(model => model.enabled);
}
