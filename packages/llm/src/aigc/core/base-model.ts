import { GenerationTaskResponse, GenerationTaskResult } from '../types';

// 生成类型枚举
export type GenerationType = 'text-to-image' | 'image-to-image' | 'text-to-video' | 'image-to-video' | 'keyframe-to-video';

// 模型参数限制
export interface ModelParameterLimits {
  generationType: GenerationType[];
  aspectRatio?: string[];
  duration?: number[];
}

// 基础生成参数接口
export interface BaseGenerationParams {}

// 文生图参数
export interface TextToImageParams extends BaseGenerationParams {
  prompt: string; // 提示词
  aspectRatio: string;
}

// 图生图参数
export interface ImageToImageParams extends BaseGenerationParams {
  prompt: string; // 提示词
  referenceImage: string; // 参考图（base64或URL）
  aspectRatio: string;
}

// 文生视频参数
export interface TextToVideoParams extends BaseGenerationParams {
  prompt: string; // 提示词
  aspectRatio: string;
  duration: number; // 时长（秒）
}

// 图生视频参数
export interface ImageToVideoParams extends BaseGenerationParams {
  prompt: string; // 提示词
  referenceImage: string; // 参考图（base64或URL）
  aspectRatio: string;
  duration: number; // 时长（秒）
}

// 首尾帧生视频参数
export interface KeyframeToVideoParams extends BaseGenerationParams {
  prompt: string; // 提示词
  firstFrame: string; // 首帧（base64或URL）
  lastFrame: string; // 尾帧（base64或URL）
  aspectRatio: string;
  duration: number; // 时长（秒）
}

export type SubmitTaskParams = TextToImageParams | ImageToImageParams | TextToVideoParams | ImageToVideoParams | KeyframeToVideoParams;

export interface BaseAigcModelInfo {
  name: string;
  displayName: string;
  description?: string;
  parameterLimits?: ModelParameterLimits;
}

// 基础适配器抽象类
export abstract class BaseAigcModel implements BaseAigcModelInfo {
  public abstract name: string;
  public abstract displayName: string;
  public abstract description?: string;
  public abstract parameterLimits?: ModelParameterLimits;

  abstract submitTask(params: SubmitTaskParams): Promise<string>;

  abstract getTaskResult(params: { taskId: string }): Promise<GenerationTaskResult>;

  // 通用错误处理方法
  protected handleError(error: unknown, operation: string): GenerationTaskResponse {
    console.error(`[${this.name}] ${operation} error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
