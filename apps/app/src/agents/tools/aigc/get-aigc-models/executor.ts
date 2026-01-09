import { definitionToolExecutor } from '@/agents/core/tools/tool-executor';
import AIGC from '@/llm/aigc';
import zodToJsonSchema from 'zod-to-json-schema';
import { getAigcModelsParamsSchema } from './schema';

export const getAigcModelsExecutor = definitionToolExecutor(
  getAigcModelsParamsSchema,
  async (args, context) => {
    return await context.workflow.run(`toolcall-${context.toolCallId}`, async () => {
      const { generationType } = args;

    // 获取所有模型
    const models = await AIGC.getAllServiceModels();

    // 如果指定了生成类型，进行过滤
    let filteredModels = models;
    if (generationType && typeof generationType === 'string') {
      filteredModels = models.filter(model => model.generationTypes.includes(generationType as any));
    }

    // 格式化模型信息
    const modelList = filteredModels.map(model => ({
      name: model.name,
      provider: model.providerName,
      displayName: model.displayName,
      description: model.description || '',
      costDescription: model.costDescription || '',
      generationTypes: model.generationTypes,
      tags: model.tags || [],
      paramsSchema: zodToJsonSchema(model.paramsSchema),
    }));

    return {
      success: true,
      data: {
        models: modelList,
        count: modelList.length,
        generationType: generationType || 'all',
      },
    };
    });
  },
);

