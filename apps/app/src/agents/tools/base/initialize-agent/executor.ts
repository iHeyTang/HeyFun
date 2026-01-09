import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { generateEmbedding } from '@/lib/server/embeddings';
import { prisma } from '@/lib/server/prisma';
import { extractSnippetIdFromVectorId, vectorManager } from '@/lib/server/vector';
import type { VectorProvider } from '@/lib/server/vector/types';
import type { ChatClient } from '@/llm/chat';
import { initializeAgentParamsSchema } from './schema';
import { ToolManager } from '../../context';

/**
 * 获取用于片段检索的向量库提供者
 */
function getSnippetVectorProvider(): VectorProvider | undefined {
  const providers = vectorManager.getAllProviders();
  return providers.find((p: VectorProvider) => p.name === 'prompt-snippets');
}

/**
 * 使用 LLM 清洗查询文本，将自然语言查询转换为适合 RAG 检索的关键词
 * 返回清洗后的查询文本和详细的关键词列表
 * 增强版：包含信息维度验证和后处理步骤
 */
async function cleanQueryText(queryText: string, llmClient?: ChatClient): Promise<{ cleanedText: string; keywords?: string[] }> {
  // 如果没有提供 llmClient，直接使用原始查询文本
  if (!llmClient) {
    return { cleanedText: queryText };
  }

  try {
    const prompt = `你是一个查询分析和关键词提取专家。使用多角度分析的方式，从不同维度提取关键词，以支持更丰富的检索方向。

用户查询：${queryText}

**提取策略**：
从 3-5 个不同角度分析查询，每个角度提取 3-5 个关键词，确保覆盖多个检索方向。

**可选的分析角度**（根据查询特点选择 3-5 个最相关的角度）：
1. **核心主题**：查询的核心概念、主要话题、核心实体
2. **技术实现**：涉及的技术、工具、方法、平台
3. **应用场景**：使用场景、应用环境、实际用途
4. **相关领域**：相关行业、上下游、配套服务、横向关联
5. **隐含需求**：未明确提及但逻辑上相关的需求、前置条件、后续步骤
6. **同义变体**：同义词、缩写、全称、不同表达方式
7. **具体实例**：具体的例子、品牌、型号、工具名称

**提取要求**：
- 选择 3-5 个最相关的角度
- 每个角度提取 3-5 个关键词（不要过多）
- 关键词要精准、相关，避免冗余
- **避免同义词重复**：不要同时包含"时间"和"当前时间"、"手机"和"智能手机"这种包含关系的词，只保留更具体或更通用的一个
- 确保不同角度覆盖不同的检索方向

**语义理解规则**（识别概念组合的隐含需求）：
当查询中出现特定概念组合时，要识别并添加相关的隐含概念：
- **时间 + 国家/地区** → 时区、时差、当地时间
- **旅游 + 国家/地区** → 签证、护照、跨境、国际旅行、语言、货币
- **学习 + 语言** → 语法、词汇、练习、教材、口语、听力
- **购买 + 电子产品** → 保修、售后、评测、对比、价格、性能
- **工作 + 远程** → 网络、设备、协作工具、时间管理、沟通
- **运动 + 户外** → 天气、安全、装备、环境、防护
- **投资 + 股票/基金** → 风险、收益、市场分析、策略、监管
- **租房 + 城市** → 交通、生活成本、区域、配套设施、合同
- **留学 + 国家** → 签证、语言、文化、费用、申请、学历认证
- **创业 + 行业** → 市场、竞争、资金、团队、法律、商业模式
- **健康 + 疾病** → 治疗、预防、检查、药物、医生、医院
- **教育 + 年龄** → 课程、方法、发展、评估、适应
- **旅行 + 季节** → 天气、装备、活动、价格、预订
- **购物 + 节日** → 促销、礼品、预算、配送、退换
- **运动 + 水上** → 安全、装备、天气、潮汐、教练
- **学习 + 技能** → 练习、实践、工具、资源、评估
- **购买 + 大件商品** → 配送、安装、保修、分期、对比
- **咨询 + 规划/决策** → 方法论、理论框架、相关概念、案例分析、最佳实践、评估工具

**输出格式**：**必须**以有效的 JSON 格式输出，包含两个字段：
- cleanedText: 字符串类型，清洗后的关键词文本（用空格分隔，不包含换行符）
- keywords: 字符串数组类型，包含所有提取的关键词（从多个角度提取，总共约 15-25 个关键词）

**重要要求**：
- 输出的 JSON 必须是有效的、可解析的格式
- cleanedText 字段的值必须是单行文本，不包含换行符
- keywords 字段必须是字符串数组，每个元素都是有效的字符串
- 不要添加任何代码块标记（如 \`\`\`json）
- 不要添加任何说明文字或注释
- 确保 JSON 格式完整且正确
- **从 3-5 个角度提取，每个角度 3-5 个关键词，总共约 15-25 个关键词**
- **严格避免同义词重复**：不要同时包含包含关系的词（如"时间"和"当前时间"、"手机"和"智能手机"），只保留更具体或更通用的一个
- **应用语义理解规则**：识别概念组合的隐含需求，如"时间+国家"→时区、"旅游+国家"→签证等

示例（展示多角度提取方式，按类别组织）：

输入："我想学英语"
语义理解：学习+语言 → 语法、词汇、练习
分析角度：
- 核心主题：英语、学习
- 应用场景：语言学习、交流
- 隐含需求：语法、词汇、练习、口语
输出：{"cleanedText": "英语 学习", "keywords": ["英语", "学习", "语言学习", "语法", "词汇", "练习", "口语", "听力", "教材", "交流"]}

输入："购买手机"
语义理解：购买+电子产品 → 保修、售后、评测
分析角度：
- 核心主题：手机、移动设备
- 技术实现：操作系统、性能、摄像头
- 应用场景：通讯、娱乐、工作
- 隐含需求：保修、售后、评测、对比
输出：{"cleanedText": "手机 购买", "keywords": ["手机", "移动设备", "操作系统", "性能", "摄像头", "通讯", "娱乐", "工作", "保修", "售后", "评测", "对比", "品牌", "型号"]}

输入："我想了解一下怎么用Python写一个爬虫程序"
语义理解：编程+数据采集 → 数据分析、存储、处理
分析角度：
- 核心主题：Python、爬虫、数据采集
- 技术实现：HTTP、HTML解析、数据提取、存储
- 应用场景：数据采集、自动化、数据分析
- 相关工具：反爬虫、代理、数据库、可视化
输出：{"cleanedText": "Python 爬虫 程序 编写", "keywords": ["Python", "爬虫", "数据采集", "HTTP", "HTML解析", "数据提取", "自动化", "反爬虫", "代理", "存储", "数据库", "数据分析", "程序", "编写"]}

输入："我想咨询一下如何进行职业规划"
语义理解：咨询+职业规划 → 方法论、理论框架、相关概念
分析角度：
- 核心主题：职业规划、咨询
- 应用场景：职业发展、人生规划
- 相关方法论：职业评估、目标设定、路径规划
- 相关概念：能力模型、职业锚、行业分析、市场趋势
输出：{"cleanedText": "职业规划 咨询", "keywords": ["职业规划", "咨询", "职业发展", "人生规划", "职业评估", "目标设定", "路径规划", "能力模型", "职业锚", "行业分析", "市场趋势", "职业咨询", "方法论", "理论框架"]}

输入："我想去泰国旅游"
语义理解：旅游+国家 → 签证、护照、跨境
分析角度：
- 核心主题：旅游、泰国
- 应用场景：国际旅行、跨境
- 隐含需求：签证、护照、语言、货币
输出：{"cleanedText": "泰国 旅游 跨境", "keywords": ["泰国", "旅游", "国际旅行", "跨境", "签证", "护照", "语言", "货币", "行程", "文化"]}

**请严格按照上述格式输出，只输出 JSON 对象，不要添加任何其他内容：**`;

    const response = await llmClient.chat({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1,
    });

    const choice = response.choices?.[0];
    const content = choice?.message?.content || '';
    const contentStr = typeof content === 'string' ? content.trim() : String(content).trim();

    // 解析 JSON 响应
    const { extractJsonFromText } = await import('@/lib/shared/json');
    const parsed = extractJsonFromText<{ cleanedText: string; keywords: string[] }>(contentStr, true);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`JSON 解析失败，原始内容: ${contentStr.substring(0, 200)}`);
    }

    if (typeof parsed.cleanedText !== 'string' || !parsed.cleanedText.trim()) {
      throw new Error(`cleanedText 字段无效，原始内容: ${contentStr.substring(0, 200)}`);
    }

    if (!Array.isArray(parsed.keywords) || parsed.keywords.length === 0) {
      throw new Error(`keywords 字段无效，原始内容: ${contentStr.substring(0, 200)}`);
    }

    const cleanedText = parsed.cleanedText.trim().replace(/\s+/g, ' ');
    const keywords = parsed.keywords
      .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
      .map(k => k.trim())
      .filter((k, index, arr) => arr.indexOf(k) === index);

    return { cleanedText, keywords };
  } catch (error) {
    console.error('[InitializeAgentTool] ❌ 查询清洗失败，使用原始查询:', error);
    throw error; // 直接抛出错误，不进行 fallback
  }
}

/**
 * 向量搜索
 */
async function searchByVector(
  queryText: string,
  topK: number = 20,
  llmClient?: ChatClient,
): Promise<{ fragmentIds: string[]; cleanedQuery?: string; keywords?: string[] }> {
  const provider = getSnippetVectorProvider();
  if (!provider) {
    throw new Error('向量库提供者未找到：prompt-snippets');
  }
  if (!provider.isAvailable()) {
    throw new Error('向量库提供者不可用：prompt-snippets');
  }

  // 使用 LLM 清洗查询文本，转换为适合 RAG 检索的关键词
  const { cleanedText, keywords } = await cleanQueryText(queryText, llmClient);
  const queryEmbedding = await generateEmbedding(cleanedText);
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
  return {
    fragmentIds: enabledSnippetIds,
    cleanedQuery: cleanedText !== queryText ? cleanedText : undefined,
    keywords,
  };
}

/**
 * 使用 LLM 根据检索到的片段和用户消息生成动态系统提示词
 */
async function generateDynamicSystemPrompt(userMessage: string, fragmentIds: string[], llmClient?: ChatClient): Promise<string> {
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

  // 构建 LLM 提示词
  const prompt = `你是一个系统提示词生成专家。根据用户的问题和检索到的相关片段，生成一段针对当前任务的系统提示词。

**用户问题**：
${userMessage}

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
    console.warn('[InitializeAgentTool] LLM 客户端不可用，使用简单拼接方式');
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
      console.warn('[InitializeAgentTool] ⚠️ 生成的系统提示词可能因为 token 限制而被截断，建议增加 max_tokens');
    }

    return generatedPrompt;
  } catch (error) {
    console.error('[InitializeAgentTool] ❌ LLM 生成失败，使用简单拼接方式:', error);
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

/**
 * 构建向量搜索查询文本
 */
function buildVectorQueryText(userMessage: string): string {
  return userMessage;
}

/**
 * 获取片段的详细信息
 */
async function getFragmentDetails(fragmentIds: string[]): Promise<Array<{ id: string; name: string; description: string }>> {
  if (fragmentIds.length === 0) {
    return [];
  }

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

  return fragments;
}

/**
 * 设置动态系统提示词到上下文
 */
function setDynamicSystemPrompt(
  dynamicSystemPrompt: string | undefined,
  dynamicSystemPromptManager?: { setDynamicSystemPrompt: (prompt: string) => void },
): void {
  if (dynamicSystemPrompt && dynamicSystemPromptManager) {
    dynamicSystemPromptManager.setDynamicSystemPrompt(dynamicSystemPrompt);
  }
}

/**
 * 清除动态系统提示词
 */
function clearDynamicSystemPrompt(dynamicSystemPromptManager?: { clearDynamicSystemPrompt: () => void }): void {
  if (dynamicSystemPromptManager) {
    dynamicSystemPromptManager.clearDynamicSystemPrompt();
  }
}

/**
 * 检索相关工具
 * @param query 查询文本（优先使用已清洗的查询文本，复用提示词检索的关键词提取结果）
 * @param llmClient LLM 客户端
 * @param toolManager 工具管理器
 * @param builtinToolNames 内置工具名称列表（不参与检索）
 */
async function retrieveTools(
  query: string,
  llmClient?: ChatClient,
  toolManager?: ToolManager,
  builtinToolNames?: string[],
): Promise<Array<{ name: string; description: string; category?: string; manual?: string }>> {
  try {
    // 延迟导入 search-tools 的执行逻辑，避免循环依赖
    const { toolRegistry } = await import('@/agents/tools');
    const allToolSchemas = toolRegistry.getAllToolSchemas();

    // 内置工具列表（从 preset 层传入，默认为空）
    const builtinTools = builtinToolNames || [];

    // 过滤掉内置工具，只检索可动态挂载的工具
    const dynamicToolSchemas = allToolSchemas.filter(schema => !builtinTools.includes(schema.name));
    const dynamicToolSummaries = dynamicToolSchemas.map(schema => ({
      name: schema.name,
      description: schema.description,
      category: schema.category,
    }));

    if (dynamicToolSummaries.length === 0) {
      console.warn('[InitializeAgentTool] ⚠️ 没有可检索的动态工具');
      return [];
    }

    const keyword = query;
    const maxTools = 10; // 默认最多检索10个工具

    // 使用 LLM 检索工具
    if (!llmClient || typeof llmClient.chat !== 'function') {
      throw new Error('LLM 客户端不可用，无法检索工具');
    }

    const toolsList = dynamicToolSummaries.map(tool => `- **${tool.name}** (${tool.category || '未分类'}): ${tool.description}`).join('\n');

    const prompt = `你是一个工具检索助手。根据用户的需求，从以下工具列表中选择最相关的工具。

**用户需求**：
${keyword}

**可用工具列表**：
${toolsList}

**任务**：
请根据用户需求，选择最相关的工具。要求：
1. 只返回工具名称列表，用 JSON 数组格式，例如：["tool1", "tool2", "tool3"]
2. 最多选择 ${maxTools} 个工具
3. 按相关性从高到低排序
4. 只返回工具名称，不要添加任何说明或解释

直接输出 JSON 数组：`;

    const response = await llmClient.chat({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 20000,
    });

    const choice = response.choices?.[0];
    const content = choice?.message?.content || '';
    const contentStr =
      typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content.map(c => (typeof c === 'string' ? c : c.type === 'text' ? c.text : '')).join('')
          : String(content);

    // 解析 JSON
    const { extractJsonFromText } = await import('@/lib/shared/json');
    const extracted = extractJsonFromText<string[]>(contentStr, true);

    if (!extracted || !Array.isArray(extracted)) {
      throw new Error(`JSON 解析失败，原始内容: ${contentStr.substring(0, 300)}`);
    }

    const selectedToolNames = extracted.filter((name): name is string => typeof name === 'string' && name.trim().length > 0);

    // 获取选中工具的完整信息（只从动态工具中查找，排除内置工具）
    const retrievedTools = selectedToolNames
      .filter(name => !builtinTools.includes(name)) // 再次过滤，确保不会误选内置工具
      .map(name => {
        const schema = dynamicToolSchemas.find(s => s.name === name);
        if (!schema) {
          console.warn(`[InitializeAgentTool] ⚠️ 工具 "${name}" 在动态工具中未找到`);
          return null;
        }
        return {
          name: schema.name,
          description: schema.description,
          category: schema.category,
          manual: schema.manual,
        };
      })
      .filter((tool): tool is NonNullable<typeof tool> => tool !== null);

    if (retrievedTools.length !== selectedToolNames.length) {
      console.warn(`[InitializeAgentTool] ⚠️ 部分工具未找到: 选择了 ${selectedToolNames.length} 个，实际找到 ${retrievedTools.length} 个`);
    }

    // 使用 toolManager 将检索到的工具添加到 agent 的工具列表
    if (retrievedTools.length > 0 && toolManager) {
      const toolNames = retrievedTools.map(t => t.name);
      try {
        toolManager.addToolsByName(toolNames);
      } catch (error) {
        console.error('[InitializeAgentTool] ❌ 装载工具失败:', error);
      }
    }

    return retrievedTools;
  } catch (error) {
    console.error('[InitializeAgentTool] ❌ 工具检索失败:', error);
    return [];
  }
}

/**
 * 构建返回数据（无片段情况）
 */
function buildNoFragmentsResult(
  originalQuery: string,
  cleanedQuery?: string,
  keywords?: string[],
  retrievedTools?: Array<{ name: string; description: string; category?: string; manual?: string }>,
): {
  success: true;
  data: {
    fragmentIds: string[];
    fragments: never[];
    dynamicSystemPrompt: undefined;
    confidence: number;
    reasons: string[];
    shouldUpdateSystemPrompt: boolean;
    tools?: Array<{ name: string; description: string; category?: string; manual?: string }>;
    originalQuery: string;
    cleanedQuery?: string;
    keywords?: string[];
  };
} {
  const tools = retrievedTools || [];
  return {
    success: true,
    data: {
      fragmentIds: [],
      fragments: [],
      dynamicSystemPrompt: undefined,
      confidence: 0,
      reasons: ['没有找到相关片段，已清除动态系统提示词', ...(tools.length > 0 ? [`检索到 ${tools.length} 个相关工具并已添加到可用工具列表`] : [])],
      shouldUpdateSystemPrompt: false,
      tools: tools.length > 0 ? tools : undefined,
      originalQuery,
      cleanedQuery,
      keywords,
    },
  };
}

/**
 * 构建返回数据（有片段情况）
 */
function buildSuccessResult(
  fragmentIds: string[],
  fragments: Array<{ id: string; name: string; description: string }>,
  dynamicSystemPrompt: string | undefined,
  retrievedTools: Array<{ name: string; description: string; category?: string; manual?: string }>,
  originalQuery: string,
  cleanedQuery?: string,
  keywords?: string[],
): {
  success: true;
  data: {
    fragmentIds: string[];
    fragments: Array<{ id: string; name: string; description: string }>;
    dynamicSystemPrompt: string | undefined;
    confidence: number;
    reasons: string[];
    shouldUpdateSystemPrompt: boolean;
    tools?: Array<{ name: string; description: string; category?: string; manual?: string }>;
    originalQuery: string;
    cleanedQuery?: string;
    keywords?: string[];
  };
} {
  return {
    success: true,
    data: {
      fragmentIds,
      fragments: fragments.map(f => ({
        id: f.id,
        name: f.name,
        description: f.description,
      })),
      dynamicSystemPrompt: dynamicSystemPrompt || undefined,
      confidence: fragmentIds.length > 0 ? 0.8 : 0,
      reasons: [
        ...(fragmentIds.length > 0 ? ['从向量库检索相关片段，已使用 LLM 生成针对性的动态系统提示词'] : ['没有找到相关片段']),
        ...(retrievedTools.length > 0 ? [`检索到 ${retrievedTools.length} 个相关工具并已添加到可用工具列表`] : []),
      ],
      shouldUpdateSystemPrompt: fragmentIds.length > 0,
      tools: retrievedTools.length > 0 ? retrievedTools : undefined,
      originalQuery,
      cleanedQuery,
      keywords,
    },
  };
}

/**
 * Agent 初始化执行器
 * 负责整个流程的编排
 */
export const initializeAgentExecutor = definitionToolExecutor(initializeAgentParamsSchema, async (args, context) => {
  return await context.workflow.run(`toolcall-${context.toolCallId || 'initialize-agent'}`, async () => {
    try {
      const { userMessage, maxFragments = 10, basePrompt } = args;

      // 阶段 1: 构建向量搜索查询文本
      const vectorQueryText = buildVectorQueryText(userMessage);

      // 阶段 2: 从向量库检索片段
      const searchResult = await searchByVector(vectorQueryText, maxFragments * 2, context.llmClient);
      const fragmentIds = searchResult.fragmentIds.slice(0, maxFragments);
      const cleanedQuery = searchResult.cleanedQuery;
      const keywords = searchResult.keywords;

      // 阶段 3: 检索相关工具 - 无论是否找到片段都要检索工具（复用提示词检索的关键词提取结果）
      const toolSearchQuery = cleanedQuery || userMessage; // 优先使用已清洗的查询文本
      const retrievedTools = await retrieveTools(toolSearchQuery, context.llmClient, context.toolManager, context.builtinToolNames);

      // 阶段 4: 处理无片段情况
      if (fragmentIds.length === 0) {
        clearDynamicSystemPrompt(context.dynamicSystemPrompt);
        return buildNoFragmentsResult(vectorQueryText, cleanedQuery, keywords, retrievedTools);
      }

      // 阶段 5: 获取片段详细信息
      const fragments = await getFragmentDetails(fragmentIds);

      // 阶段 6: 生成动态系统提示词
      const dynamicSystemPrompt = await generateDynamicSystemPrompt(userMessage, fragmentIds, context.llmClient);

      // 阶段 7: 设置动态系统提示词到上下文
      setDynamicSystemPrompt(dynamicSystemPrompt, context.dynamicSystemPrompt);

      // 阶段 8: 构建并返回结果
      return buildSuccessResult(fragmentIds, fragments, dynamicSystemPrompt, retrievedTools, vectorQueryText, cleanedQuery, keywords);
    } catch (error) {
      console.error('[InitializeAgentTool] ❌ Agent 初始化失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
});
