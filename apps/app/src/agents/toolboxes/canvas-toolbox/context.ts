import { FlowCanvasRef } from '@/components/block/flowcanvas';

/**
 * 画布能力配置
 * 使用项目已有的类型，避免重复定义
 */
export interface CanvasCapabilities {
  /** 节点类型配置（从 FlowCanvas nodeTypes 派生） */
  nodeTypes?: any; // 实际类型：Record<string, { component, processor }>
  /** 可用的 AIGC 模型列表（从 getAigcModels 获取） */
  aigcModels?: any[]; // 实际类型：Awaited<ReturnType<typeof getAigcModels>>['data']
  /** 画布功能特性 */
  features?: {
    supportAutoLayout?: boolean;
    supportBatchOperations?: boolean;
    supportGrouping?: boolean;
    supportWorkflowExecution?: boolean;
  };
}

/**
 * 工具执行上下文
 * 提供执行工具所需的浏览器端资源
 */
export interface CanvasToolboxContext {
  /** 画布引用 */
  canvasRef?: React.RefObject<FlowCanvasRef>;
  /** 画布能力配置（可选，用于提供额外的元数据） */
  canvasCapabilities?: CanvasCapabilities;
  /** 获取 AIGC 模型的函数（如果提供，工具可以动态查询可用模型） */
  getAigcModels?: () => Promise<any[]>;
  /** 其他上下文信息 */
  [key: string]: any;
}
