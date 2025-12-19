import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';

export const updateNoteTitleDefinition: ToolDefinition = {
  name: 'update_note_title',
  description: '更新笔记的标题。当用户要求修改标题时使用此工具。',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: '新的笔记标题',
      },
    },
    required: ['title'],
  },
  runtime: ToolRuntime.SERVER,
};

