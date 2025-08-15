import { BaseGenerationAdapter } from './core/base-adapter';
import { WanAdapter } from './adapters/wan-adapter';
import { DoubaoAdapter } from './adapters/doubao-adapter';
import { JimengAdapter } from './adapters/jimeng-adapter';
import { GenerationTaskResponse, GenerationTaskResult, GenerationType, ServiceModel } from '../types';
import { TextToImageParams, ImageToImageParams, TextToVideoParams, ImageToVideoParams, KeyframeToVideoParams } from '../types';
import z from 'zod';
import { volcengineArkServiceConfigSchema } from '../providers/volcengine/ark';
import { volcengineJimengServiceConfigSchema } from '../providers/volcengine/jimeng';
import { dashscopeWanServiceConfigSchema } from '../providers/dashscope/wan';

export const aigcProviderConfigSchema = z.object({
  doubao: volcengineArkServiceConfigSchema.optional(),
  jimeng: volcengineJimengServiceConfigSchema.optional(),
  wan: dashscopeWanServiceConfigSchema.optional(),
});

export class AdapterManager {
  private static instance: AdapterManager;
  private adapters: Map<string, BaseGenerationAdapter> = new Map();

  private constructor(config: z.infer<typeof aigcProviderConfigSchema>) {
    this.initializeAdapters(config);
  }

  public static getInstance(config: z.infer<typeof aigcProviderConfigSchema>): AdapterManager {
    if (!AdapterManager.instance) {
      AdapterManager.instance = new AdapterManager(config);
    }
    return AdapterManager.instance;
  }

  private initializeAdapters(config: z.infer<typeof aigcProviderConfigSchema>): void {
    // 注册所有适配器
    this.adapters.set('wan', new WanAdapter(config.wan));
    this.adapters.set('doubao', new DoubaoAdapter(config.doubao));
    this.adapters.set('jimeng', new JimengAdapter(config.jimeng));
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
    const models: ServiceModel[] = [];

    for (const [serviceName, adapter] of this.adapters) {
      const adpterModels = await adapter.getModels();
      models.push(
        ...Object.keys(adpterModels).map(model => {
          const modelInfo = adpterModels[model]!;
          return { service: serviceName, model: model, ...modelInfo };
        }),
      );
    }

    return models;
  }

  // 根据生成类型获取对应的模型
  public async getModelsByGenerationType(generationType: GenerationType): Promise<ServiceModel[]> {
    const models: ServiceModel[] = [];

    for (const [serviceName, adapter] of this.adapters) {
      const adpterModels = await adapter.getModels();
      models.push(
        ...(Object.keys(adpterModels)
          .map(model => {
            const modelInfo = adpterModels[model]!;
            if (!modelInfo.parameterLimits?.generationType?.includes(generationType)) {
              return null;
            }
            return { service: serviceName, model: model, ...modelInfo };
          })
          .filter(Boolean) as ServiceModel[]),
      );
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
