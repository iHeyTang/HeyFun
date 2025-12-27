import { prisma } from '@/lib/server/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { verifySystemApiKey } from '@/lib/server/model-definitions';
import { deleteSnippetFromVector, upsertSnippetToVector } from '@/lib/server/vector-prompt-snippets';

/**
 * SystemPromptSnippet 输入类型
 */
export interface SystemPromptSnippetInput {
  name: string;
  description: string;
  content: string;
  category?: string;
  section?: string;
  enabled?: boolean;
  version?: string;
  author?: string;
  tags?: string[]; // 标签数组
}

/**
 * SystemPromptSnippet 更新类型
 */
export interface SystemPromptSnippetUpdate extends Partial<Omit<SystemPromptSnippetInput, 'name'>> {
  name?: string;
  tags?: string[]; // 标签数组
}

/**
 * GET /api/system/system-prompt-snippets
 * 获取提示词片段列表
 * 支持查询参数：
 * - page: 页码（默认 1）
 * - pageSize: 每页数量（默认 20）
 * - category: 分类筛选
 * - section: 章节筛选
 * - enabled: 是否启用筛选（true/false）
 * - search: 搜索关键词（搜索 name 和 description）
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
  const category = searchParams.get('category');
  const section = searchParams.get('section');
  const enabled = searchParams.get('enabled');
  const search = searchParams.get('search');

  const where: any = {};

  if (category) {
    where.category = category;
  }

  if (section) {
    where.section = section;
  }

  if (enabled !== null && enabled !== undefined) {
    where.enabled = enabled === 'true';
  }

  if (search) {
    where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }];
  }

  const [snippets, total] = await Promise.all([
    prisma.systemPromptSnippets.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'asc' },
    }),
    prisma.systemPromptSnippets.count({ where }),
  ]);

  return NextResponse.json({
    data: snippets,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
};

/**
 * POST /api/system/system-prompt-snippets
 * 创建新的提示词片段
 */
export const POST = async (request: NextRequest) => {
  const header = request.headers;
  const authHeader = header.get('Authorization');
  if (!verifySystemApiKey(authHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as SystemPromptSnippetInput;

    // 验证必需字段
    if (!body.name || !body.description || !body.content) {
      return NextResponse.json({ error: 'Missing required fields: name, description, content' }, { status: 400 });
    }

    // 检查是否已存在相同名称和章节的提示词
    const existing = await prisma.systemPromptSnippets.findFirst({
      where: {
        name: body.name,
        section: body.section || null,
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Snippet with this name and section already exists' }, { status: 409 });
    }

    // 创建提示词片段
    const snippet = await prisma.systemPromptSnippets.create({
      data: {
        name: body.name,
        description: body.description,
        content: body.content,
        category: body.category || null,
        section: body.section || null,
        enabled: body.enabled ?? true,
        version: body.version || '1.0.0',
        author: body.author || 'System',
        tags: body.tags ? (body.tags as any) : [],
        embeddingStatus: 'pending', // 新创建的片段默认为待处理状态
        contentUpdatedAt: new Date(), // 记录内容创建时间
      },
    });

    // 如果启用了，异步触发 embedding（不阻塞响应）
    if (snippet.enabled) {
      upsertSnippetToVector(snippet.id, undefined, true).catch(error => {
        console.error(`[SystemPromptSnippets] ❌ 创建后自动 embedding 失败:`, error);
      });
    }

    return NextResponse.json({ data: snippet }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create system prompt snippet:', error);
    return NextResponse.json({ error: error.message || 'Failed to create system prompt snippet' }, { status: 500 });
  }
};

/**
 * PUT /api/system/system-prompt-snippets
 * 更新提示词片段（需要提供 id）
 */
export const PUT = async (request: NextRequest) => {
  const header = request.headers;
  const authHeader = header.get('Authorization');
  if (!verifySystemApiKey(authHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as SystemPromptSnippetUpdate & { id: string };

    if (!body.id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
    }

    // 检查提示词是否存在
    const existing = await prisma.systemPromptSnippets.findUnique({
      where: { id: body.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Snippet not found' }, { status: 404 });
    }

    // 如果更新了 name 或 section，检查是否与其他记录冲突
    if (body.name || body.section !== undefined) {
      const newName = body.name || existing.name;
      const newSection = body.section !== undefined ? body.section : existing.section;

      const conflict = await prisma.systemPromptSnippets.findFirst({
        where: {
          name: newName,
          section: newSection || null,
          id: { not: body.id },
        },
      });

      if (conflict) {
        return NextResponse.json({ error: 'Snippet with this name and section already exists' }, { status: 409 });
      }
    }

    // 检查是否有内容变更（需要重新生成 embedding）
    const hasContentChange =
      body.description !== undefined ||
      body.content !== undefined ||
      body.name !== undefined ||
      body.category !== undefined ||
      body.tags !== undefined;

    // 如果版本号未提供但内容有变更，自动递增版本号
    let newVersion = body.version;
    if (hasContentChange && !body.version && existing.version) {
      // 简单的版本号递增：1.0.0 -> 1.0.1
      const versionParts = existing.version.split('.');
      if (versionParts.length === 3) {
        const patch = parseInt(versionParts[2] || '0', 10) + 1;
        newVersion = `${versionParts[0]}.${versionParts[1]}.${patch}`;
      } else {
        newVersion = existing.version + '.1';
      }
    }

    // 构建更新数据
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.category !== undefined) updateData.category = body.category || null;
    if (body.section !== undefined) updateData.section = body.section || null;
    if (body.enabled !== undefined) updateData.enabled = body.enabled;
    if (newVersion !== undefined) updateData.version = newVersion || null;
    if (body.author !== undefined) updateData.author = body.author || null;
    if (body.tags !== undefined) updateData.tags = body.tags as any;

    // 如果有内容变更，重置 embedding 状态并更新内容更新时间
    if (hasContentChange) {
      updateData.embeddingStatus = 'pending';
      updateData.embeddingVersion = null;
      updateData.embeddingError = null;
      updateData.contentUpdatedAt = new Date(); // 记录内容更新时间
    }

    // 更新提示词片段
    const snippet = await prisma.systemPromptSnippets.update({
      where: { id: body.id },
      data: updateData,
    });

    // 如果有内容变更，删除旧的 embedding 并触发新的 embedding
    if (hasContentChange && snippet.enabled) {
      // 先删除旧的 embedding
      deleteSnippetFromVector(snippet.id, undefined, false).catch(error => {
        console.error(`[SystemPromptSnippets] ❌ 删除旧 embedding 失败:`, error);
      });

      // 异步触发新的 embedding（不阻塞响应）
      upsertSnippetToVector(snippet.id, undefined, true).catch(error => {
        console.error(`[SystemPromptSnippets] ❌ 更新后自动 embedding 失败:`, error);
      });
    } else if (body.enabled !== undefined && snippet.enabled && snippet.embeddingStatus !== 'completed') {
      // 如果只是启用了片段，且 embedding 未完成，触发 embedding
      upsertSnippetToVector(snippet.id, undefined, true).catch(error => {
        console.error(`[SystemPromptSnippets] ❌ 启用后自动 embedding 失败:`, error);
      });
    } else if (body.enabled === false) {
      // 如果禁用了片段，删除 embedding
      deleteSnippetFromVector(snippet.id, undefined, true).catch(error => {
        console.error(`[SystemPromptSnippets] ❌ 禁用后删除 embedding 失败:`, error);
      });
    }

    return NextResponse.json({ data: snippet });
  } catch (error: any) {
    console.error('Failed to update system prompt snippet:', error);
    return NextResponse.json({ error: error.message || 'Failed to update system prompt snippet' }, { status: 500 });
  }
};

/**
 * DELETE /api/system/system-prompt-snippets
 * 删除提示词片段（需要提供 id）
 */
export const DELETE = async (request: NextRequest) => {
  const header = request.headers;
  const authHeader = header.get('Authorization');
  if (!verifySystemApiKey(authHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing required parameter: id' }, { status: 400 });
    }

    // 检查提示词是否存在
    const existing = await prisma.systemPromptSnippets.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Snippet not found' }, { status: 404 });
    }

    // 先删除对应的 embedding
    await deleteSnippetFromVector(id, undefined, false).catch(error => {
      console.error(`[SystemPromptSnippets] ❌ 删除 embedding 失败:`, error);
      // 即使删除 embedding 失败，也继续删除数据库记录
    });

    // 删除提示词片段
    await prisma.systemPromptSnippets.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete system prompt snippet:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete system prompt snippet' }, { status: 500 });
  }
};
