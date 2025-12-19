import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';

export const getCurrentNoteDefinition: ToolDefinition = {
  name: 'get_current_note',
  description: '获取当前正在编辑的笔记的完整内容，包括标题和正文。在修改笔记前，应该先使用此工具了解笔记的当前状态。',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  runtime: ToolRuntime.SERVER,
};
