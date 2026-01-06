'use server';

import { AuthWrapperContext, withUserAuth } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';
import { AssetManager, type AssetType } from '@/lib/server/asset-manager';

/**
 * Assets Actions
 * 管理 agent session 产出的素材
 */

// 获取 session 的所有素材
export const getSessionAssets = withUserAuth(
  'assets/getSessionAssets',
  async ({
    orgId,
    args,
  }: AuthWrapperContext<{
    sessionId: string;
    sessionType?: 'chat' | 'flowcanvas';
    type?: AssetType;
    page?: number;
    pageSize?: number;
  }>) => {
    const { sessionId, sessionType, type, page = 1, pageSize = 20 } = args;

    try {
      const where: any = {
        organizationId: orgId,
        sessionId,
        deletedAt: null,
      };

      if (sessionType) {
        where.sessionType = sessionType;
      }

      if (type) {
        where.type = type;
      }

      const [assets, total] = await Promise.all([
        prisma.assets.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.assets.count({ where }),
      ]);

      return {
        assets,
        total,
        page,
        pageSize,
      };
    } catch (error) {
      console.error('Error getting session assets:', error);
      throw error;
    }
  },
);

// 获取用户的所有素材
export const getUserAssets = withUserAuth(
  'assets/getUserAssets',
  async ({
    orgId,
    args,
  }: AuthWrapperContext<{
    type?: AssetType;
    sessionId?: string;
    page?: number;
    pageSize?: number;
  }>) => {
    const { type, sessionId, page = 1, pageSize = 20 } = args;

    try {
      const where: any = {
        organizationId: orgId,
        deletedAt: null,
      };

      if (type) {
        where.type = type;
      }

      if (sessionId) {
        where.sessionId = sessionId;
      }

      const [assets, total] = await Promise.all([
        prisma.assets.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.assets.count({ where }),
      ]);

      return {
        assets,
        total,
        page,
        pageSize,
      };
    } catch (error) {
      console.error('Error getting user assets:', error);
      throw error;
    }
  },
);

// 获取单个素材详情
export const getAsset = withUserAuth(
  'assets/getAsset',
  async ({ orgId, args }: AuthWrapperContext<{ assetId: string }>) => {
    const { assetId } = args;

    try {
      const asset = await prisma.assets.findFirst({
        where: {
          id: assetId,
          organizationId: orgId,
          deletedAt: null,
        },
      });

      if (!asset) {
        throw new Error('Asset not found');
      }

      return asset;
    } catch (error) {
      console.error('Error getting asset:', error);
      throw error;
    }
  },
);

// 更新素材元数据
export const updateAsset = withUserAuth(
  'assets/updateAsset',
  async ({
    orgId,
    args,
  }: AuthWrapperContext<{
    assetId: string;
    title?: string;
    description?: string;
    tags?: string[];
  }>) => {
    const { assetId, title, description, tags } = args;

    try {
      // 验证素材存在且属于该组织
      const existing = await prisma.assets.findFirst({
        where: {
          id: assetId,
          organizationId: orgId,
          deletedAt: null,
        },
      });

      if (!existing) {
        throw new Error('Asset not found');
      }

      const asset = await prisma.assets.update({
        where: { id: assetId },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(tags !== undefined && { tags }),
        },
      });

      return asset;
    } catch (error) {
      console.error('Error updating asset:', error);
      throw error;
    }
  },
);

// 删除素材（软删除）
export const deleteAsset = withUserAuth(
  'assets/deleteAsset',
  async ({ orgId, args }: AuthWrapperContext<{ assetId: string }>) => {
    const { assetId } = args;

    try {
      // 验证素材存在且属于该组织
      const existing = await prisma.assets.findFirst({
        where: {
          id: assetId,
          organizationId: orgId,
          deletedAt: null,
        },
      });

      if (!existing) {
        throw new Error('Asset not found');
      }

      const asset = await prisma.assets.update({
        where: { id: assetId },
        data: {
          deletedAt: new Date(),
        },
      });

      return asset;
    } catch (error) {
      console.error('Error deleting asset:', error);
      throw error;
    }
  },
);

// 永久删除素材（从数据库和 OSS 中删除）
export const permanentlyDeleteAsset = withUserAuth(
  'assets/permanentlyDeleteAsset',
  async ({ orgId, args }: AuthWrapperContext<{ assetId: string }>) => {
    const { assetId } = args;

    try {
      // 验证素材存在且属于该组织
      const existing = await prisma.assets.findFirst({
        where: {
          id: assetId,
          organizationId: orgId,
        },
      });

      if (!existing) {
        throw new Error('Asset not found');
      }

      // 从 OSS 删除文件
      const storage = (await import('@/lib/server/storage')).default;
      try {
        await storage.delete(existing.fileKey);
      } catch (error) {
        console.error('Error deleting file from OSS:', error);
        // 即使 OSS 删除失败，也继续删除数据库记录
      }

      // 从数据库删除记录
      await prisma.assets.delete({
        where: { id: assetId },
      });

      return { success: true };
    } catch (error) {
      console.error('Error permanently deleting asset:', error);
      throw error;
    }
  },
);

