/**
 * Built-in Provider 新架构类型定义
 */

export interface ModelDefinition {
  id: string;
  name: string;
  description: string;
  family: string; // 模型家族，如 'gpt', 'claude', 'gemini'
  contextLength: number;
  supportedParameters: string[];
  inputModalities: string[];
  outputModalities: string[];
  instructType: 'openai' | 'anthropic' | 'google';
  
  // 可用的服务商列表，按优先级排序
  providers: ModelProviderConfig[];
}

export interface ModelProviderConfig {
  id: string; // 服务商ID，如 'openai', 'openrouter', 'deepseek'
  modelId: string; // 在该服务商中的模型ID
  priority: number; // 优先级，数字越小优先级越高
  pricing?: {
    input: number; // 每千token输入价格
    output: number; // 每千token输出价格
    currency: string;
  };
}

export interface ServiceAdapter {
  id: string;
  name: string;
  baseUrl: string;
  authMethod: 'api-key' | 'bearer' | 'custom';
  
  // 环境变量配置
  env: {
    apiKey: string; // 环境变量名
    baseUrl?: string; // 可选的自定义base URL环境变量
  };
  
  // API特定配置
  apiConfig: {
    chatCompletionEndpoint: string;
    streamingSupported: boolean;
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
}