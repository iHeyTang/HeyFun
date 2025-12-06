'use server';

import { withUserAuth } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';
import { encryptTextWithPublicKey } from '@/lib/server/crypto';
import { getModelConfigsMap } from '@/lib/server/gateway';
import CHAT from '@repo/llm/chat';
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
export const getApiKeys = withUserAuth(async ({ orgId }) => {
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
export const deleteApiKey = withUserAuth(async ({ orgId, args }: { orgId: string; args: { id: string } }) => {
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
 * 获取模型配置列表（返回完整模型信息 + 配置）
 */
export const getModelConfigs = withUserAuth(async ({ orgId }) => {
  const allModels = CHAT.getModels();
  const configMap = await getModelConfigsMap(orgId);

  return allModels.map(model => {
    const config = configMap.get(model.id);
    return {
      model, // 完整的模型信息
      config: {
        isEnabled: config?.isEnabled ?? true,
        isVisible: config?.isVisible ?? true,
        customConfig: config?.customConfig || null,
        rateLimit: config?.rateLimit || null,
        maxTokens: config?.maxTokens || null,
      },
    };
  });
});

/**
 * 更新模型配置
 */
export const updateModelConfig = withUserAuth(
  async ({
    orgId,
    args,
  }: {
    orgId: string;
    args: {
      modelId: string;
      isEnabled?: boolean;
      isVisible?: boolean;
      customConfig?: any;
      rateLimit?: number | null;
      maxTokens?: number | null;
    };
  }) => {
    // 验证模型存在
    const model = CHAT.getModelInfo(args.modelId);
    if (!model) {
      throw new Error('Model not found');
    }

    const config = await prisma.gatewayModelConfigs.upsert({
      where: {
        organizationId_modelId: {
          organizationId: orgId,
          modelId: args.modelId,
        },
      },
      create: {
        organizationId: orgId,
        modelId: args.modelId,
        isEnabled: args.isEnabled ?? true,
        isVisible: args.isVisible ?? true,
        customConfig: args.customConfig,
        rateLimit: args.rateLimit,
        maxTokens: args.maxTokens,
      },
      update: {
        isEnabled: args.isEnabled,
        isVisible: args.isVisible,
        customConfig: args.customConfig,
        rateLimit: args.rateLimit,
        maxTokens: args.maxTokens,
      },
    });

    return config;
  },
);
