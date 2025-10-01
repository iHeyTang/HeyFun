import z from 'zod';
import { GenerationTaskResponse, GenerationTaskResult, GenerationType } from '../types';
import { type JSONSchema } from 'zod/v4/core';

// 图片生成参数
export const imageParamsSchema = z.object({
  prompt: z.string(),
  referenceImage: z.array(z.string()).optional(),
  aspectRatio: z.string().optional(),
  advanced: z.any().optional(),
});

export type ImageJsonSchema = {
  prompt: JSONSchema.StringSchema;
  referenceImage: JSONSchema.ArraySchema;
  aspectRatio: JSONSchema.StringSchema;
  advanced: JSONSchema.ObjectSchema;
};

// 视频生成参数
export const videoParamsSchema = z.object({
  prompt: z.string(),
  firstFrame: z.string().optional(),
  lastFrame: z.string().optional(),
  referenceImage: z.array(z.string()).optional(),
  aspectRatio: z.string().optional(),
  resolution: z.string().optional(),
  duration: z.number().optional(),
  advanced: z.any().optional(),
});

export type VideoJsonSchema = {
  prompt: JSONSchema.StringSchema;
  firstFrame: JSONSchema.StringSchema;
  lastFrame: JSONSchema.StringSchema;
  referenceImage: JSONSchema.ArraySchema;
  aspectRatio: JSONSchema.StringSchema;
  resolution: JSONSchema.StringSchema;
  duration: JSONSchema.NumberSchema;
  advanced: JSONSchema.ObjectSchema;
};

// 语音生成参数
export const t2aParamsSchema = z.object({
  text: z.string(),
  voice_id: z.string().optional(),
  mode: z.string().optional(),
  speed: z.number().optional(),
  vol: z.number().optional(),
  pitch: z.number().optional(),
  emotion: z.string().optional(),
});

export type T2aJsonSchema = {
  text: JSONSchema.StringSchema;
  voice_id: JSONSchema.StringSchema;
  mode: JSONSchema.StringSchema;
  speed: JSONSchema.NumberSchema;
  vol: JSONSchema.NumberSchema;
  pitch: JSONSchema.NumberSchema;
  emotion: JSONSchema.StringSchema;
};

// 提交任务参数
export const submitTaskParamsSchema = z.union([imageParamsSchema, videoParamsSchema, t2aParamsSchema]);
export type SubmitTaskParams = z.infer<typeof submitTaskParamsSchema>;
export type SubmitTaskParamsJsonSchema = ImageJsonSchema | VideoJsonSchema | T2aJsonSchema;

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

  // 抽象方法：子类必须实现自己的参数验证规则
  public abstract paramsSchema: z.ZodSchema<z.infer<typeof videoParamsSchema> | z.infer<typeof imageParamsSchema> | z.infer<typeof t2aParamsSchema>>;

  abstract submitTask(params: z.infer<typeof this.paramsSchema>): Promise<string>;

  abstract getTaskResult(params: { model: string; taskId: string; params: SubmitTaskParams }): Promise<GenerationTaskResult>;

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
