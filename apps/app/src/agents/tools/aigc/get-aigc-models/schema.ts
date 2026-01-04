import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 获取AIGC模型的参数 Schema
 */
export const getAigcModelsParamsSchema = z.object({
  generationType: z
    .enum([
      'text-to-image',
      'image-to-image',
      'text-to-video',
      'image-to-video',
      'video-to-video',
      'keyframe-to-video',
      'text-to-speech',
      'speech-to-text',
      'lip-sync',
      'music',
    ])
    .optional()
    .describe('生成类型（可选），用于过滤模型。如果不提供，返回所有模型'),
});

export type GetAigcModelsParams = z.infer<typeof getAigcModelsParamsSchema>;

export const getAigcModelsSchema: ToolDefinition = {
  name: 'get_aigc_models',
  description: '获取所有可用的AIGC模型列表及其参数信息。可以按生成类型（如text-to-image、text-to-video等）过滤模型。',
  displayName: {
    en: 'Get AIGC Models',
    'zh-CN': '获取AIGC模型',
    'zh-TW': '獲取AIGC模型',
    ja: 'AIGCモデルを取得',
    ko: 'AIGC 모델 가져오기',
  },
  parameters: zodToJsonSchema(getAigcModelsParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'aigc',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      models: {
        type: 'array',
        description: '模型列表',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '模型名称（用于调用生成工具）' },
            provider: { type: 'string', description: '提供商名称' },
            displayName: { type: 'string', description: '显示名称' },
            description: { type: 'string', description: '模型描述' },
            costDescription: { type: 'string', description: '费用说明' },
            generationTypes: {
              type: 'array',
              items: { type: 'string' },
              description: '支持的生成类型列表',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: '标签列表',
            },
            paramsSchema: {
              type: 'object',
              description: '参数Schema（JSON Schema格式）',
            },
          },
        },
      },
      count: { type: 'number', description: '模型数量' },
      generationType: { type: 'string', description: '过滤的生成类型（如果提供了）' },
    },
  },
};

