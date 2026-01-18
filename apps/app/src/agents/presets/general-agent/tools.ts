import { baseToolboxes, sandboxToolboxes, noteToolboxes } from '@/agents/tools';
import { UnifiedChat } from '@/llm/chat';

export default function getTools() {
  // 合并核心工具、sandbox 工具和笔记工具
  const allTools = [...baseToolboxes, ...sandboxToolboxes, ...noteToolboxes];

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
