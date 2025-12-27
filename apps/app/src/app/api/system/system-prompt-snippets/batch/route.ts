import { prisma } from '@/lib/server/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { verifySystemApiKey } from '@/lib/server/model-definitions';
import type { SystemPromptSnippetInput } from '../route';

/**
 * POST /api/system/system-prompt-snippets/batch
 * 批量创建提示词片段
 * 请求体格式：
 * {
 *   snippets: [
 *     { name, description, content, category, section, ... },
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
    const body = (await request.json()) as { snippets: SystemPromptSnippetInput[] };

    if (!body.snippets || !Array.isArray(body.snippets) || body.snippets.length === 0) {
      return NextResponse.json({ error: 'Missing or empty snippets array' }, { status: 400 });
    }

    // 限制批量操作数量
    if (body.snippets.length > 200) {
      return NextResponse.json({ error: 'Maximum 200 snippets per batch operation' }, { status: 400 });
    }

    // 验证所有片段
    for (let i = 0; i < body.snippets.length; i++) {
      const snippet = body.snippets[i] as SystemPromptSnippetInput;
      if (!snippet.name || !snippet.description || !snippet.content) {
        return NextResponse.json({ error: `Snippet at index ${i}: Missing required fields: name, description, content` }, { status: 400 });
      }
    }

    // 检查哪些片段已存在（基于 name + section）
    const nameSectionPairs = body.snippets.map((s: SystemPromptSnippetInput) => ({
      name: s.name,
      section: s.section || null,
    }));

    const existingSnippets = await prisma.systemPromptSnippets.findMany({
      where: {
        OR: nameSectionPairs.map(pair => ({
          name: pair.name,
          section: pair.section,
        })),
      },
      select: { name: true, section: true },
    });

    const existingSet = new Set(existingSnippets.map(s => `${s.name}::${s.section || ''}`));

    // 分离新片段和已存在的片段
    const newSnippets: SystemPromptSnippetInput[] = [];
    const skipped: Array<{ name: string; section: string | null; reason: string }> = [];

    for (let i = 0; i < body.snippets.length; i++) {
      const snippet = body.snippets[i] as SystemPromptSnippetInput;
      const key = `${snippet.name}::${snippet.section || ''}`;

      if (existingSet.has(key)) {
        skipped.push({
          name: snippet.name,
          section: snippet.section || null,
          reason: 'Already exists',
        });
      } else {
        newSnippets.push(snippet);
      }
    }

    // 批量创建新片段
    const created = await prisma.systemPromptSnippets.createMany({
      data: newSnippets.map(snippet => ({
        name: snippet.name,
        description: snippet.description,
        content: snippet.content,
        category: snippet.category || null,
        section: snippet.section || null,
        enabled: snippet.enabled ?? true,
        version: snippet.version || '1.0.0',
        author: snippet.author || 'System',
        contentUpdatedAt: new Date(), // 记录内容创建时间
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({
      success: true,
      created: created.count,
      skipped: skipped.length,
      skippedItems: skipped,
      total: body.snippets.length,
    });
  } catch (error: any) {
    console.error('Failed to batch create system prompt snippets:', error);
    return NextResponse.json({ error: error.message || 'Failed to batch create system prompt snippets' }, { status: 500 });
  }
};
