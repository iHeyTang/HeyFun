import { ToolResult } from '@/agents/core/tools/tool-definition';
import { AigcToolboxContext } from '../context';
import AIGC from '@repo/llm/aigc';
import zodToJsonSchema from 'zod-to-json-schema';

const executor = async (args: any, context: AigcToolboxContext): Promise<ToolResult> => {
  try {
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
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
};

export const getAigcModelsTool = {
  toolName: 'get_aigc_models',
  executor,
};

