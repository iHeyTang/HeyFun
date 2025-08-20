import {
  GenerationType,
  TextToImageParams,
  ImageToImageParams,
  TextToVideoParams,
  ImageToVideoParams,
  KeyframeToVideoParams,
  GenerationTaskResponse,
  GenerationTaskResult,
  ModelInfo,
} from '../../types';

// 服务适配器基础接口
interface IGenerationAdapter {
  // 获取服务名称
  getServiceName(): string;

  // 获取模型列表
  getModels(): Promise<Record<string, ModelInfo>>;

  // 提交生成任务
  submitTask(
    model: string,
    generationType: GenerationType,
    params: TextToImageParams | ImageToImageParams | TextToVideoParams | ImageToVideoParams | KeyframeToVideoParams,
  ): Promise<GenerationTaskResponse>;

  // 获取任务结果
  getTaskResult(params: { generationType: string; model: string; taskId: string }): Promise<GenerationTaskResult>;
}

// 基础适配器抽象类
export abstract class BaseGenerationAdapter implements IGenerationAdapter {
  protected serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  getServiceName(): string {
    return this.serviceName;
  }

  abstract getModels(): Promise<Record<string, ModelInfo>>;

  abstract submitTask(
    model: string,
    generationType: GenerationType,
    params: TextToImageParams | ImageToImageParams | TextToVideoParams | ImageToVideoParams | KeyframeToVideoParams,
  ): Promise<GenerationTaskResponse>;

  abstract getTaskResult(params: { generationType: string; model: string; taskId: string }): Promise<GenerationTaskResult>;

  // 通用错误处理方法
  protected handleError(error: unknown, operation: string): GenerationTaskResponse {
    console.error(`[${this.serviceName}] ${operation} error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // 验证参数通用方法
  protected validateParams(
    generationType: GenerationType,
    params: TextToImageParams | ImageToImageParams | TextToVideoParams | ImageToVideoParams | KeyframeToVideoParams,
  ): boolean {
    if (!params.prompt || params.prompt.trim() === '') {
      throw new Error('提示词不能为空');
    }

    switch (generationType) {
      case 'text-to-image': {
        const imageParams = params as TextToImageParams;
        if (!imageParams.aspectRatio || imageParams.aspectRatio.trim() === '') {
          throw new Error('宽高比不能为空');
        }
        break;
      }

      case 'image-to-image': {
        const imageParams = params as ImageToImageParams;
        if (!imageParams.aspectRatio || imageParams.aspectRatio.trim() === '') {
          throw new Error('宽高比不能为空');
        }
        if (!imageParams.referenceImage || imageParams.referenceImage.trim() === '') {
          throw new Error('参考图不能为空');
        }
        break;
      }

      case 'text-to-video': {
        const videoParams = params as TextToVideoParams;
        if (!videoParams.aspectRatio || videoParams.aspectRatio.trim() === '') {
          throw new Error('宽高比不能为空');
        }
        if (!videoParams.duration || videoParams.duration <= 0) {
          throw new Error('时长必须大于0');
        }
        break;
      }

      case 'image-to-video': {
        const videoParams = params as ImageToVideoParams;
        if (!videoParams.aspectRatio || videoParams.aspectRatio.trim() === '') {
          throw new Error('宽高比不能为空');
        }
        if (!videoParams.referenceImage || videoParams.referenceImage.trim() === '') {
          throw new Error('参考图不能为空');
        }
        if (!videoParams.duration || videoParams.duration <= 0) {
          throw new Error('时长必须大于0');
        }
        break;
      }

      case 'keyframe-to-video': {
        const keyframeParams = params as KeyframeToVideoParams;
        if (!keyframeParams.firstFrame || keyframeParams.firstFrame.trim() === '') {
          throw new Error('首帧不能为空');
        }
        if (!keyframeParams.lastFrame || keyframeParams.lastFrame.trim() === '') {
          throw new Error('尾帧不能为空');
        }
        if (!keyframeParams.aspectRatio || keyframeParams.aspectRatio.trim() === '') {
          throw new Error('宽高比不能为空');
        }
        if (!keyframeParams.duration || keyframeParams.duration <= 0) {
          throw new Error('时长必须大于0');
        }
        break;
      }
    }

    return true;
  }
}
