import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';

export const getCurrentNoteSchema: ToolDefinition = {
  name: 'get_current_note',
  description: '获取指定笔记的完整内容，包括标题和正文。在修改笔记前，应该先使用此工具了解笔记的当前状态。',
  parameters: {
    type: 'object',
    properties: {
      noteId: {
        type: 'string',
        description: '笔记ID',
      },
    },
    required: ['noteId'],
  },
  runtime: ToolRuntime.SERVER,
};

