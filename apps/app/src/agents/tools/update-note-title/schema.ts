import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';

export const updateNoteTitleSchema: ToolDefinition = {
  name: 'update_note_title',
  description: '更新笔记的标题。当用户要求修改标题时使用此工具。',
  parameters: {
    type: 'object',
    properties: {
      noteId: {
        type: 'string',
        description: '笔记ID',
      },
      title: {
        type: 'string',
        description: '新的笔记标题',
      },
    },
    required: ['noteId', 'title'],
  },
  runtime: ToolRuntime.SERVER,
};

