import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 获取节点类型信息的参数 Schema
 */
export const getNodeTypeInfoParamsSchema = z.object({
  nodeType: z.enum(['text', 'image', 'video', 'audio', 'music', 'group']).describe('节点类型'),
});

export type GetNodeTypeInfoParams = z.infer<typeof getNodeTypeInfoParamsSchema>;

export const getNodeTypeInfoSchema: ToolDefinition = {
  name: 'get_node_type_info',
  description: '获取指定节点类型的详细信息，包括可用模型和参数配置',
  displayName: {
    en: 'Get Node Type Info',
    'zh-CN': '获取节点类型信息',
    'zh-TW': '獲取節點類型資訊',
    ja: 'ノードタイプ情報を取得',
    ko: '노드 타입 정보 가져오기',
  },
  parameters: zodToJsonSchema(getNodeTypeInfoParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'canvas',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
    },
  },
};

