/**
 * 定时任务：自动同步提示词片段的 embedding
 * 轮询未进行 embedding 或需要更新的提示词片段
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { upsertSnippetToVector, deleteSnippetFromVector } from '@/lib/server/vector-prompt-snippets';
import { verifySystemApiKey } from '@/lib/server/model-definitions';

// 注册此 route 的 body 类型到 QueueRoutes interface
declare module '@/lib/server/queue' {
  interface QueueRoutes {
    '/api/queue/embedding-sync': Record<string, never>; // 不需要 body
  }
}

/**
 * POST /api/queue/embedding-sync
 * 定时任务：处理待处理的 embedding
 * 支持查询参数：
 * - batchSize: 每批处理的数量（默认 10）
 * - maxRetries: 最大重试次数（默认 3）
 */
export async function POST(request: NextRequest) {
  // 验证系统 API Key（可选，用于手动触发）
  const authHeader = request.headers.get('Authorization');
  if (authHeader && !verifySystemApiKey(authHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const batchSize = parseInt(searchParams.get('batchSize') || '10', 10);
    const maxRetries = parseInt(searchParams.get('maxRetries') || '3', 10);

    console.log(`[EmbeddingSync] 🔄 开始处理 embedding 同步任务，批次大小: ${batchSize}`);

    // 1. 处理待处理的片段（pending）
    const pendingSnippets = await prisma.systemPromptSnippets.findMany({
      where: {
        enabled: true,
        embeddingStatus: 'pending',
      },
      take: batchSize,
      orderBy: { createdAt: 'asc' },
    });

    console.log(`[EmbeddingSync] 📋 找到 ${pendingSnippets.length} 个待处理的片段`);

    let successCount = 0;
    let failedCount = 0;

    // 更新状态为 processing
    for (const snippet of pendingSnippets) {
      await prisma.systemPromptSnippets.update({
        where: { id: snippet.id },
        data: { embeddingStatus: 'processing' },
      });
    }

    // 处理每个片段
    for (const snippet of pendingSnippets) {
      try {
        await upsertSnippetToVector(snippet.id, undefined, true);
        successCount++;
      } catch (error) {
        console.error(`[EmbeddingSync] ❌ 处理片段 ${snippet.id} 失败:`, error);
        failedCount++;
      }
    }

    // 2. 处理失败的片段（failed，重试次数未超过限制）
    const failedSnippets = await prisma.systemPromptSnippets.findMany({
      where: {
        enabled: true,
        embeddingStatus: 'failed',
      },
      take: Math.max(1, batchSize - pendingSnippets.length),
      orderBy: { updatedAt: 'asc' },
    });

    console.log(`[EmbeddingSync] 🔄 找到 ${failedSnippets.length} 个失败的片段，尝试重试`);

    for (const snippet of failedSnippets) {
      try {
        // 更新状态为 processing
        await prisma.systemPromptSnippets.update({
          where: { id: snippet.id },
          data: { embeddingStatus: 'processing' },
        });

        await upsertSnippetToVector(snippet.id, undefined, true);
        successCount++;
      } catch (error) {
        console.error(`[EmbeddingSync] ❌ 重试片段 ${snippet.id} 失败:`, error);
        failedCount++;
      }
    }

    // 3. 处理需要更新的片段（版本不匹配或内容已更新）
    // 先获取所有已完成的片段，然后在内存中筛选
    const allCompletedSnippets = await prisma.systemPromptSnippets.findMany({
      where: {
        enabled: true,
        embeddingStatus: 'completed',
      },
      take: batchSize * 2, // 获取更多以便筛选
      orderBy: { updatedAt: 'desc' },
    });

    // 筛选出需要更新的片段
    const outdatedSnippets = allCompletedSnippets.filter(snippet => {
      // 版本不匹配
      if (snippet.version && snippet.embeddingVersion && snippet.version !== snippet.embeddingVersion) {
        return true;
      }
      // 内容更新时间晚于 embedding 更新时间（内容已更新）
      if (snippet.embeddingUpdatedAt && snippet.contentUpdatedAt && snippet.contentUpdatedAt > snippet.embeddingUpdatedAt) {
        console.log(`[EmbeddingSync] 🔄 找到需要更新的片段 ${snippet.id}`, snippet.contentUpdatedAt, snippet.embeddingUpdatedAt);
        return true;
      }
      return false;
    }).slice(0, Math.max(1, batchSize - pendingSnippets.length - failedSnippets.length));

    console.log(`[EmbeddingSync] 🔄 找到 ${outdatedSnippets.length} 个需要更新的片段`);

    for (const snippet of outdatedSnippets) {
      try {
        // 先删除旧的 embedding
        await deleteSnippetFromVector(snippet.id, undefined, false);

        // 更新状态为 processing
        await prisma.systemPromptSnippets.update({
          where: { id: snippet.id },
          data: { embeddingStatus: 'processing' },
        });

        // 创建新的 embedding
        await upsertSnippetToVector(snippet.id, undefined, true);
        successCount++;
      } catch (error) {
        console.error(`[EmbeddingSync] ❌ 更新片段 ${snippet.id} 失败:`, error);
        failedCount++;
      }
    }

    const totalProcessed = pendingSnippets.length + failedSnippets.length + outdatedSnippets.length;

    console.log(`[EmbeddingSync] ✅ 处理完成: 总计 ${totalProcessed}, 成功 ${successCount}, 失败 ${failedCount}`);

    return NextResponse.json({
      success: true,
      processed: totalProcessed,
      successCount,
      failedCount,
      pending: pendingSnippets.length,
      retried: failedSnippets.length,
      updated: outdatedSnippets.length,
    });
  } catch (error) {
    console.error('[EmbeddingSync] ❌ 处理失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

