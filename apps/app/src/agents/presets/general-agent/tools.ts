import { baseToolboxes, sandboxToolboxes } from '@/agents/tools';
import { UnifiedChat } from '@repo/llm/chat';

/**
 * 基础工具列表
 * Agent启动时只依赖这些基础工具，其他工具通过search_tools检索获取
 */
const CORE_TOOLS = [
  'search_tools', // 工具检索工具（必须）
  'initialize_agent', // Agent 初始化工具（必须）
  'get_current_time', // 获取当前时间（基础工具）
];

export default function getTools() {
  // 加载核心基础工具
  const coreTools = baseToolboxes.filter(tool => CORE_TOOLS.includes(tool.schema.name));

  // 合并核心工具和 sandbox 工具
  const allTools = [...coreTools, ...sandboxToolboxes];

  const tools: UnifiedChat.Tool[] = allTools
    .map(tool => tool.schema)
    .flatMap(definition => {
      return {
        type: 'function',
        function: {
          name: definition.name,
          description: definition.description,
          parameters: definition.parameters,
        },
      };
    });

  return tools;
}
