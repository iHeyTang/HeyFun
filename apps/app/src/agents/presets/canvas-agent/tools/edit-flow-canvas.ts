import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';

export const editFlowCanvasDefinition: ToolDefinition = {
  name: 'edit_flow_canvas',
  description:
    '编辑工作流画布。支持创建新工作流、修改现有节点和连接、删除节点和连接。每次调用应尽可能完成所有需要的修改，而不是分次调用。例如：创建完整工作流时传入完整的 nodes 和 edges；修改时传入所有需要修改的节点和边。',
  parameters: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['replace', 'merge'],
        description: '更新模式：replace 表示完全替换画布（用于创建新工作流），merge 表示合并更新（用于修改现有工作流）。默认为 merge。',
        default: 'merge',
      },
      nodes: {
        type: 'array',
        description:
          '节点列表。在 replace 模式下，这会完全替换所有节点；在 merge 模式下，这会更新或添加节点（根据节点 ID 匹配）。如果节点没有 ID，会自动生成。',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: '节点 ID。如果不存在，会自动生成。在 merge 模式下，如果 ID 已存在则更新该节点。' },
            type: {
              type: 'string',
              enum: ['text', 'image', 'video', 'audio', 'music', 'group'],
              description: '节点类型',
            },
            position: {
              type: 'object',
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
              },
              description: '节点位置',
            },
            parentId: { type: 'string', description: '父节点 ID（用于 group 节点）' },
            data: {
              type: 'object',
              description: '节点数据',
              properties: {
                label: { type: 'string', description: '节点标签/标题' },
                description: { type: 'string', description: '节点描述' },
                auto: { type: 'boolean', description: '是否自动执行' },
                actionData: {
                  type: 'object',
                  description:
                    '节点动作数据。根据节点类型不同：text 节点使用 text 字段；image/video/music 节点使用 prompt、selectedModel 等；audio 节点使用 prompt、voiceId、selectedModel 等',
                },
              },
            },
          },
        },
      },
      edges: {
        type: 'array',
        description:
          '连接列表。在 replace 模式下，这会完全替换所有连接；在 merge 模式下，这会更新或添加连接（根据连接 ID 或 source/target 匹配）。如果连接没有 ID，会自动生成。',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: '连接 ID。如果不存在，会自动生成。' },
            source: { type: 'string', description: '源节点 ID' },
            target: { type: 'string', description: '目标节点 ID' },
            sourceHandle: { type: 'string', description: '源节点连接点，默认 output', default: 'output' },
            targetHandle: { type: 'string', description: '目标节点连接点，默认 input', default: 'input' },
            type: { type: 'string', description: '连接类型，默认 default', default: 'default' },
          },
          required: ['source', 'target'],
        },
      },
      deleteNodes: {
        type: 'array',
        description: '要删除的节点 ID 列表（仅在 merge 模式下有效）',
        items: { type: 'string' },
      },
      deleteEdges: {
        type: 'array',
        description: '要删除的连接 ID 列表（仅在 merge 模式下有效）',
        items: { type: 'string' },
      },
    },
  },
  runtime: ToolRuntime.CLIENT,
  category: 'canvas',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
    },
  },
};
