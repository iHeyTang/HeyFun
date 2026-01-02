import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import { searchToolsParamsSchema } from './schema';

export const searchToolsExecutor = definitionToolExecutor(searchToolsParamsSchema, async (args, context) => {
  try {
    const { keyword, category, maxResults = 10 } = args;

    // 延迟导入 toolRegistry 以避免循环依赖
    const { toolRegistry } = await import('@/agents/tools');

    // 获取所有工具的简要信息
    const allTools = toolRegistry.getAllToolSummaries();
    const allToolSchemas = toolRegistry.getAllToolSchemas();

    // 如果没有 LLM 客户端，使用简单的字符串匹配作为回退
    if (!context.llmClient) {
      const filtered = allTools.filter(tool => {
        if (category && tool.category !== category) return false;
        if (keyword) {
          const keywordLower = keyword.toLowerCase();
          return (
            tool.name.toLowerCase().includes(keywordLower) ||
            tool.description.toLowerCase().includes(keywordLower) ||
            tool.category?.toLowerCase().includes(keywordLower)
          );
        }
        return true;
      });

      const tools = filtered.slice(0, maxResults).map(tool => {
        const schema = allToolSchemas.find(s => s.name === tool.name);
        return {
          name: tool.name,
          description: tool.description,
          category: tool.category,
          manual: schema?.manual,
        };
      });

      return {
        success: true,
        data: {
          tools,
          total: tools.length,
        },
      };
    }

    // 使用 LLM 检索工具
    const toolsList = allTools.map(tool => `- **${tool.name}** (${tool.category || '未分类'}): ${tool.description}`).join('\n');

    const prompt = `你是一个工具检索助手。根据用户的需求，从以下工具列表中选择最相关的工具。

**用户需求**：
${keyword ? `关键词：${keyword}` : '无特定关键词'}
${category ? `分类：${category}` : ''}

**可用工具列表**：
${toolsList}

**任务**：
请根据用户需求，选择最相关的工具。要求：
1. 只返回工具名称列表，用 JSON 数组格式，例如：["tool1", "tool2", "tool3"]
2. 最多选择 ${maxResults} 个工具
3. 按相关性从高到低排序
4. 只返回工具名称，不要添加任何说明或解释

直接输出 JSON 数组：`;

    const response = await context.llmClient.chat({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const choice = response.choices?.[0];
    const content = choice?.message?.content || '';
    const contentStr =
      typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content.map(c => (typeof c === 'string' ? c : c.type === 'text' ? c.text : '')).join('')
          : String(content);
    let selectedToolNames: string[] = [];

    try {
      // 使用工具函数提取 JSON 数组
      const { extractJsonFromText } = await import('@/lib/shared/json');
      const extracted = extractJsonFromText<string[]>(contentStr, true);
      if (extracted && Array.isArray(extracted)) {
        selectedToolNames = extracted;
      }
    } catch (error) {
      console.error('[SearchTools] ❌ 解析 LLM 返回的工具列表失败:', error);
      // 回退到简单匹配
      const filtered = allTools.filter(tool => {
        if (category && tool.category !== category) return false;
        if (keyword) {
          const keywordLower = keyword.toLowerCase();
          return tool.name.toLowerCase().includes(keywordLower) || tool.description.toLowerCase().includes(keywordLower);
        }
        return true;
      });
      selectedToolNames = filtered.slice(0, maxResults).map(t => t.name);
    }

    // 获取选中工具的完整信息
    const tools = selectedToolNames
      .map(name => {
        const schema = allToolSchemas.find(s => s.name === name);
        if (!schema) return null;
        return {
          name: schema.name,
          description: schema.description,
          category: schema.category,
          manual: schema.manual,
        };
      })
      .filter((tool): tool is NonNullable<typeof tool> => tool !== null);

    // 使用 toolManager 将检索到的工具添加到 agent 的工具列表
    if (context.toolManager && tools.length > 0) {
      const toolNames = tools.map(t => t.name);
      context.toolManager.addToolsByName(toolNames);
    }

    return {
      success: true,
      data: {
        tools,
        total: tools.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});
