import { ToolDefinition, ToolRuntime } from '@/agents/core/tools/tool-definition';
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

/**
 * 配置环境变量的参数 Schema
 */
export const configureEnvironmentVariableParamsSchema = z.object({
  variableNames: z
    .union([z.string(), z.array(z.string())])
    .describe('需要检查或配置的环境变量名称，可以是单个变量名或变量名数组，例如：AMAP_API_KEY 或 ["AMAP_API_KEY", "FEISHU_API_KEY"]'),
  descriptions: z
    .record(z.string())
    .optional()
    .describe('环境变量的描述信息映射，键为变量名，值为描述。说明每个变量的用途和获取方式，例如：{"AMAP_API_KEY": "高德地图API密钥"}'),
});

export type ConfigureEnvironmentVariableParams = z.infer<typeof configureEnvironmentVariableParamsSchema>;

export const configureEnvironmentVariableSchema: ToolDefinition = {
  name: 'configure_environment_variable',
  description:
    '检查环境变量是否存在，如果不存在则引导用户配置。当工具或脚本需要使用某个环境变量（如 API Key）时，使用此工具来检查和引导用户配置。',
  displayName: {
    en: 'Configure Environment Variable',
    'zh-CN': '配置环境变量',
    'zh-TW': '配置環境變數',
    ja: '環境変数を設定',
    ko: '환경 변수 구성',
  },
  parameters: zodToJsonSchema(configureEnvironmentVariableParamsSchema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as any,
  runtime: ToolRuntime.SERVER,
  category: 'base',
  returnSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      variables: {
        type: 'array',
        description: '环境变量配置状态列表',
        items: {
          type: 'object',
          properties: {
            variableName: { type: 'string', description: '环境变量名称' },
            exists: { type: 'boolean', description: '环境变量是否存在' },
            description: { type: 'string', description: '环境变量描述' },
          },
        },
      },
      allConfigured: { type: 'boolean', description: '是否所有变量都已配置' },
      configureUrl: { type: 'string', description: '配置页面的 URL' },
      message: { type: 'string', description: '提示信息' },
    },
  },
};
