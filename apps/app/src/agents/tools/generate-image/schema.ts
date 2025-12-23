import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 生成图片的参数 Schema
 */
export const generateImageParamsSchema = z.object({
  model: z.string().min(1).describe('要使用的AI模型名称。使用get_aigc_models工具查看可用模型列表。'),
  prompt: z.string().min(1).describe('图片生成的提示词，描述你想要生成的图片内容'),
  referenceImage: z
    .array(z.string())
    .optional()
    .describe(
      '参考图片数组（可选），用于图片转图片（image-to-image）生成。可以接受以下格式：1) OSS key格式（oss://fileKey），这是推荐格式，可以直接使用用户上传图片的OSS key，工具会自动处理前缀；2) 完整的HTTP/HTTPS URL；3) Base64数据URL（data:image/...）。如果用户在当前对话中上传了图片，应该使用oss://格式的key，而不是编造URL。',
    ),
  aspectRatio: z.string().optional().describe('图片宽高比（可选），例如：16:9, 1:1, 9:16等'),
  n: z.string().optional().describe('生成图片数量（可选），某些模型支持一次生成多张图片'),
  advanced: z.record(z.any()).optional().describe('高级参数（可选），模型特定的额外参数'),
});

export type GenerateImageParams = z.infer<typeof generateImageParamsSchema>;

export const generateImageSchema: ToolDefinition = {
  name: 'generate_image',
  description: '使用AI模型生成图片。支持文本生成图片（text-to-image）和图片转图片（image-to-image）。生成的图片会保存在paintboard中。',
  parameters: zodToJsonSchema(generateImageParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'aigc',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      taskId: { type: 'string', description: '任务ID，用于查询任务状态' },
      status: { type: 'string', description: '任务状态：pending, processing, completed, failed' },
      model: { type: 'string', description: '使用的模型名称' },
      generationType: { type: 'string', description: '生成类型：text-to-image 或 image-to-image' },
      message: { type: 'string', description: '任务提交结果消息' },
    },
  },
};

