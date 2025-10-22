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
 */
export function updateCanvasState(context: ToolExecutionContext, state: any) {
  if (!context.canvasRef?.current) {
    throw new Error('Canvas reference not available');
  }
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
          model: data?.model, // 不提供默认值，要求用户明确指定
          size: data?.size || '1024x1024',
          ...(data?.quality && { quality: data.quality }),
        },
      };
    case 'audio':
      return {
        actionData: {
          text: data?.text || data?.prompt || '请输入要转换的文本',
          voiceId: data?.voiceId || 'alloy',
          model: data?.model,
        },
      };
    case 'music':
      return {
        actionData: {
          prompt: data?.prompt || '请输入音乐描述',
          duration: data?.duration || 30,
          model: data?.model,
        },
      };
    case 'video':
      return {
        actionData: {
          prompt: data?.prompt || '请输入视频描述',
          duration: data?.duration || 10,
          model: data?.model,
        },
      };
    case 'group':
      return {};
    default:
      return data || {};
  }
}

