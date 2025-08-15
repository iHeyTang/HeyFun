import { BaseGenerationAdapter } from './core/base-adapter';
import { WanAdapter } from './adapters/wan-adapter';
import { DoubaoAdapter } from './adapters/doubao-adapter';
import { JimengAdapter } from './adapters/jimeng-adapter';
import { GenerationTaskResponse, GenerationTaskResult, GenerationType, ServiceModel } from '../types';
import { TextToImageParams, ImageToImageParams, TextToVideoParams, ImageToVideoParams, KeyframeToVideoParams } from '../types';

export class AdapterManager {
  private static instance: AdapterManager;
  private adapters: Map<string, BaseGenerationAdapter> = new Map();

  private constructor() {
    this.initializeAdapters();
  }

  public static getInstance(): AdapterManager {
    if (!AdapterManager.instance) {
      AdapterManager.instance = new AdapterManager();
    }
    return AdapterManager.instance;
  }

  private initializeAdapters(): void {
    // 注册所有适配器
    this.adapters.set('wan', new WanAdapter());
    this.adapters.set('doubao', new DoubaoAdapter());
    this.adapters.set('jimeng', new JimengAdapter());
  }

  // 获取所有可用的服务
  public getAvailableServices(): string[] {
    return Array.from(this.adapters.keys());
  }

  // 获取指定服务的适配器
  public getAdapter(service: string): BaseGenerationAdapter | undefined {
    return this.adapters.get(service);
  }

  // 获取所有服务模型信息
  public async getAllServiceModels(): Promise<ServiceModel[]> {
    const allModels: ServiceModel[] = [];

    for (const [serviceName, adapter] of this.adapters) {
      const supportedTypes = adapter.getSupportedGenerationTypes();

      for (const generationType of supportedTypes) {
        try {
          const models = await adapter.getModels(generationType);
          models.forEach(model => {
            allModels.push({
              service: serviceName,
              model: model.model,
              displayName: model.displayName,
              generationType,
              description: model.description,
              parameterLimits: model.parameterLimits,
            });
          });
        } catch (error) {
          console.error(`获取 ${serviceName} 服务的 ${generationType} 模型失败:`, error);
        }
      }
    }

    return allModels;
  }

  // 根据生成类型获取对应的模型
  public async getModelsByGenerationType(generationType: GenerationType): Promise<ServiceModel[]> {
    const models: ServiceModel[] = [];

    for (const [serviceName, adapter] of this.adapters) {
      if (adapter.getSupportedGenerationTypes().includes(generationType)) {
        try {
          const serviceModels = await adapter.getModels(generationType);
          serviceModels.forEach(model => {
            models.push({
              service: serviceName,
              model: model.model,
              displayName: model.displayName,
              generationType,
              description: model.description,
              parameterLimits: model.parameterLimits,
            });
          });
        } catch (error) {
          console.error(`获取 ${serviceName} 服务的 ${generationType} 模型失败:`, error);
        }
      }
    }

    return models;
  }

  // 提交生成任务
  public async submitGenerationTask(
    service: string,
    model: string,
    generationType: GenerationType,
    params: TextToImageParams | ImageToImageParams | TextToVideoParams | ImageToVideoParams | KeyframeToVideoParams,
  ): Promise<GenerationTaskResponse> {
    const adapter = this.adapters.get(service);
    if (!adapter) {
      throw new Error(`不支持的服务: ${service}`);
    }

    if (!adapter.getSupportedGenerationTypes().includes(generationType)) {
      throw new Error(`服务 ${service} 不支持生成类型: ${generationType}`);
    }

    return await adapter.submitTask(model, generationType, params);
  }

  // 获取任务结果
  public async getTaskResult(params: { generationType: string; service: string; model: string; taskId: string }): Promise<GenerationTaskResult> {
    const { generationType, service, model, taskId } = params;
    const adapter = this.adapters.get(service);
    if (!adapter) {
      throw new Error(`不支持的服务: ${service}`);
    }

    return await adapter.getTaskResult({ generationType, model, taskId });
  }

  // 添加新的适配器（用于扩展）
  public addAdapter(service: string, adapter: BaseGenerationAdapter): void {
    this.adapters.set(service, adapter);
  }

  // 移除适配器
  public removeAdapter(service: string): boolean {
    return this.adapters.delete(service);
  }
}
