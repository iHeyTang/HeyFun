/**
 * AIGC Built-in Provider 类型定义
 */
import type { GenerationType } from '../../types';

export interface ModelDefinition {
  id: string;
  name: string;
  description: string;
  family: string; // 模型家族，如 'wan-x', 'doubao', 'jimeng'
  supportedTypes: GenerationType[]; // 支持的生成类型
  aspectRatios: string[]; // 支持的宽高比
  durations?: number[]; // 支持的视频时长（秒）
  
  // 可用的服务商列表，按优先级排序
  providers: ModelProviderConfig[];
}

export interface ModelProviderConfig {
  id: string; // 服务商ID，如 'wan', 'doubao', 'jimeng'
  modelId: string; // 在该服务商中的模型ID
  priority: number; // 优先级，数字越小优先级越高
  pricing?: {
    text_to_image?: number; // 文生图单价
    image_to_image?: number; // 图生图单价
    text_to_video?: number; // 文生视频单价（按秒）
    image_to_video?: number; // 图生视频单价（按秒）
    keyframe_to_video?: number; // 首尾帧生视频单价（按秒）
    currency: string;
  };
}

export interface ServiceAdapter {
  id: string;
  name: string;
  baseUrl?: string;
  authMethod: 'api-key' | 'access-key-secret' | 'custom';
  
  // 环境变量配置
  env: {
    apiKey?: string; // 环境变量名
    accessKeyId?: string;
    accessKeySecret?: string;
    baseUrl?: string; // 可选的自定义base URL环境变量
  };
  
  // API特定配置
  apiConfig: {
    endpoints: {
      text_to_image?: {
        submit: string;
        result: string;
      };
      image_to_image?: {
        submit: string;
        result: string;
      };
      text_to_video?: {
        submit: string;
        result: string;
      };
      image_to_video?: {
        submit: string;
        result: string;
      };
      keyframe_to_video?: {
        submit: string;
        result: string;
      };
    };
    headers?: Record<string, string>;
    requestTransform?: string; // 请求转换函数名
    responseTransform?: string; // 响应转换函数名
  };
}

export interface ModelRegistry {
  // 获取模型定义
  getModel(modelId: string): ModelDefinition | null;
  
  // 获取可用的模型列表
  getAvailableModels(): ModelDefinition[];
  
  // 获取模型的最佳服务商
  getBestProvider(modelId: string): { adapter: ServiceAdapter; config: ModelProviderConfig } | null;
  
  // 注册新模型
  registerModel(model: ModelDefinition): void;
  
  // 注册新适配器
  registerAdapter(adapter: ServiceAdapter): void;
  
  // 获取支持特定生成类型的模型
  getModelsByType(generationType: GenerationType): ModelDefinition[];
}
