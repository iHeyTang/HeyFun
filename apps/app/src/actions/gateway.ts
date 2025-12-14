'use server';

import { withUserAuth } from '@/lib/server/auth-wrapper';
import { encryptTextWithPublicKey } from '@/lib/server/crypto';
import { getModels } from '@/lib/server/gateway';
import { prisma } from '@/lib/server/prisma';
import crypto from 'crypto';

/**
 * 生成API密钥
 */
function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(32);
  return `sk-${randomBytes.toString('hex')}`;
}

/**
 * 获取API密钥列表
 */
export const getApiKeys = withUserAuth('gateway/getApiKeys', async ({ orgId }) => {
  const keys = await prisma.gatewayApiKeys.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      isActive: true,
      rateLimit: true,
      lastUsedAt: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return keys;
});

/**
 * 创建API密钥
 */
export const createApiKey = withUserAuth(
  'gateway/createApiKey',
  async ({ orgId, args }: { orgId: string; args: { name: string; description?: string; rateLimit?: number } }) => {
    const apiKey = generateApiKey();
    const keyPrefix = apiKey.substring(0, 20);
    const encryptedKey = encryptTextWithPublicKey(apiKey);

    const keyRecord = await prisma.gatewayApiKeys.create({
      data: {
        organizationId: orgId,
        name: args.name,
        keyPrefix,
        encryptedKey,
        rateLimit: args.rateLimit,
        description: args.description,
      },
    });

    // 返回完整密钥（仅此一次）
    return {
      id: keyRecord.id,
      name: keyRecord.name,
      key: apiKey, // 完整密钥，仅返回一次
      keyPrefix: keyRecord.keyPrefix,
      createdAt: keyRecord.createdAt,
    };
  },
);

/**
 * 更新API密钥
 */
export const updateApiKey = withUserAuth(
  'gateway/updateApiKey',
  async ({
    orgId,
    args,
  }: {
    orgId: string;
    args: { id: string; name?: string; description?: string; isActive?: boolean; rateLimit?: number | null };
  }) => {
    // 验证密钥属于该组织
    const existingKey = await prisma.gatewayApiKeys.findFirst({
      where: { id: args.id, organizationId: orgId },
    });

    if (!existingKey) {
      throw new Error('API key not found');
    }

    const updatedKey = await prisma.gatewayApiKeys.update({
      where: { id: args.id },
      data: {
        name: args.name,
        description: args.description,
        isActive: args.isActive,
        rateLimit: args.rateLimit,
      },
    });

    return updatedKey;
  },
);

/**
 * 删除API密钥
 */
export const deleteApiKey = withUserAuth('gateway/deleteApiKey', async ({ orgId, args }: { orgId: string; args: { id: string } }) => {
  // 验证密钥属于该组织
  const existingKey = await prisma.gatewayApiKeys.findFirst({
    where: { id: args.id, organizationId: orgId },
  });

  if (!existingKey) {
    throw new Error('API key not found');
  }

  await prisma.gatewayApiKeys.delete({
    where: { id: args.id },
  });

  return { success: true };
});

/**
 * 获取使用量统计
 */
export const getUsageStats = withUserAuth(
  'gateway/getUsageStats',
  async ({
    orgId,
    args,
  }: {
    orgId: string;
    args: {
      apiKeyId?: string;
      startDate?: Date;
      endDate?: Date;
      modelId?: string;
    };
  }) => {
    const where: any = {
      organizationId: orgId,
    };

    if (args.apiKeyId) {
      where.apiKeyId = args.apiKeyId;
    }

    if (args.startDate || args.endDate) {
      where.createdAt = {};
      if (args.startDate) {
        where.createdAt.gte = args.startDate;
      }
      if (args.endDate) {
        where.createdAt.lte = args.endDate;
      }
    }

    if (args.modelId) {
      where.modelId = args.modelId;
    }

    const records = await prisma.gatewayUsageRecords.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 1000, // 限制返回数量
    });

    // 计算统计信息
    const totalRequests = records.length;
    const totalInputTokens = records.reduce((sum, r) => sum + r.inputTokens, 0);
    const totalOutputTokens = records.reduce((sum, r) => sum + r.outputTokens, 0);
    const totalTokens = records.reduce((sum, r) => sum + r.totalTokens, 0);
    const errorCount = records.filter(r => r.statusCode && r.statusCode >= 400).length;

    // 按模型分组统计
    const modelStats = records.reduce(
      (acc, r) => {
        if (!acc[r.modelId]) {
          acc[r.modelId] = {
            modelId: r.modelId,
            requests: 0,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            errors: 0,
          };
        }
        acc[r.modelId]!.requests++;
        acc[r.modelId]!.inputTokens += r.inputTokens;
        acc[r.modelId]!.outputTokens += r.outputTokens;
        acc[r.modelId]!.totalTokens += r.totalTokens;
        if (r.statusCode && r.statusCode >= 400) {
          acc[r.modelId]!.errors++;
        }
        return acc;
      },
      {} as Record<string, { modelId: string; requests: number; inputTokens: number; outputTokens: number; totalTokens: number; errors: number }>,
    );

    return {
      totalRequests,
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      errorCount,
      modelStats: Object.values(modelStats),
      records: records.slice(0, 100), // 只返回最近100条记录
    };
  },
);

/**
 * 获取调用记录列表（带分页）
 */
export const getUsageRecords = withUserAuth(
  'gateway/getUsageRecords',
  async ({
    orgId,
    args,
  }: {
    orgId: string;
    args: {
      apiKeyId?: string;
      startDate?: Date;
      endDate?: Date;
      modelId?: string;
      page?: number;
      pageSize?: number;
    };
  }) => {
    const page = args.page || 1;
    const pageSize = args.pageSize || 50;
    const skip = (page - 1) * pageSize;

    const where: any = {
      organizationId: orgId,
    };

    if (args.apiKeyId) {
      where.apiKeyId = args.apiKeyId;
    }

    if (args.startDate || args.endDate) {
      where.createdAt = {};
      if (args.startDate) {
        where.createdAt.gte = args.startDate;
      }
      if (args.endDate) {
        where.createdAt.lte = args.endDate;
      }
    }

    if (args.modelId) {
      where.modelId = args.modelId;
    }

    console.log('[getUsageRecords] Query params:', { orgId, where, page, pageSize });

    const [records, total] = await Promise.all([
      prisma.gatewayUsageRecords.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.gatewayUsageRecords.count({ where }),
    ]);

    console.log('[getUsageRecords] Found records:', { count: records.length, total });

    return {
      records,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  },
);

/**
 * 获取模型列表（从数据库加载）
 */
export const getModelList = withUserAuth('gateway/getModelList', async () => {
  const models = await getModels();
  return models;
});
