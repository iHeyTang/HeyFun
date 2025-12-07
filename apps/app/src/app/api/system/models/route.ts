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
 * GET /api/system/models
 * 获取模型定义列表
 * 支持查询参数：
 * - page: 页码（默认 1）
 * - pageSize: 每页数量（默认 20）
 * - provider: 提供商筛选
 * - family: 模型家族筛选
 * - type: 模型类型筛选（language, embedding, image）
 * - enabled: 是否启用筛选（true/false）
 * - search: 搜索关键词（搜索 modelId 和 name）
 */
export const GET = async (request: NextRequest) => {
  const header = request.headers;
  const authHeader = header.get('Authorization');
  if (!verifySystemApiKey(authHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20', 10), 100);
  const provider = searchParams.get('provider');
  const family = searchParams.get('family');
  const type = searchParams.get('type');
  const enabled = searchParams.get('enabled');
  const search = searchParams.get('search');

  const where: any = {};

  if (provider) {
    where.provider = provider;
  }

  if (family) {
    where.family = family;
  }

  if (type) {
    where.type = type;
  }

  if (enabled !== null && enabled !== undefined) {
    where.enabled = enabled === 'true';
  }

  if (search) {
    where.OR = [{ modelId: { contains: search, mode: 'insensitive' } }, { name: { contains: search, mode: 'insensitive' } }];
  }

  const [models, total] = await Promise.all([
    prisma.systemModelDefinitions.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.systemModelDefinitions.count({ where }),
  ]);

  return NextResponse.json({
    data: models,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
};

/**
 * POST /api/system/models
 * 创建新的模型定义
 * 支持内部格式和 Vercel 格式，通过 format 参数指定
 * 查询参数：
 * - format: 'internal' | 'vercel' (默认 'internal')
 * - defaultProvider: 当 format='vercel' 时使用的默认 provider (默认 'vercel')
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

    // 根据指定格式转换
    let normalizedInput: ModelDefinitionInput;
    try {
      normalizedInput = normalizeModelInput(body, format, defaultProvider);
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // 验证必需字段
    const validation = validateModelInput(normalizedInput);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // 检查 modelId 是否已存在
    const existing = await prisma.systemModelDefinitions.findUnique({
      where: { modelId: normalizedInput.modelId },
    });

    if (existing) {
      return NextResponse.json({ error: 'Model with this modelId already exists' }, { status: 409 });
    }

    // 创建模型定义
    const model = await prisma.systemModelDefinitions.create({
      data: buildCreateData(normalizedInput),
    });

    return NextResponse.json({ data: model }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create model definition:', error);
    return NextResponse.json({ error: error.message || 'Failed to create model definition' }, { status: 500 });
  }
};

/**
 * PUT /api/system/models
 * 更新模型定义（需要提供 modelId）
 */
export const PUT = async (request: NextRequest) => {
  const header = request.headers;
  const authHeader = header.get('Authorization');
  if (!verifySystemApiKey(authHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
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
    };

    if (!body.modelId) {
      return NextResponse.json({ error: 'Missing required field: modelId' }, { status: 400 });
    }

    // 检查模型是否存在
    const existing = await prisma.systemModelDefinitions.findUnique({
      where: { modelId: body.modelId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    // 构建更新数据
    const updateData = buildUpdateData(body);

    // 更新模型定义
    const model = await prisma.systemModelDefinitions.update({
      where: { modelId: body.modelId },
      data: updateData,
    });

    return NextResponse.json({ data: model });
  } catch (error: any) {
    console.error('Failed to update model definition:', error);
    return NextResponse.json({ error: error.message || 'Failed to update model definition' }, { status: 500 });
  }
};

/**
 * DELETE /api/system/models
 * 删除模型定义（需要提供 modelId）
 */
export const DELETE = async (request: NextRequest) => {
  const header = request.headers;
  const authHeader = header.get('Authorization');
  if (!verifySystemApiKey(authHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const modelId = searchParams.get('modelId');

    if (!modelId) {
      return NextResponse.json({ error: 'Missing required parameter: modelId' }, { status: 400 });
    }

    // 检查模型是否存在
    const existing = await prisma.systemModelDefinitions.findUnique({
      where: { modelId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    // 删除模型定义
    await prisma.systemModelDefinitions.delete({
      where: { modelId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete model definition:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete model definition' }, { status: 500 });
  }
};
