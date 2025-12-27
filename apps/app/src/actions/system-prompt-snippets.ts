'use server';
import { withUserAuth, type AuthWrapperContext } from '@/lib/server/auth-wrapper';
import { prisma } from '@/lib/server/prisma';
import { SystemPromptSnippets } from '@prisma/client';
import { vectorManager, extractSnippetIdFromVectorId } from '@/lib/server/vector';
import type { VectorProvider } from '@/lib/server/vector/types';
import { generateEmbedding } from '@/lib/server/embeddings';

export const getAllSystemPromptSnippets = withUserAuth('systemPromptSnippets/getAll', async () => {
  const snippets = await prisma.systemPromptSnippets.findMany({
    orderBy: { createdAt: 'asc' },
  });

  return snippets;
});

/**
 * 获取用于片段检索的向量库提供者
 */
function getSnippetVectorProvider(): VectorProvider | undefined {
  // 优先使用 'prompt-snippets' 名称的向量库
  const providers = vectorManager.getAllProviders();
  const snippetsProvider = providers.find((p: VectorProvider) => p.name === 'prompt-snippets');
  if (snippetsProvider) {
    return snippetsProvider;
  }

  // 回退到 'snippets' 名称的向量库
  const fallbackProvider = providers.find((p: VectorProvider) => p.name === 'snippets');
  if (fallbackProvider) {
    return fallbackProvider;
  }

  // 最后回退到 'default' 名称的 upstash 向量库（向后兼容）
  return vectorManager.getProvider('upstash', 'default');
}

/**
 * 使用RAG（向量搜索）查找相关的提示词片段
 */
export const searchSnippetsByRAG = withUserAuth(
  'systemPromptSnippets/searchByRAG',
  async ({ args }: AuthWrapperContext<{ query: string; topK?: number }>) => {
    const { query, topK = 10 } = args;

    try {
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        throw new Error('查询文本不能为空');
      }

      const provider = getSnippetVectorProvider();

      // 检查向量索引是否可用
      if (!provider || !provider.isAvailable()) {
        throw new Error('向量索引不可用，请检查配置');
      }

      // 生成查询文本的向量嵌入
      const queryEmbedding = await generateEmbedding(query.trim());

      // 在向量索引中搜索
      const results = await provider.query(queryEmbedding, Math.min(topK, 50));

      // 提取片段 ID 和相似度分数
      const snippetResults = results
        .map(result => {
          const snippetId = extractSnippetIdFromVectorId(result.id);
          return {
            snippetId,
            score: result.score || 0,
          };
        })
        .filter(item => item.snippetId.length > 0)
        .slice(0, topK);

      // 从数据库获取完整的片段信息
      const snippetIds = snippetResults.map(r => r.snippetId);
      const snippets = await prisma.systemPromptSnippets.findMany({
        where: {
          id: { in: snippetIds },
        },
      });

      // 按照搜索结果顺序排序，并添加相似度分数
      const snippetsWithScore = snippetResults
        .map(result => {
          const snippet = snippets.find(s => s.id === result.snippetId);
          if (!snippet) return null;
          return {
            ...snippet,
            similarityScore: result.score,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);

      return snippetsWithScore;
    } catch (error: any) {
      console.error('[RAG Search] ❌ 搜索失败:', error);
      throw error;
    }
  },
);

export type SystemPromptSnippet = SystemPromptSnippets;
