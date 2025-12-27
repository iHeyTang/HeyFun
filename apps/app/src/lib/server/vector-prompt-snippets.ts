/**
 * 提示词片段向量索引管理
 * 用于将提示词片段同步到 Upstash Vector 索引
 */

import { prisma } from '@/lib/server/prisma';
import { vectorManager, generateVectorId, VECTOR_DIMENSION } from '@/lib/server/vector';
import type { VectorProvider } from '@/lib/server/vector/types';
import { generateEmbedding } from '@/lib/server/embeddings';

/**
 * 获取用于片段的向量库提供者
 * 必须配置 'prompt-snippets' 名称的向量库，否则抛出错误
 */
function getSnippetVectorProvider(): VectorProvider {
  const providers = vectorManager.getAllProviders();
  const snippetsProvider = providers.find((p: VectorProvider) => p.name === 'prompt-snippets');

  if (!snippetsProvider) {
    throw new Error('Vector provider "prompt-snippets" not found. Please configure it in VECTOR_PROVIDERS environment variable.');
  }

  return snippetsProvider;
}

/**
 * 为片段生成向量嵌入文本
 * 结合名称、描述、标签和内容
 */
function buildEmbeddingText(snippet: { name: string; description: string; content: string; tags?: any }): string {
  const parts: string[] = [];

  // 添加名称
  parts.push(snippet.name);

  // 添加描述
  if (snippet.description) {
    parts.push(snippet.description);
  }

  // 添加标签
  if (snippet.tags) {
    try {
      const tags = Array.isArray(snippet.tags) ? (snippet.tags as string[]) : JSON.parse(String(snippet.tags));
      if (Array.isArray(tags) && tags.length > 0) {
        parts.push(`标签: ${tags.join(', ')}`);
      }
    } catch {
      // 忽略解析错误
    }
  }

  // 添加内容的前500字符（避免过长）
  if (snippet.content) {
    const contentPreview = snippet.content.substring(0, 500).trim();
    if (contentPreview) {
      parts.push(contentPreview);
    }
  }

  return parts.join('\n\n');
}

/**
 * 将单个片段同步到向量索引
 * @param snippetId 片段 ID
 * @param providerName 可选的向量库名称（默认自动选择）
 * @param updateStatus 是否更新数据库中的 embedding 状态（默认 true）
 */
export async function upsertSnippetToVector(snippetId: string, providerName?: string, updateStatus: boolean = true): Promise<void> {
  const provider = providerName ? vectorManager.getAllProviders().find((p: VectorProvider) => p.name === providerName) : getSnippetVectorProvider();

  if (!provider) {
    throw new Error(`Vector provider "${providerName || 'prompt-snippets'}" not found`);
  }

  if (!provider.isAvailable()) {
    throw new Error(`Vector provider "${provider.name}" is not available. Please check your configuration.`);
  }

  try {
    // 获取片段数据
    const snippet = await prisma.systemPromptSnippets.findUnique({
      where: { id: snippetId },
    });

    if (!snippet) {
      console.warn(`[VectorSnippets] ⚠️ 片段 ${snippetId} 不存在`);
      return;
    }

    // 如果片段未启用，从向量索引中删除
    if (!snippet.enabled) {
      await deleteSnippetFromVector(snippetId, providerName);
      return;
    }

    // 构建嵌入文本
    const embeddingText = buildEmbeddingText(snippet);

    // 生成向量嵌入
    const embedding = await generateEmbedding(embeddingText);

    // 验证向量维度
    if (embedding.length !== VECTOR_DIMENSION) {
      console.warn(`[VectorSnippets] ⚠️ 片段 ${snippetId} 的向量维度不匹配: 期望 ${VECTOR_DIMENSION}, 实际 ${embedding.length}`);
      return;
    }

    // 构建元数据
    const metadata: Record<string, any> = {
      snippetId: snippet.id,
      name: snippet.name,
      category: snippet.category || null,
    };

    // 添加标签到元数据
    if (snippet.tags) {
      try {
        const tags = Array.isArray(snippet.tags) ? (snippet.tags as string[]) : JSON.parse(String(snippet.tags));
        if (Array.isArray(tags)) {
          metadata.tags = tags;
        }
      } catch {
        // 忽略解析错误
      }
    }

    // 上传到向量索引
    const vectorId = generateVectorId(snippet.id);
    await provider.upsert(vectorId, embedding, metadata);

    // 更新数据库中的 embedding 状态
    if (updateStatus) {
      await prisma.systemPromptSnippets.update({
        where: { id: snippetId },
        data: {
          embeddingStatus: 'completed',
          embeddingVersion: snippet.version || '1.0.0',
          embeddingUpdatedAt: new Date(),
          embeddingError: null,
        },
      });
    }

    console.log(`[VectorSnippets] ✅ 已同步片段 ${snippetId} 到向量索引`);
  } catch (error) {
    // 更新失败状态
    if (updateStatus) {
      await prisma.systemPromptSnippets
        .update({
          where: { id: snippetId },
          data: {
            embeddingStatus: 'failed',
            embeddingError: error instanceof Error ? error.message : String(error),
          },
        })
        .catch(err => console.error(`[VectorSnippets] ❌ 更新失败状态失败:`, err));
    }
    console.error(`[VectorSnippets] ❌ 同步片段 ${snippetId} 失败:`, error);
    throw error;
  }
}

/**
 * 从向量索引中删除片段
 * @param snippetId 片段 ID
 * @param providerName 可选的向量库名称（默认自动选择）
 * @param updateStatus 是否更新数据库中的 embedding 状态（默认 true）
 */
export async function deleteSnippetFromVector(snippetId: string, providerName?: string, updateStatus: boolean = true): Promise<void> {
  const provider = providerName ? vectorManager.getAllProviders().find((p: VectorProvider) => p.name === providerName) : getSnippetVectorProvider();

  if (!provider) {
    throw new Error(`Vector provider "${providerName || 'prompt-snippets'}" not found`);
  }

  if (!provider.isAvailable()) {
    throw new Error(`Vector provider "${provider.name}" is not available. Please check your configuration.`);
  }

  try {
    const vectorId = generateVectorId(snippetId);
    await provider.delete(vectorId);

    // 更新数据库中的 embedding 状态
    if (updateStatus) {
      await prisma.systemPromptSnippets
        .update({
          where: { id: snippetId },
          data: {
            embeddingStatus: 'pending',
            embeddingVersion: null,
            embeddingUpdatedAt: null,
            embeddingError: null,
          },
        })
        .catch(err => console.error(`[VectorSnippets] ❌ 更新状态失败:`, err));
    }

    console.log(`[VectorSnippets] ✅ 已从向量索引删除片段 ${snippetId}`);
  } catch (error) {
    console.error(`[VectorSnippets] ❌ 删除片段 ${snippetId} 失败:`, error);
    throw error;
  }
}

/**
 * 批量同步所有启用的片段到向量索引
 * @param providerName 可选的向量库名称（默认自动选择）
 */
export async function syncAllSnippetsToVector(providerName?: string): Promise<{ success: number; failed: number }> {
  const provider = providerName ? vectorManager.getAllProviders().find((p: VectorProvider) => p.name === providerName) : getSnippetVectorProvider();

  if (!provider) {
    throw new Error(`Vector provider "${providerName || 'prompt-snippets'}" not found`);
  }

  if (!provider.isAvailable()) {
    throw new Error(`Vector provider "${provider.name}" is not available. Please check your configuration.`);
  }

  try {
    // 获取所有启用的片段
    const snippets = await prisma.systemPromptSnippets.findMany({
      where: { enabled: true },
      select: {
        id: true,
        name: true,
        description: true,
        content: true,
        tags: true,
        category: true,
      },
    });

    console.log(`[VectorSnippets] 🔄 开始批量同步 ${snippets.length} 个片段到向量索引`);

    let success = 0;
    let failed = 0;

    // 逐个同步（避免并发过多导致 API 限制）
    for (const snippet of snippets) {
      try {
        await upsertSnippetToVector(snippet.id);
        success++;
      } catch (error) {
        console.error(`[VectorSnippets] ❌ 同步片段 ${snippet.id} 失败:`, error);
        failed++;
      }
    }

    console.log(`[VectorSnippets] ✅ 批量同步完成: 成功 ${success}, 失败 ${failed}`);
    return { success, failed };
  } catch (error) {
    console.error('[VectorSnippets] ❌ 批量同步失败:', error);
    throw error;
  }
}
