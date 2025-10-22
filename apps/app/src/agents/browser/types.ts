/**
 * Agent 工具执行器类型定义
 * 浏览器端工具执行的接口定义
 */

/**
 * 工具调用参数
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON 字符串
  };
}

/**
 * 工具执行结果
 */
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

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
export interface ToolExecutionContext {
  /** 画布引用 */
  canvasRef?: any;
  /** 画布能力配置（可选，用于提供额外的元数据） */
  canvasCapabilities?: CanvasCapabilities;
  /** 获取 AIGC 模型的函数（如果提供，工具可以动态查询可用模型） */
  getAigcModels?: () => Promise<any[]>;
  /** 其他上下文信息 */
  [key: string]: any;
}

/**
 * 工具执行器接口
 */
export interface ToolExecutor {
  /**
   * 执行单个工具调用
   */
  execute(toolCall: ToolCall, context: ToolExecutionContext): Promise<ToolResult>;

  /**
   * 执行多个工具调用
   */
  executeMany(toolCalls: ToolCall[], context: ToolExecutionContext): Promise<ToolResult[]>;
}
