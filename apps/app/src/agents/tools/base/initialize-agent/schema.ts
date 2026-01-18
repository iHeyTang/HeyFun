import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 构建系统提示词参数 Schema
 * 使用简短常见的参数名，提高 LLM 生成准确率
 */
export const initializeAgentParamsSchema = z.object({
  message: z.string().describe('Required. 用户的消息内容，用于检索相关的提示词片段'),
});

export type InitializeAgentParams = z.infer<typeof initializeAgentParamsSchema>;

export const initializeAgentSchema: ToolDefinition = {
  name: 'initialize_agent',
  description:
    'Agent 初始化工具 - 仅在需要特定领域知识或新工具时调用。功能：1) 检索与任务相关的提示词片段；2) 生成针对性的动态系统提示词；3) 检索并激活相关工具。**注意：这是开销较大的工具，不要频繁调用。简单任务（搜索、对话、通用问答等）直接使用现有工具即可，无需调用此工具。**',
  displayName: {
    en: 'Initialize Agent',
    'zh-CN': '初始化智能体',
    'zh-TW': '初始化智能體',
    ja: 'エージェントを初期化',
    ko: '에이전트 초기화',
  },
  parameters: zodToJsonSchema(initializeAgentParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'agent',
  manual: `# initialize_agent 工具使用手册

## 功能说明
initialize_agent 用于获取特定领域的专业知识和激活相关工具。它会根据用户消息检索相关的提示词片段，生成针对性的动态系统提示词，并检索和激活适合本次任务的相关工具。

## 何时需要调用
1. **需要特定领域知识**：任务涉及法律、医疗、特定编程框架等专业领域
2. **需要新工具**：当前工具列表中没有能完成任务的工具
3. **任务类型重大变化**：如从"写代码"变成"做旅行规划"

## 何时不需要调用（重要）
1. **简单任务**：搜索、对话、通用问答、翻译、总结等
2. **当前工具足够**：已有工具（如 web_search、generate_image）能完成任务
3. **同一会话继续**：会话中已调用过，且任务类型没有重大变化
4. **追问或补充**：用户只是在追问上一个问题的细节

## 参数说明
- **message**（必填）：用户的消息内容

## 使用原则
1. **能不调用就不调用**：这是开销较大的工具，只有确实需要时才调用
2. **一次会话通常只需调用一次**：除非任务类型发生重大变化
3. **优先使用现有工具**：如果当前工具能完成任务，直接使用

## 示例
- ✅ 需要调用：message="帮我制定一份日本7日旅游计划"（需要跨境旅游专业知识）
- ❌ 不需要调用：message="帮我搜索最新的AI新闻"（直接用 web_search）
- ❌ 不需要调用：message="现在几点了"（直接用 get_current_time）`,
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      dynamicSystemPrompt: {
        type: 'string',
        description: '动态系统提示词片段内容（不包含基础提示词），已自动应用到当前会话',
      },
      fragmentIds: {
        type: 'array',
        items: { type: 'string' },
        description: '使用的片段ID列表',
      },
      fragments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
          },
        },
        description: '使用的片段信息',
      },
      confidence: { type: 'number', description: '构建置信度 (0-1)' },
      reasons: { type: 'array', items: { type: 'string' }, description: '构建原因说明' },
      shouldUpdateSystemPrompt: {
        type: 'boolean',
        description: '是否应该更新系统提示词（工具返回 true 时，系统会自动更新）',
      },
      tools: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '工具名称' },
            description: { type: 'string', description: '工具描述' },
            category: { type: 'string', description: '工具分类' },
            manual: { type: 'string', description: '工具使用手册' },
          },
        },
        description: '检索到的相关工具列表（已自动添加到 agent 的可用工具列表）',
      },
      originalQuery: {
        type: 'string',
        description: '原始查询文本（用户输入的自然语言查询）',
      },
      cleanedQuery: {
        type: 'string',
        description: '清洗后的查询文本（经过 LLM 转换为适合 RAG 检索的关键词）',
      },
      keywords: {
        type: 'array',
        items: { type: 'string' },
        description: '从查询中提取的关键词列表（用于 RAG 检索的核心概念，已自动进行信息维度验证和补充）',
      },
    },
  },
};
