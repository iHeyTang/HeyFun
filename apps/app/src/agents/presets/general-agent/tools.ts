import { baseToolboxes, sandboxToolboxes } from '@/agents/tools';
import { UnifiedChat } from '@repo/llm/chat';

export default function getTools() {
  // 合并核心工具和 sandbox 工具
  const allTools = [...baseToolboxes, ...sandboxToolboxes];

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
