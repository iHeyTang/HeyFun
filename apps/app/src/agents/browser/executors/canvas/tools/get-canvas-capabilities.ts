/**
 * 获取画布能力信息工具
 * 让 Agent 了解画布支持的节点类型、模型和参数
 */

import { ToolResult, ToolExecutionContext } from '../../../types';
import { createTool } from '../base';

export const getCanvasCapabilitiesTool = createTool(
  {
    type: 'function',
    function: {
      name: 'get_canvas_capabilities',
      description: '获取画布的能力信息，包括支持的节点类型、可用模型、参数配置等。在创建节点前应该先调用此工具了解画布的实际配置',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  async (args: any, context: ToolExecutionContext): Promise<ToolResult> => {
    try {
      // 尝试从多个来源获取画布能力信息
      const capabilities = await getCapabilitiesFromContext(context);

      return {
        success: true,
        message: `📋 画布能力信息：\n${formatCapabilities(capabilities)}`,
        data: capabilities,
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
);

/**
 * 从 context 获取或构建画布能力信息
 */
async function getCapabilitiesFromContext(context: ToolExecutionContext): Promise<any> {
  const capabilities: any = {
    features: {
      supportAutoLayout: true,
      supportBatchOperations: true,
      supportGrouping: true,
      supportWorkflowExecution: true,
    },
  };

  // 1. 从画布 ref 获取节点类型
  if (context.canvasRef?.current) {
    try {
      const canvasJson = context.canvasRef.current.exportCanvas();
      const canvasState = JSON.parse(canvasJson);
      
      // 从画布状态推断支持的节点类型
      const nodeTypes = new Set<string>();
      if (canvasState.nodes) {
        canvasState.nodes.forEach((node: any) => {
          if (node.type) {
            nodeTypes.add(node.type);
          }
        });
      }
      
      // 添加常见节点类型
      ['text', 'image', 'video', 'audio', 'music', 'group'].forEach(type => nodeTypes.add(type));
      
      capabilities.supportedNodeTypes = Array.from(nodeTypes);
    } catch (e) {
      // 如果无法获取，使用默认值
      capabilities.supportedNodeTypes = ['text', 'image', 'video', 'audio', 'music', 'group'];
    }
  } else {
    capabilities.supportedNodeTypes = ['text', 'image', 'video', 'audio', 'music', 'group'];
  }

  // 2. 从 context 获取或查询 AIGC 模型
  if (context.canvasCapabilities?.aigcModels) {
    capabilities.aigcModels = context.canvasCapabilities.aigcModels;
  } else if (context.getAigcModels) {
    try {
      capabilities.aigcModels = await context.getAigcModels();
    } catch (e) {
      capabilities.aigcModels = [];
      capabilities.modelsFetchError = '无法获取 AIGC 模型列表';
    }
  } else {
    capabilities.aigcModels = [];
    capabilities.modelsFetchError = '未配置模型查询函数，请在 context 中提供 getAigcModels';
  }

  // 3. 合并用户提供的额外配置
  if (context.canvasCapabilities?.features) {
    capabilities.features = { ...capabilities.features, ...context.canvasCapabilities.features };
  }

  return capabilities;
}

/**
 * 格式化能力信息为可读文本
 */
function formatCapabilities(capabilities: any): string {
  const lines: string[] = [];

  // 节点类型
  if (capabilities.supportedNodeTypes && capabilities.supportedNodeTypes.length > 0) {
    lines.push('\n📦 支持的节点类型:');
    lines.push(`  ${capabilities.supportedNodeTypes.join(', ')}`);
  }

  // 可用模型（从 AIGC 模型列表）
  if (capabilities.aigcModels && capabilities.aigcModels.length > 0) {
    lines.push('\n🤖 可用 AIGC 模型:');
    
    // 按类型分组（注意：generationTypes 是数组）
    const groupedModels: Record<string, any[]> = {};
    capabilities.aigcModels.forEach((model: any) => {
      const types = model.generationTypes || ['other'];
      types.forEach((type: string) => {
        if (!groupedModels[type]) {
          groupedModels[type] = [];
        }
        // 避免重复添加
        if (!groupedModels[type].some(m => m.name === model.name)) {
          groupedModels[type].push(model);
        }
      });
    });

    Object.entries(groupedModels).forEach(([type, models]) => {
      lines.push(`  • ${type}:`);
      models.forEach((m: any) => {
        lines.push(`    - ${m.name} (${m.provider || 'unknown'})`);
        if (m.description) {
          lines.push(`      ${m.description}`);
        }
      });
    });
  } else {
    lines.push('\n⚠️ 暂无可用 AIGC 模型');
    if (capabilities.modelsFetchError) {
      lines.push(`  原因: ${capabilities.modelsFetchError}`);
    }
    lines.push('  提示: 在 ToolExecutionContext 中提供 getAigcModels 函数或 aigcModels 数据');
  }

  // 功能特性
  if (capabilities.features) {
    lines.push('\n✨ 功能特性:');
    Object.entries(capabilities.features).forEach(([key, value]) => {
      lines.push(`  • ${key}: ${value ? '✅' : '❌'}`);
    });
  }

  return lines.join('\n');
}

