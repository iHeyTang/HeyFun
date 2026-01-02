/**
 * 工具定义层
 * 只关心工具的名称、描述、入参出参、运行时环境等元数据
 */

/**
 * 工具运行时环境（已废弃：所有工具统一在服务端运行）
 * @deprecated 所有工具现在都统一在服务端运行，不再需要区分运行时环境
 */
export enum ToolRuntime {
  /** 服务端运行：需要 API、数据库等服务端资源 */
  SERVER = 'server',
  /** 客户端运行（已废弃） */
  CLIENT = 'client',
}

/**
 * 工具定义
 * 包含工具的元数据，不包含具体实现
 */
export interface ToolDefinition {
  /** 工具名称（唯一标识） */
  name: string;
  /** 工具描述 */
  description: string;
  /** 工具参数 Schema（JSON Schema） */
  parameters: Record<string, any>;
  /** 工具返回值 Schema（可选，用于类型检查） */
  returnSchema?: Record<string, any>;
  /** 运行时环境（已废弃：所有工具统一在服务端运行，保留此字段仅用于向后兼容） */
  runtime?: ToolRuntime;
  /** 工具分类/标签（可选，用于组织和过滤） */
  category?: string;
  /** 工具使用手册（可选，用于指导agent如何更好地使用该工具） */
  manual?: string;
  /** 其他元数据 */
  metadata?: Record<string, any>;
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
