import z from 'zod';
import { GenerationTaskResponse, GenerationTaskResult, GenerationType } from '../types';

// 模型参数限制
export interface ModelParameterLimits {
  generationType: GenerationType[];
  aspectRatio?: string[];
  duration?: number[];
}

// 文生图参数
export const textToImageParamsSchema = z.object({
  prompt: z.string(),
  aspectRatio: z.string(),
});
export type TextToImageParams = z.infer<typeof textToImageParamsSchema>;

// 图生图参数
export const imageToImageParamsSchema = z.object({
  prompt: z.string(),
  referenceImage: z.array(z.string()),
  aspectRatio: z.string(),
});
export type ImageToImageParams = z.infer<typeof imageToImageParamsSchema>;

// 文生视频参数
export const textToVideoParamsSchema = z.object({
  prompt: z.string(),
  aspectRatio: z.string(),
  duration: z.number(),
});
export type TextToVideoParams = z.infer<typeof textToVideoParamsSchema>;

// 图生视频参数
export const imageToVideoParamsSchema = z.object({
  prompt: z.string(),
  referenceImage: z.array(z.string()),
  aspectRatio: z.string(),
  duration: z.number(),
});
export type ImageToVideoParams = z.infer<typeof imageToVideoParamsSchema>;

// 首尾帧生视频参数
export const keyframeToVideoParamsSchema = z.object({
  prompt: z.string(),
  firstFrame: z.string(),
  lastFrame: z.string(),
  aspectRatio: z.string(),
  duration: z.number(),
});
export type KeyframeToVideoParams = z.infer<typeof keyframeToVideoParamsSchema>;

// 语音生成参数
export const speechToTextParamsSchema = z.object({
  text: z.string(),
  voice_id: z.string(),
  mode: z.string(),
  speed: z.number(),
  vol: z.number(),
  pitch: z.number(),
  emotion: z.string(),
});
export type SpeechToTextParams = z.infer<typeof speechToTextParamsSchema>;

// 提交任务参数
export const submitTaskParamsSchema = z.union([
  textToImageParamsSchema,
  imageToImageParamsSchema,
  textToVideoParamsSchema,
  imageToVideoParamsSchema,
  keyframeToVideoParamsSchema,
  speechToTextParamsSchema,
]);
export type SubmitTaskParams = z.infer<typeof submitTaskParamsSchema>;

export const modelTypesSchema = z.union([
  z.literal('text-to-image'),
  z.literal('image-to-image'),
  z.literal('text-to-video'),
  z.literal('image-to-video'),
  z.literal('keyframe-to-video'),
  z.literal('text-to-speech'),
]);
export type ModelType = z.infer<typeof modelTypesSchema>;

export const modelTypesSubmitTaskParamsSchema = z.union([
  z.object({ modelType: z.literal('text-to-image'), params: textToImageParamsSchema }),
  z.object({ modelType: z.literal('image-to-image'), params: imageToImageParamsSchema }),
  z.object({ modelType: z.literal('text-to-video'), params: textToVideoParamsSchema }),
  z.object({ modelType: z.literal('image-to-video'), params: imageToVideoParamsSchema }),
  z.object({ modelType: z.literal('keyframe-to-video'), params: keyframeToVideoParamsSchema }),
  z.object({ modelType: z.literal('text-to-speech'), params: speechToTextParamsSchema }),
]);
export type ModelTypeSubmitTaskParams = z.infer<typeof modelTypesSubmitTaskParamsSchema>;

export interface Voice {
  id: string;
  name: string;
  description: string;
}

// 基础参数接口 - 定义所有可能的字段
export interface BaseVideoParams {
  prompt: string;
  firstFrame?: string;
  lastFrame?: string;
  referenceImage?: string[];
  resolution?: string;
  aspectRatio: string;
  duration?: number | `${number}`;
  advanced?: Record<string, any>;
}

export interface BaseImageParams {
  prompt: string;
  referenceImage: string[];
  aspectRatio?: string;
  advanced?: Record<string, any>;
}

export interface BaseSpeechParams {
  text: string;
  voice_id: string;
  mode: string;
  speed?: number;
  vol?: number;
  pitch?: number;
  emotion?: string;
}

// 基础适配器抽象类
export abstract class BaseAigcModel {
  public abstract name: string;
  public abstract displayName: string;
  public abstract description?: string;
  public abstract costDescription?: string;
  public abstract generationTypes: GenerationType[];

  // 抽象方法：子类必须实现自己的参数验证规则
  public abstract paramsSchema: z.ZodSchema<BaseVideoParams | BaseImageParams | BaseSpeechParams>;

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
