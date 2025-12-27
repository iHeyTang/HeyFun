import { ToolContext } from '../../context';
import { retrievePromptFragmentsParamsSchema } from './schema';
import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { prisma } from '@/lib/server/prisma';
import { vectorManager, isVectorIndexAvailable, extractSnippetIdFromVectorId } from '@/lib/server/vector';
import type { VectorProvider } from '@/lib/server/vector/types';
import { generateEmbedding } from '@/lib/server/embeddings';
import CHAT from '@repo/llm/chat';

/**
 * 获取用于片段检索的向量库提供者
 */
function getSnippetVectorProvider(): VectorProvider | undefined {
  const providers = vectorManager.getAllProviders();
  return providers.find((p: VectorProvider) => p.name === 'prompt-snippets');
}

/**
 * 解析标签数据（JSON类型）
 */
function parseTags(tagsData: any): string[] {
  try {
    const tags = Array.isArray(tagsData) ? (tagsData as string[]) : typeof tagsData === 'string' ? JSON.parse(tagsData) : [];
    return Array.isArray(tags) ? tags.map(t => String(t)) : [];
  } catch {
    return [];
  }
}

/**
 * 从意图中提取关键词
 */
function extractKeywords(intent: { primaryGoal?: string; taskType?: string } | undefined, userMessage: string): string[] {
  const keywords: string[] = [];

  // 从用户消息中提取关键词（简单分词）
  const words = userMessage
    .toLowerCase()
    .split(/[\s,，。、；;：:！!？?]+/)
    .filter(w => w.trim().length > 0);

  keywords.push(...words);

  // 从意图中提取关键词
  if (intent) {
    if (intent.primaryGoal) {
      keywords.push(...intent.primaryGoal.toLowerCase().split(/\s+/));
    }
    if (intent.taskType) {
      keywords.push(intent.taskType.toLowerCase());
    }
  }

  // 去重
  return [...new Set(keywords)];
}

/**
 * 标签匹配检索
 */
async function searchByTags(keywords: string[]): Promise<string[]> {
  if (keywords.length === 0) {
    return [];
  }

  const allFragments = await prisma.systemPromptSnippets.findMany({
    where: {
      enabled: true,
    },
    select: {
      id: true,
      tags: true,
    },
  });

  const matchedFragments: Array<{ id: string }> = [];
  const lowerKeywords = keywords.map(k => k.toLowerCase());

  for (const fragment of allFragments) {
    if (!fragment?.id) continue;
    const tags = parseTags(fragment.tags).map(t => t.toLowerCase());
    if (tags.length === 0) continue;

    if (lowerKeywords.some(keyword => tags.includes(keyword))) {
      matchedFragments.push({ id: fragment.id });
    }
  }

  return matchedFragments.map(f => f.id).slice(0, 50);
}

/**
 * 关键词搜索（在名称、描述中搜索）
 */
async function searchByKeywords(keywords: string[]): Promise<string[]> {
  if (keywords.length === 0) {
    return [];
  }

  const searchTerms = keywords.map(k => k.toLowerCase().trim()).filter(k => k.length > 0);

  if (searchTerms.length === 0) {
    return [];
  }

  const fragments = await prisma.systemPromptSnippets.findMany({
    where: {
      enabled: true,
      OR: [
        ...searchTerms.map(term => ({
          name: { contains: term, mode: 'insensitive' as const },
        })),
        ...searchTerms.map(term => ({
          description: { contains: term, mode: 'insensitive' as const },
        })),
      ],
    },
    select: { id: true },
    take: 100,
  });

  return fragments.map(f => f.id);
}

/**
 * 向量搜索
 */
async function searchByVector(queryText: string, topK: number = 20): Promise<string[]> {
  const provider = getSnippetVectorProvider();

  if (!provider || !provider.isAvailable()) {
    return [];
  }

  try {
    const queryEmbedding = await generateEmbedding(queryText);
    const results = await provider.query(queryEmbedding, Math.min(topK, 50));

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

    const snippetIds = snippetResults.map(r => r.snippetId);
    const snippets = await prisma.systemPromptSnippets.findMany({
      where: {
        id: { in: snippetIds },
      },
      select: { id: true, enabled: true },
    });

    const enabledSnippetIds = snippetResults
      .map(result => {
        const snippet = snippets.find(s => s.id === result.snippetId);
        return snippet && snippet.enabled ? result.snippetId : null;
      })
      .filter((id): id is string => id !== null);

    return enabledSnippetIds;
  } catch (error) {
    console.error('[RetrievePromptFragmentsTool] ❌ 向量搜索失败:', error);
    return [];
  }
}

/**
 * 使用 LLM 选择片段
 */
async function selectFragmentsWithLLM(
  userMessage: string,
  intent: { primaryGoal?: string; taskType?: string; complexity?: string } | undefined,
  candidateFragmentIds: string[],
  maxFragments: number,
): Promise<{ fragmentIds: string[]; confidence: number; reasons: string[] }> {
  if (candidateFragmentIds.length === 0) {
    return {
      fragmentIds: [],
      confidence: 0,
      reasons: ['没有候选片段'],
    };
  }

  if (candidateFragmentIds.length <= maxFragments) {
    return {
      fragmentIds: candidateFragmentIds,
      confidence: 0.7,
      reasons: ['候选片段较少，直接返回'],
    };
  }

  // 获取候选片段的详细信息
  const candidates = await prisma.systemPromptSnippets.findMany({
    where: {
      id: { in: candidateFragmentIds },
      enabled: true,
    },
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      tags: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const fragmentsInfo = candidates
    .map(f => {
      const tags = parseTags(f.tags);
      const tagsStr = tags.length > 0 ? tags.join(', ') : '无';
      return `- ${f.id}: ${f.name}
  描述: ${f.description}
  标签: ${tagsStr}
  分类: ${f.category || '其他'}`;
    })
    .join('\n\n');

  const intentInfo = intent
    ? `意图: ${intent.primaryGoal || '未知'}
任务类型: ${intent.taskType || '通用'}
复杂度: ${intent.complexity || '未知'}`
    : '意图: 未检测到明确意图';

  const prompt = `你是一个智能片段选择器。根据用户消息和意图，从候选片段中选择最相关的片段。

${intentInfo}

用户消息: ${userMessage.substring(0, 300)}

候选片段:
${fragmentsInfo}

请分析用户需求，选择最相关的片段ID（最多选择${maxFragments}个）。

**重要：必须严格按照以下JSON格式输出，不要添加任何其他文字：**
\`\`\`json
{
  "fragmentIds": ["id1", "id2"],
  "confidence": 0.9,
  "reasoning": "选择原因说明"
}
\`\`\``;

  try {
    const modelId = 'gpt-4o-mini';
    CHAT.setModels(await import('@/actions/llm').then(m => m.loadModelDefinitionsFromDatabase()));
    const llmClient = CHAT.createClient(modelId);

    const response = await llmClient.chat({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    });

    const choice = response.choices?.[0];
    const content = choice?.message?.content || '';
    const responseText = typeof content === 'string' ? content : JSON.stringify(content);

    // 解析 JSON
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/, '');
      jsonText = jsonText.replace(/\s*```$/, '');
      jsonText = jsonText.trim();
    }

    const parsedResponse = JSON.parse(jsonText);
    const validFragmentIds = (parsedResponse.fragmentIds || []).filter((id: string) => candidateFragmentIds.includes(id)).slice(0, maxFragments);

    return {
      fragmentIds: validFragmentIds,
      confidence: Math.max(0, Math.min(1, parsedResponse.confidence ?? 0.7)),
      reasons: [parsedResponse.reasoning || 'LLM 选择'],
    };
  } catch (error) {
    console.error('[RetrievePromptFragmentsTool] ❌ LLM 选择失败:', error);
    return {
      fragmentIds: candidateFragmentIds.slice(0, maxFragments),
      confidence: 0.5,
      reasons: [`LLM 选择失败: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

export const retrievePromptFragmentsExecutor = definitionToolExecutor(
  retrievePromptFragmentsParamsSchema,
  async (args, context) => {
    return await context.workflow.run(`toolcall-${context.toolCallId || 'retrieve-fragments'}`, async () => {
      try {
        const { userMessage, intent, maxFragments = 5 } = args;

        // 提取关键词
        const keywords = extractKeywords(intent, userMessage);

        // 构建向量搜索查询文本
        const vectorQueryText = intent
          ? `${userMessage} ${intent.primaryGoal || ''} ${intent.taskType || ''}`.trim()
          : userMessage;

        // 并行执行多种检索策略
        const provider = getSnippetVectorProvider();
        const vectorIndexAvailable = provider?.isAvailable() ?? false;

        const [tagResults, keywordResults, vectorResults] = await Promise.all([
          searchByTags(keywords),
          searchByKeywords(keywords),
          vectorIndexAvailable ? searchByVector(vectorQueryText, 20) : Promise.resolve([]),
        ]);

        // 合并去重
        const candidateFragmentIds = [...new Set([...tagResults, ...keywordResults, ...vectorResults])];

        if (candidateFragmentIds.length === 0) {
          return {
            success: true,
            data: {
              fragments: [],
              fragmentIds: [],
              confidence: 0,
              reasons: ['没有找到相关片段'],
            },
          };
        }

        // 选择最相关的片段
        const selectionResult = await selectFragmentsWithLLM(userMessage, intent, candidateFragmentIds, maxFragments);

        // 获取片段的完整信息
        const fragments = await prisma.systemPromptSnippets.findMany({
          where: {
            id: { in: selectionResult.fragmentIds },
            enabled: true,
          },
          select: {
            id: true,
            name: true,
            description: true,
            content: true,
          },
        });

        return {
          success: true,
          data: {
            fragments: fragments.map(f => ({
              id: f.id,
              name: f.name,
              description: f.description,
              content: f.content,
            })),
            fragmentIds: selectionResult.fragmentIds,
            confidence: selectionResult.confidence,
            reasons: selectionResult.reasons,
          },
        };
      } catch (error) {
        console.error('[RetrievePromptFragmentsTool] ❌ 片段检索失败:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });
  },
);

