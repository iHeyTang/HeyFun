import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';

export const updateNoteContentDefinition: ToolDefinition = {
  name: 'update_note_content',
  description: '更新笔记的正文内容。用于整体替换笔记内容，适用于大幅修改或重写场景。',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: '新的笔记正文内容（Markdown 格式）',
      },
    },
    required: ['content'],
  },
  runtime: ToolRuntime.SERVER,
};

