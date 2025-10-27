/**
 * 画布工具辅助函数
 */

import { ToolExecutionContext } from '../../types';

/**
 * 获取画布状态
 */
export function getCanvasState(context: ToolExecutionContext) {
  if (!context.canvasRef?.current) {
    throw new Error('Canvas reference not available');
  }
  const canvasJson = context.canvasRef.current.exportCanvas();
  return JSON.parse(canvasJson);
}

/**
 * 更新画布状态
 * 注意：此函数获取最新的画布状态后进行修改，避免并发修改导致覆盖
 */
export function updateCanvasState(context: ToolExecutionContext, state: any) {
  if (!context.canvasRef?.current) {
    throw new Error('Canvas reference not available');
  }
  
  // 使用 importCanvas 来更新状态
  // importCanvas 内部已经使用 reactFlowInstance.setNodes/setEdges 直接更新
  context.canvasRef.current.importCanvas(JSON.stringify(state));
}

/**
 * 生成唯一节点ID
 */
export function generateNodeId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 生成唯一连接ID
 */
export function generateEdgeId(): string {
  return `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 构建节点的 actionData
 * 注意：不再硬编码模型名称，让用户自己指定或通过 get_canvas_capabilities 查询可用模型
 */
export function buildNodeActionData(nodeType: string, data: any = {}) {
  switch (nodeType) {
    case 'text':
      return { actionData: { text: data?.text || data?.prompt || '请输入文本内容' } };
    case 'image':
      return {
        actionData: {
          prompt: data?.prompt || data?.text || '',
          selectedModel: data?.selectedModel,
          aspectRatio: data?.aspectRatio,
          n: data?.n,
          ...(data?.advancedParams && { advancedParams: data.advancedParams }),
        },
      };
    case 'audio':
      return {
        actionData: {
          prompt: data?.prompt || data?.text || '请输入要转换的文本',
          selectedModel: data?.selectedModel,
          voiceId: data?.voiceId || 'alloy',
          ...(data?.advancedParams && { advancedParams: data.advancedParams }),
        },
      };
    case 'music':
      return {
        actionData: {
          lyrics: data?.lyrics,
          prompt: data?.prompt || '请输入音乐描述',
          selectedModel: data?.selectedModel,
          ...(data?.advancedParams && { advancedParams: data.advancedParams }),
        },
      };
    case 'video':
      return {
        actionData: {
          prompt: data?.prompt || '请输入视频描述',
          selectedModel: data?.selectedModel,
          aspectRatio: data?.aspectRatio,
          duration: data?.duration || '10',
          resolution: data?.resolution,
          ...(data?.advancedParams && { advancedParams: data.advancedParams }),
        },
      };
    case 'group':
      return {};
    default:
      return data || {};
  }
}
