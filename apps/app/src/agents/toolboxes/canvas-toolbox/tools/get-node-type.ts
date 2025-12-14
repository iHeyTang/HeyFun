import { CanvasToolboxContext } from '../context';
import { ToolResult } from '@/agents/core/tools/tool-definition';

const executor = async (args: any, context: CanvasToolboxContext): Promise<ToolResult> => {
  try {
    const { nodeType } = args;
    if (!nodeType) {
      return { success: false, error: 'nodeType is required' };
    }

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

    // 根据节点类型过滤模型
    const typeMapping: Record<string, string[]> = {
      image: ['text-to-image', 'image-to-image'],
      video: ['text-to-video', 'image-to-video', 'video-to-video'],
      audio: ['text-to-speech'],
      music: ['music'],
    };

    const targetTypes = typeMapping[nodeType] || [];
    const availableModels = aigcModels.filter((model: any) => {
      if (!model.generationTypes || !Array.isArray(model.generationTypes)) {
        return false;
      }
      return model.generationTypes.some((type: string) => targetTypes.includes(type));
    });

    // 格式化节点类型信息
    const nodeTypeLabels: Record<string, string> = {
      text: '文本节点',
      image: '图像生成节点',
      video: '视频生成节点',
      audio: '音频生成节点（TTS）',
      music: '音乐生成节点',
      group: '分组节点',
    };

    const lines: string[] = [];
    lines.push(`📦 ${nodeTypeLabels[nodeType] || nodeType}`);
    lines.push('');

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

    return {
      success: true,
      message: lines.join('\n'),
      data: {
        nodeType,
        availableModels,
      },
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
};

export const getNodeTypeInfoTool = {
  toolName: 'get_node_type_info',
  executor,
};
