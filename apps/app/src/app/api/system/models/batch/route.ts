import { prisma } from '@/lib/server/prisma';
import { NextRequest, NextResponse } from 'next/server';
import {
  verifySystemApiKey,
  normalizeModelInput,
  buildCreateData,
  buildUpdateData,
  validateModelInput,
  type ModelDefinitionInput,
} from '@/lib/server/model-definitions';

/**
 * POST /api/system/models/batch
 * 批量创建模型定义
 * 支持内部格式和 Vercel 格式，通过 format 参数指定（整批使用同一格式）
 * 查询参数：
 * - format: 'internal' | 'vercel' (默认 'internal')
 * - defaultProvider: 当 format='vercel' 时使用的默认 provider (默认 'vercel')
 * 请求体格式：
 * {
 *   models: [
 *     { modelId, name, provider, family, ... }, // 内部格式
 *     { id, object: "model", name, ... }, // Vercel 格式
 *     ...
 *   ]
 * }
 */
export const POST = async (request: NextRequest) => {
  const header = request.headers;
  const authHeader = header.get('Authorization');
  if (!verifySystemApiKey(authHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const searchParams = request.nextUrl.searchParams;
    const format = (searchParams.get('format') || 'internal') as 'internal' | 'vercel';
    const defaultProvider = searchParams.get('defaultProvider') || 'vercel';

    if (!body.models || !Array.isArray(body.models) || body.models.length === 0) {
      return NextResponse.json({ error: 'Missing or empty models array' }, { status: 400 });
    }

    // 限制批量操作数量
    if (body.models.length > 200) {
      return NextResponse.json({ error: 'Maximum 200 models per batch operation' }, { status: 400 });
    }

    // 转换所有模型格式（使用统一的格式）
    const normalizedModels: ModelDefinitionInput[] = [];
    for (let i = 0; i < body.models.length; i++) {
      const model = body.models[i];
      try {
        const normalized = normalizeModelInput(model, format, defaultProvider);
        const validation = validateModelInput(normalized);
        if (!validation.valid) {
          return NextResponse.json({ error: `Model at index ${i}: ${validation.error}` }, { status: 400 });
        }
        normalizedModels.push(normalized);
      } catch (error: any) {
        return NextResponse.json({ error: `Model at index ${i}: ${error.message}` }, { status: 400 });
      }
    }

    // 检查是否有重复的 modelId
    const modelIds = normalizedModels.map(m => m.modelId);
    const uniqueModelIds = new Set(modelIds);
    if (modelIds.length !== uniqueModelIds.size) {
      return NextResponse.json({ error: 'Duplicate modelId found in batch' }, { status: 400 });
    }

    // 检查哪些 modelId 已存在
    const existingModels = await prisma.systemModelDefinitions.findMany({
      where: { modelId: { in: modelIds } },
      select: { modelId: true },
    });

    const existingModelIds = new Set(existingModels.map(m => m.modelId));
    if (existingModelIds.size > 0) {
      return NextResponse.json(
        {
          error: 'Some models already exist',
          existingModelIds: Array.from(existingModelIds),
        },
        { status: 409 },
      );
    }

    // 批量创建
    const createData = normalizedModels.map(model => buildCreateData(model));

    const result = await prisma.$transaction(createData.map(data => prisma.systemModelDefinitions.create({ data })));

    return NextResponse.json(
      {
        success: true,
        count: result.length,
        data: result,
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error('Failed to batch create model definitions:', error);
    return NextResponse.json({ error: error.message || 'Failed to batch create model definitions' }, { status: 500 });
  }
};

/**
 * PUT /api/system/models/batch
 * 批量更新模型定义
 * 请求体格式：
 * {
 *   models: [
 *     { modelId, name?, provider?, ... },
 *     ...
 *   ]
 * }
 */
export const PUT = async (request: NextRequest) => {
  const header = request.headers;
  const authHeader = header.get('Authorization');
  if (!verifySystemApiKey(authHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      models: Array<{
        modelId: string;
        name?: string;
        provider?: string;
        family?: string;
        type?: string;
        description?: string;
        contextLength?: number;
        supportsStreaming?: boolean;
        supportsFunctionCalling?: boolean;
        supportsVision?: boolean;
        pricing?: any;
        enabled?: boolean;
        metadata?: any;
      }>;
    };

    if (!body.models || !Array.isArray(body.models) || body.models.length === 0) {
      return NextResponse.json({ error: 'Missing or empty models array' }, { status: 400 });
    }

    // 限制批量操作数量
    if (body.models.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 models per batch operation' }, { status: 400 });
    }

    // 验证所有模型都有 modelId
    for (const model of body.models) {
      if (!model.modelId) {
        return NextResponse.json({ error: 'Missing modelId in one or more models' }, { status: 400 });
      }
    }

    const modelIds = body.models.map(m => m.modelId);

    // 检查哪些模型不存在
    const existingModels = await prisma.systemModelDefinitions.findMany({
      where: { modelId: { in: modelIds } },
      select: { modelId: true },
    });

    const existingModelIds = new Set(existingModels.map(m => m.modelId));
    const notFoundModelIds = modelIds.filter(id => !existingModelIds.has(id));

    if (notFoundModelIds.length > 0) {
      return NextResponse.json(
        {
          error: 'Some models not found',
          notFoundModelIds,
        },
        { status: 404 },
      );
    }

    // 批量更新
    const updatePromises = body.models.map(model => {
      const updateData = buildUpdateData(model);

      return prisma.systemModelDefinitions.update({
        where: { modelId: model.modelId },
        data: updateData,
      });
    });

    const result = await prisma.$transaction(updatePromises);

    return NextResponse.json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error: any) {
    console.error('Failed to batch update model definitions:', error);
    return NextResponse.json({ error: error.message || 'Failed to batch update model definitions' }, { status: 500 });
  }
};

/**
 * DELETE /api/system/models/batch
 * 批量删除模型定义
 * 请求体格式：
 * {
 *   modelIds: ["model-id-1", "model-id-2", ...]
 * }
 */
export const DELETE = async (request: NextRequest) => {
  const header = request.headers;
  const authHeader = header.get('Authorization');
  if (!verifySystemApiKey(authHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      modelIds: string[];
    };

    if (!body.modelIds || !Array.isArray(body.modelIds) || body.modelIds.length === 0) {
      return NextResponse.json({ error: 'Missing or empty modelIds array' }, { status: 400 });
    }

    // 限制批量操作数量
    if (body.modelIds.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 models per batch operation' }, { status: 400 });
    }

    // 检查哪些模型不存在
    const existingModels = await prisma.systemModelDefinitions.findMany({
      where: { modelId: { in: body.modelIds } },
      select: { modelId: true },
    });

    const existingModelIds = new Set(existingModels.map(m => m.modelId));
    const notFoundModelIds = body.modelIds.filter(id => !existingModelIds.has(id));

    if (notFoundModelIds.length > 0) {
      return NextResponse.json(
        {
          error: 'Some models not found',
          notFoundModelIds,
        },
        { status: 404 },
      );
    }

    // 批量删除
    await prisma.$transaction(
      body.modelIds.map(modelId =>
        prisma.systemModelDefinitions.delete({
          where: { modelId },
        }),
      ),
    );

    return NextResponse.json({
      success: true,
      count: body.modelIds.length,
      deletedModelIds: body.modelIds,
    });
  } catch (error: any) {
    console.error('Failed to batch delete model definitions:', error);
    return NextResponse.json({ error: error.message || 'Failed to batch delete model definitions' }, { status: 500 });
  }
};
