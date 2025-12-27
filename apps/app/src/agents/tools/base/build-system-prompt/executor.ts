import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { generateEmbedding } from '@/lib/server/embeddings';
import { prisma } from '@/lib/server/prisma';
import { extractSnippetIdFromVectorId, vectorManager } from '@/lib/server/vector';
import type { VectorProvider } from '@/lib/server/vector/types';
import type { ChatClient } from '@repo/llm/chat';
import { buildSystemPromptParamsSchema } from './schema';

/**
 * 获取用于片段检索的向量库提供者
 */
function getSnippetVectorProvider(): VectorProvider | undefined {
  const providers = vectorManager.getAllProviders();
  return providers.find((p: VectorProvider) => p.name === 'prompt-snippets');
}

/**
 * 使用 LLM 扩展查询文本，提取语义相关的词汇
 */
async function expandQueryText(queryText: string, llmClient?: ChatClient): Promise<string> {
  // 如果没有提供 llmClient，直接使用原始查询文本
  if (!llmClient) {
    return queryText;
  }

  try {
    const prompt = `分析以下用户查询，提取所有相关的概念和关键词，生成一个包含语义相关词汇的扩展查询文本，用于向量搜索。

用户查询：${queryText}

要求：
1. **保留原始查询文本**：必须完整保留用户查询的原始内容
2. **提取关键概念**：识别并添加所有相关的语义概念，包括：
   - 同义词和相关词汇
   - 上位词和下位词（如"水果"→"苹果"，"交通工具"→"汽车"）
   - 相关领域概念（如"旅游"→"行程"、"住宿"、"景点"）
   - 关键词的多种表达方式
3. **识别重要信息维度**：从查询中识别关键信息，包括但不限于：
   - 时间相关：日期、时间段、时间概念
   - 地点相关：国家、城市、地区、位置
   - 对象相关：人物、物品、实体、概念
   - 动作相关：行为、操作、活动
   - 主题相关：领域、类别、话题
   - 其他：数量、特征、关系等
4. **确保完整性**：优先保证不遗漏重要的相关概念，即使词汇较多也要包含
5. **保持相关性**：只添加与查询主题相关的词汇，避免添加无关内容
6. 用空格分隔各个词汇
7. 只输出扩展后的查询文本，不要添加任何说明或解释

直接输出扩展后的查询文本：`;

    const response = await llmClient.chat({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 300,
    });

    const choice = response.choices?.[0];
    const content = choice?.message?.content || '';
    const expandedText = typeof content === 'string' ? content.trim() : String(content).trim();

    // 如果扩展后的文本为空或太短，使用原始文本
    if (!expandedText || expandedText.length < queryText.length) {
      return queryText;
    }

    return expandedText;
  } catch (error) {
    console.error('[BuildSystemPromptTool] ❌ 查询扩展失败，使用原始查询:', error);
    return queryText;
  }
}

/**
 * 向量搜索
 */
async function searchByVector(queryText: string, topK: number = 20, llmClient?: ChatClient): Promise<string[]> {
  const provider = getSnippetVectorProvider();
  if (!provider || !provider.isAvailable()) return [];
  try {
    // 使用 LLM 扩展查询文本以提高语义匹配准确性
    const expandedQueryText = await expandQueryText(queryText, llmClient);
    const queryEmbedding = await generateEmbedding(expandedQueryText);
    const results = await provider.query(queryEmbedding, Math.min(topK, 50));
    const snippetResults = results
      .map(result => {
        const snippetId = extractSnippetIdFromVectorId(result.id);
        return { snippetId, score: result.score || 0 };
      })
      .filter(item => item.snippetId.length > 0)
      .slice(0, topK);
    const snippetIds = snippetResults.map(r => r.snippetId);
    const snippets = await prisma.systemPromptSnippets.findMany({
      where: { id: { in: snippetIds } },
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
    console.error('[BuildSystemPromptTool] ❌ 向量搜索失败:', error);
    return [];
  }
}

/**
 * 使用 LLM 根据检索到的片段和用户意图生成动态系统提示词
 */
async function generateDynamicSystemPrompt(
  userMessage: string,
  intent: { primaryGoal?: string; taskType?: string; complexity?: string } | undefined,
  fragmentIds: string[],
  llmClient?: ChatClient,
): Promise<string> {
  if (fragmentIds.length === 0) {
    return '';
  }

  // 获取片段的完整信息
  const fragments = await prisma.systemPromptSnippets.findMany({
    where: {
      id: { in: fragmentIds },
      enabled: true,
    },
    select: {
      id: true,
      name: true,
      description: true,
      content: true,
      category: true,
      section: true,
    },
  });

  if (fragments.length === 0) {
    return '';
  }

  // 按照 fragmentIds 的顺序排序，保持向量搜索的相似度顺序
  const fragmentsMap = new Map(fragments.map(f => [f.id, f]));
  const orderedFragments = fragmentIds.map(id => fragmentsMap.get(id)).filter((f): f is NonNullable<typeof f> => f !== undefined);

  // 构建片段信息文本（供 LLM 参考）
  const fragmentsInfo = orderedFragments
    .map((f, idx) => {
      const section = (f.section as string) || f.category || '其他';
      return `[片段${idx + 1}] ${f.name}（分类：${section}）
描述：${f.description || '无'}
内容：
${f.content.trim()}`;
    })
    .join('\n\n---\n\n');

  const intentInfo = intent
    ? `用户意图：
- 主要目标：${intent.primaryGoal || '未指定'}
- 任务类型：${intent.taskType || '未指定'}
- 复杂度：${intent.complexity || '未指定'}`
    : '未提供明确的意图信息';

  // 构建 LLM 提示词
  const prompt = `你是一个系统提示词生成专家。根据用户的问题和检索到的相关片段，生成一段针对当前任务的系统提示词片段。

**用户问题**：
${userMessage}

**用户意图**：
${intentInfo}

**检索到的相关片段**：
${fragmentsInfo}

**任务**：
请基于上述信息，生成一段系统提示词片段。要求：
1. 不是简单拼接片段内容，而是理解用户需求后，生成针对性的指导
2. 提取片段中的关键原则和方法，结合用户的具体任务进行定制
3. 生成的提示词应该简洁明了，直接指导如何完成当前任务
4. 只生成提示词内容本身，不需要添加额外的说明或注释
5. 如果片段内容与任务相关性较低，可以忽略该片段

**输出格式**：
直接输出生成的系统提示词片段，不要使用代码块，不要添加任何前言或说明。`;

  // 如果没有 LLM 客户端，回退到简单拼接方式
  if (!llmClient) {
    console.warn('[BuildSystemPromptTool] LLM 客户端不可用，使用简单拼接方式');
    // 简单拼接作为回退
    let fragmentsPrompt = '';
    orderedFragments.forEach(fragment => {
      fragmentsPrompt += `\n\n### ${fragment.name}\n\n`;
      if (fragment.description) {
        fragmentsPrompt += `${fragment.description}\n\n`;
      }
      fragmentsPrompt += fragment.content.trim();
      fragmentsPrompt += '\n\n';
    });
    return fragmentsPrompt.trim();
  }

  try {
    const response = await llmClient.chat({
      messages: [
        {
          role: 'system',
          content: '你是一个专业的系统提示词生成助手，擅长根据用户需求和参考片段生成针对性强的系统提示词。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 20000,
    });

    const choice = response.choices?.[0];
    const content = choice?.message?.content || '';
    const generatedPrompt = typeof content === 'string' ? content.trim() : String(content).trim();

    // 检查是否因为 token 限制而被截断
    if (choice?.finish_reason === 'length') {
      console.warn('[BuildSystemPromptTool] ⚠️ 生成的系统提示词可能因为 token 限制而被截断，建议增加 max_tokens');
    }

    return generatedPrompt;
  } catch (error) {
    console.error('[BuildSystemPromptTool] ❌ LLM 生成失败，使用简单拼接方式:', error);
    // 回退到简单拼接
    let fragmentsPrompt = '';
    orderedFragments.forEach(fragment => {
      fragmentsPrompt += `\n\n### ${fragment.name}\n\n`;
      if (fragment.description) {
        fragmentsPrompt += `${fragment.description}\n\n`;
      }
      fragmentsPrompt += fragment.content.trim();
      fragmentsPrompt += '\n\n';
    });
    return fragmentsPrompt.trim();
  }
}

export const buildSystemPromptExecutor = definitionToolExecutor(buildSystemPromptParamsSchema, async (args, context) => {
  return await context.workflow.run(`toolcall-${context.toolCallId || 'build-system-prompt'}`, async () => {
    try {
      const { userMessage, intent, maxFragments = 5, basePrompt } = args;

      // 构建向量搜索查询文本
      const vectorQueryText = intent ? `${userMessage} ${intent.primaryGoal || ''} ${intent.taskType || ''}`.trim() : userMessage;

      // 从向量库检索片段（向量结果已按相似度排序，直接取前 maxFragments 个）
      const allFragmentIds = await searchByVector(vectorQueryText, maxFragments * 2, context.llmClient); // 多检索一些，以防有被禁用的片段
      const fragmentIds = allFragmentIds.slice(0, maxFragments);

      if (fragmentIds.length === 0) {
        // 没有找到相关片段，清除动态系统提示词
        if (context.dynamicSystemPrompt) {
          context.dynamicSystemPrompt.clearDynamicSystemPrompt();
        }
        return {
          success: true,
          data: {
            fragmentIds: [],
            fragments: [],
            dynamicSystemPrompt: undefined,
            confidence: 0,
            reasons: ['没有找到相关片段，已清除动态系统提示词'],
            shouldUpdateSystemPrompt: false,
          },
        };
      }

      // 获取片段的完整信息
      const fragments = await prisma.systemPromptSnippets.findMany({
        where: {
          id: { in: fragmentIds },
          enabled: true,
        },
        select: {
          id: true,
          name: true,
          description: true,
        },
      });

      // 使用 LLM 根据检索到的片段和用户意图生成动态系统提示词
      const dynamicSystemPrompt = await generateDynamicSystemPrompt(userMessage, intent, fragmentIds, context.llmClient);

      // 如果有生成的提示词，使用 context API 设置动态系统提示词
      if (dynamicSystemPrompt && context.dynamicSystemPrompt) {
        context.dynamicSystemPrompt.setDynamicSystemPrompt(dynamicSystemPrompt);
      }

      return {
        success: true,
        data: {
          fragmentIds,
          fragments: fragments.map(f => ({
            id: f.id,
            name: f.name,
            description: f.description,
          })),
          dynamicSystemPrompt: dynamicSystemPrompt || undefined, // 返回生成的动态系统提示词片段
          confidence: fragmentIds.length > 0 ? 0.8 : 0, // 向量搜索结果置信度
          reasons: fragmentIds.length > 0 ? ['从向量库检索相关片段，已使用 LLM 生成针对性的动态系统提示词'] : ['没有找到相关片段'],
          shouldUpdateSystemPrompt: fragmentIds.length > 0, // 如果有片段，标记需要更新
        },
      };
    } catch (error) {
      console.error('[BuildSystemPromptTool] ❌ 系统提示词构建失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
});
