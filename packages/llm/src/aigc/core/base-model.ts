import z from 'zod';
import { GenerationTaskResponse, GenerationTaskResult, GenerationType } from '../types';

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

export interface Voice {
  id: string;
  name: string;
  description: string;
}

// 基础适配器抽象类
export abstract class BaseAigcModel {
  public abstract name: string;
  public abstract displayName: string;
  public abstract description?: string;
  public abstract costDescription?: string;
  public abstract generationTypes: GenerationType[];

  public abstract paramsSchema: z.ZodSchema;

  abstract submitTask(params: z.infer<typeof this.paramsSchema>): Promise<string>;

  abstract getTaskResult(params: { model: string; taskId: string }): Promise<GenerationTaskResult>;

  abstract calculateCost(params: z.infer<typeof this.paramsSchema>): number;

  getVoiceList(): Promise<Voice[]> {
    return Promise.resolve([]);
  }

  // 通用错误处理方法
  protected handleError(error: unknown, operation: string): GenerationTaskResponse {
    console.error(`[${this.name}] ${operation} error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
