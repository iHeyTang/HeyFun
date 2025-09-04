import { BaseGenerationAdapter } from '../../unified/core/base-adapter';
import { BuiltinModelRegistry } from './registry';
import { UniversalAigcApiAdapter } from './adapters';
import type {
  GenerationType,
  TextToImageParams,
  ImageToImageParams,
  TextToVideoParams,
  ImageToVideoParams,
  KeyframeToVideoParams,
  GenerationTaskResponse,
  GenerationTaskResult,
  ModelInfo,
  GenerationTaskRequest,
} from '../../types';

/**
 * Builtin AIGC Provider 实现
 * 类似于 chat 模块的 builtin provider，统一管理多个服务商的模型
 */
export class BuiltinAigcProvider extends BaseGenerationAdapter {
  private registry: BuiltinModelRegistry;
  private adapters: Map<string, UniversalAigcApiAdapter> = new Map();

  constructor() {
    super('builtin');
    this.registry = new BuiltinModelRegistry();
  }

  async getModels(): Promise<Record<string, ModelInfo>> {
    const models: Record<string, ModelInfo> = {};
    const availableModels = this.registry.getAvailableModels();

    for (const model of availableModels) {
      models[model.id] = {
        displayName: model.name,
        description: model.description,
        parameterLimits: {
          generationType: model.supportedTypes,
          aspectRatio: model.aspectRatios,
          duration: model.durations,
        },
      };
    }

    return models;
  }

  async submitTask(
    modelId: string,
    generationType: GenerationType,
    params: TextToImageParams | ImageToImageParams | TextToVideoParams | ImageToVideoParams | KeyframeToVideoParams,
  ): Promise<GenerationTaskResponse> {
    try {
      // 验证参数
      this.validateParams(generationType, params);

      // 获取模型定义
      const model = this.registry.getModel(modelId);
      if (!model) {
        throw new Error(`模型不存在: ${modelId}`);
      }

      // 检查模型是否支持该生成类型
      if (!model.supportedTypes.includes(generationType)) {
        throw new Error(`模型 ${modelId} 不支持 ${generationType} 类型`);
      }

      // 获取最佳服务商
      const bestProvider = this.registry.getBestProvider(modelId);
      if (!bestProvider) {
        throw new Error(`模型 ${modelId} 暂无可用的服务商`);
      }

      // 获取或创建适配器
      const adapter = this.getOrCreateAdapter(bestProvider.adapter, bestProvider.config);

      // 构建请求
      const request: GenerationTaskRequest = {
        service: bestProvider.adapter.id,
        model: bestProvider.config.modelId,
        generationType,
        params,
      };

      // 提交任务
      return await adapter.submitTask(request);
    } catch (error) {
      return this.handleError(error, 'submitTask');
    }
  }

  async getTaskResult(params: { generationType: string; model: string; taskId: string }): Promise<GenerationTaskResult> {
    try {
      const { model: modelId, taskId } = params;

      // 获取模型定义
      const model = this.registry.getModel(modelId);
      if (!model) {
        throw new Error(`模型不存在: ${modelId}`);
      }

      // 获取最佳服务商
      const bestProvider = this.registry.getBestProvider(modelId);
      if (!bestProvider) {
        throw new Error(`模型 ${modelId} 暂无可用的服务商`);
      }

      // 获取或创建适配器
      const adapter = this.getOrCreateAdapter(bestProvider.adapter, bestProvider.config);

      // 获取任务结果
      return await adapter.getTaskResult(taskId);
    } catch (error) {
      console.error(`[${this.serviceName}] getTaskResult error:`, error);
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 获取模型的运行时配置（用于外部调用）
   */
  getModelRuntimeConfig(modelId: string): {
    serviceId: string;
    actualModelId: string;
    adapter: any;
    config: any;
  } | null {
    const bestProvider = this.registry.getBestProvider(modelId);
    if (!bestProvider) {
      return null;
    }

    return {
      serviceId: bestProvider.adapter.id,
      actualModelId: bestProvider.config.modelId,
      adapter: bestProvider.adapter,
      config: bestProvider.config,
    };
  }

  /**
   * 创建模型适配器（用于外部调用）
   */
  createModelAdapter(modelId: string): UniversalAigcApiAdapter | null {
    const bestProvider = this.registry.getBestProvider(modelId);
    if (!bestProvider) {
      return null;
    }

    return this.getOrCreateAdapter(bestProvider.adapter, bestProvider.config);
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const availableAdapters = this.registry.getAvailableAdapters();
      if (availableAdapters.length === 0) {
        return {
          success: false,
          error: '没有可用的服务商配置，请检查环境变量',
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 获取支持特定生成类型的模型
   */
  getModelsByType(generationType: GenerationType): string[] {
    return this.registry.getModelsByType(generationType).map(model => model.id);
  }

  /**
   * 注册自定义模型
   */
  registerModel(model: any): void {
    this.registry.registerModel(model);
  }

  /**
   * 注册自定义适配器
   */
  registerAdapter(adapter: any): void {
    this.registry.registerAdapter(adapter);
  }

  /**
   * 获取或创建适配器实例
   */
  private getOrCreateAdapter(serviceAdapter: any, modelConfig: any): UniversalAigcApiAdapter {
    const key = `${serviceAdapter.id}-${modelConfig.modelId}`;

    if (!this.adapters.has(key)) {
      const adapter = new UniversalAigcApiAdapter(serviceAdapter, modelConfig);
      this.adapters.set(key, adapter);
    }

    return this.adapters.get(key)!;
  }
}
