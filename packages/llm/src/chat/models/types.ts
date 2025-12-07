/**
 * 模型信息类型定义
 *
 * 该模块定义了模型相关的所有类型，包括模型信息、定价等
 */

/**
 * 模型定价信息
 */
export interface ModelPricing {
  /** 输入价格（每 1 token） */
  input?: number | string;
  /** 输出价格（每 1 token） */
  output?: number | string;
  /** 输入缓存读取价格（每 1 token） */
  inputCacheRead?: number | string;
  /** 输入缓存写入价格（每 1 token） */
  inputCacheWrite?: number | string;
  /** 额外描述信息 */
  extraDescription?: string;
  /** 货币单位 */
  currency?: string;
}

/**
 * 统一的模型信息结构
 */
export interface ModelInfo {
  // 基础信息
  /** 模型唯一标识符（格式：provider/model-name） */
  id: string;
  /** 模型显示名称 */
  name: string;
  /** 提供商名称 */
  provider: string;
  /** 模型家族，用于显示不同的图标 */
  family: string;
  /** 模型类型：language (对话模型) 或 embedding (向量模型) 或 image (图像模型) */
  type?: 'language' | 'embedding' | 'image';

  // 描述信息
  /** 模型描述 */
  description?: string;

  // 能力信息
  /** 上下文长度（tokens） */
  contextLength?: number;
  /** 是否支持流式输出 */
  supportsStreaming: boolean;
  /** 是否支持函数调用 */
  supportsFunctionCalling: boolean;
  /** 是否支持视觉/多模态 */
  supportsVision: boolean;

  // 定价信息
  /** 定价信息 */
  pricing?: ModelPricing;

  // 状态信息
  /** 是否启用（默认未启用，需要用户手动启用） */
  enabled: boolean;

  // 元数据
  /** 额外的元数据信息 */
  metadata?: Record<string, any>;
}

export interface ModelFilter {
  provider?: string;
  family?: string;
  type?: 'language' | 'embedding' | 'image';
  supportsStreaming?: boolean;
  supportsFunctionCalling?: boolean;
  supportsVision?: boolean;
  maxPrice?: number;
  minContextLength?: number;
}
