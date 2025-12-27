import { aigcToolboxes, baseToolboxes, amapToolboxes, webSearchToolboxes } from '@/agents/tools';
import { UnifiedChat } from '@repo/llm/chat';

export default function getTools() {
  const tools: UnifiedChat.Tool[] = [
    ...baseToolboxes.map(tool => tool.schema),
    ...aigcToolboxes.map(tool => tool.schema),
    ...webSearchToolboxes.map(tool => tool.schema),
    ...amapToolboxes.map(tool => tool.schema),
  ].flatMap(definition => {
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
