/**
 * 获取节点类型详细信息工具
 */

import { ToolResult, ToolExecutionContext } from '../../../types';
import { createTool } from '../base';

export const getNodeTypeInfoTool = createTool(
  {
    type: 'function',
    function: {
      name: 'get_node_type_info',
      description: '获取指定节点类型的详细信息，包括支持的参数、可用模型等',
      parameters: {
        type: 'object',
        properties: {
          nodeType: {
            type: 'string',
            enum: ['text', 'image', 'video', 'audio', 'music', 'group'],
            description: '节点类型',
          },
        },
        required: ['nodeType'],
      },
    },
  },
  async (args: any, context: ToolExecutionContext): Promise<ToolResult> => {
    try {
      const { nodeType } = args;

      // 获取模型列表
      let aigcModels: any[] = [];
      if (context.canvasCapabilities?.aigcModels) {
        aigcModels = context.canvasCapabilities.aigcModels;
      } else if (context.getAigcModels) {
        try {
          aigcModels = await context.getAigcModels();
        } catch (e) {
          // 继续执行，但没有模型信息
        }
      }

      // 获取该类型对应的可用模型（从 AIGC 模型列表中过滤）
      const availableModels = filterModelsByNodeType(aigcModels, nodeType);

      const message = formatNodeTypeInfo(nodeType, availableModels);

      return {
        success: true,
        message,
        data: {
          nodeType,
          availableModels,
        },
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
);

/**
 * 根据节点类型过滤模型
 */
function filterModelsByNodeType(models: any[], nodeType: string): any[] {
  // 节点类型到生成类型的映射
  const typeMapping: Record<string, string[]> = {
    image: ['text-to-image', 'image-to-image'],
    video: ['text-to-video', 'image-to-video', 'video-to-video'],
    audio: ['text-to-speech'],
    music: ['music'],
  };

  const targetTypes = typeMapping[nodeType];
  if (!targetTypes) {
    return [];
  }

  // 注意：generationTypes 是数组，需要检查是否包含目标类型
  return models.filter((model: any) => {
    if (!model.generationTypes || !Array.isArray(model.generationTypes)) {
      return false;
    }
    return model.generationTypes.some((type: string) => targetTypes.includes(type));
  });
}

function formatNodeTypeInfo(nodeType: string, availableModels: any[]): string {
  const lines: string[] = [];

  // 节点类型基本信息
  const nodeTypeLabels: Record<string, string> = {
    text: '文本节点',
    image: '图像生成节点',
    video: '视频生成节点',
    audio: '音频生成节点（TTS）',
    music: '音乐生成节点',
    group: '分组节点',
  };

  lines.push(`📦 ${nodeTypeLabels[nodeType] || nodeType}`);
  lines.push('');

  // 可用模型
  if (availableModels && availableModels.length > 0) {
    lines.push('🤖 可用模型:');
    availableModels.forEach((model: any) => {
      lines.push(`  • ${model.name} (${model.provider || 'unknown'})`);
      if (model.description) {
        lines.push(`    ${model.description}`);
      }
      if (model.paramsSchema) {
        lines.push(`    支持参数配置（详见 paramsSchema）`);
      }
    });
  } else {
    lines.push('⚠️ 该节点类型暂无可用模型');
  }

  return lines.join('\n');
}

