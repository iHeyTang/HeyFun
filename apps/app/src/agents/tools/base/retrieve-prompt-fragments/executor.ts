import { ToolContext } from '../../context';
import { retrievePromptFragmentsParamsSchema } from './schema';
import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { prisma } from '@/lib/server/prisma';
import { vectorManager, isVectorIndexAvailable, extractSnippetIdFromVectorId } from '@/lib/server/vector';
import type { VectorProvider } from '@/lib/server/vector/types';
import { generateEmbedding } from '@/lib/server/embeddings';
import type { ChatClient } from '@repo/llm/chat';

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
    console.error('[RetrievePromptFragmentsTool] ❌ 查询扩展失败，使用原始查询:', error);
    return queryText;
  }
}

/**
 * 向量搜索
 */
async function searchByVector(queryText: string, topK: number = 20, llmClient?: ChatClient): Promise<string[]> {
  const provider = getSnippetVectorProvider();

  if (!provider || !provider.isAvailable()) {
    return [];
  }

  try {
    // 使用 LLM 扩展查询文本以提高语义匹配准确性
    const expandedQueryText = await expandQueryText(queryText, llmClient);
    const queryEmbedding = await generateEmbedding(expandedQueryText);
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
  llmClient?: ChatClient,
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

  // 如果没有提供 llmClient，直接返回前 maxFragments 个候选片段
  if (!llmClient) {
    return {
      fragmentIds: candidateFragmentIds.slice(0, maxFragments),
      confidence: 0.5,
      reasons: ['未提供 LLM 客户端，直接返回前几个候选片段'],
    };
  }

  try {
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

/**
 * 使用 LLM 根据检索到的片段和用户意图生成动态系统提示词
 * 与 initialize_agent 中的 generateDynamicSystemPrompt 共享逻辑
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
  const prompt = `你是一个系统提示词生成专家。根据用户的问题和检索到的相关片段，生成一段针对当前任务的系统提示词。

**用户问题**：
${userMessage}

**用户意图**：
${intentInfo}

**检索到的参考提示词片段**：
${fragmentsInfo}

**核心任务**：
请深入分析上述参考片段的模板结构、表达方式和组织逻辑，然后生成一段针对用户当前任务的系统提示词。

**生成要求**：

1. **学习模板结构**：
   - 仔细分析参考片段使用的章节划分方式（如 ##、###、<section> 等）
   - 学习其列表结构（有序列表、无序列表、嵌套列表等）
   - 参考其使用的强调方式（加粗、引用、代码块等）

2. **模仿表达风格**：
   - 观察参考片段的语气和措辞（指令式、描述式、对话式等）
   - 学习其细节程度和解释深度
   - 参考其使用的示例和例证方式

3. **保持内容丰富**：
   - 生成的提示词应该详尽具体，不要过于简略
   - 包含必要的规则、约束、流程步骤等
   - 如果参考片段包含示例，生成的内容也应包含针对性的示例

4. **定制化适配**：
   - 将参考片段中的通用原则转化为针对用户具体任务的指导
   - 根据用户任务的特点，调整重点和详略
   - 保留与任务高度相关的细节，适度简化低相关性内容

5. **输出要求**：
   - 直接输出生成的系统提示词内容
   - 不要添加"以下是生成的提示词"等前言
   - 不要使用代码块包裹
   - 不要在末尾添加解释或说明

**输出**：
`;

  // 如果没有 LLM 客户端，回退到简单拼接方式
  if (!llmClient) {
    console.warn('[RetrievePromptFragmentsTool] LLM 客户端不可用，使用简单拼接方式');
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
          content:
            '你是一个专业的系统提示词生成专家。你擅长分析优质提示词的模板结构、表达风格和组织方式，并能基于这些参考生成同等质量的定制化提示词。你生成的提示词既保持了参考片段的专业水准和细节程度，又能精准适配用户的具体任务需求。',
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
      console.warn('[RetrievePromptFragmentsTool] ⚠️ 生成的系统提示词可能因为 token 限制而被截断，建议增加 max_tokens');
    }

    return generatedPrompt;
  } catch (error) {
    console.error('[RetrievePromptFragmentsTool] ❌ LLM 生成失败，使用简单拼接方式:', error);
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

export const retrievePromptFragmentsExecutor = definitionToolExecutor(retrievePromptFragmentsParamsSchema, async (args, context) => {
  return await context.workflow.run(`toolcall-${context.toolCallId || 'retrieve-fragments'}`, async () => {
    try {
      const { userMessage, intent, maxFragments = 5, updateSystemPrompt = false, retrievalReason } = args;

      // 提取关键词
      const keywords = extractKeywords(intent, userMessage);

      // 构建向量搜索查询文本
      const vectorQueryText = intent ? `${userMessage} ${intent.primaryGoal || ''} ${intent.taskType || ''}`.trim() : userMessage;

      // 并行执行多种检索策略
      const provider = getSnippetVectorProvider();
      const vectorIndexAvailable = provider?.isAvailable() ?? false;

      const [tagResults, keywordResults, vectorResults] = await Promise.all([
        searchByTags(keywords),
        searchByKeywords(keywords),
        vectorIndexAvailable ? searchByVector(vectorQueryText, 20, context.llmClient) : Promise.resolve([]),
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
      const selectionResult = await selectFragmentsWithLLM(userMessage, intent, candidateFragmentIds, maxFragments, context.llmClient);

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

      // 如果启用了动态系统提示词更新，生成并更新提示词
      let dynamicSystemPrompt: string | undefined = undefined;
      if (updateSystemPrompt && selectionResult.fragmentIds.length > 0) {
        dynamicSystemPrompt = await generateDynamicSystemPrompt(userMessage, intent, selectionResult.fragmentIds, context.llmClient);
        if (dynamicSystemPrompt && context.dynamicSystemPrompt) {
          context.dynamicSystemPrompt.setDynamicSystemPrompt(dynamicSystemPrompt);
        }
      }

      // 构建检索原因
      const finalReasons = [...selectionResult.reasons];
      if (retrievalReason) {
        finalReasons.unshift(retrievalReason);
      }

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
          reasons: finalReasons,
          retrievalReason: retrievalReason || (selectionResult.reasons.length > 0 ? selectionResult.reasons[0] : undefined),
          dynamicSystemPrompt: dynamicSystemPrompt || undefined,
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
});
