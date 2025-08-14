import { BaseGenerationAdapter } from '../core/base-adapter';
import {
  GenerationType,
  TextToImageParams,
  ImageToImageParams,
  TextToVideoParams,
  ImageToVideoParams,
  KeyframeToVideoParams,
  GenerationTaskResponse,
  ModelParameterLimits,
  GenerationTaskResult,
  CanvasSize,
} from '../../types';
import {
  WanService,
  t2iSubmitParamsSchema,
  i2vSubmitParamsSchema,
  t2vSubmitParamsSchema,
  kf2vSubmitParamsSchema,
  t2iGetResultParamsSchema,
  i2vGetResultParamsSchema,
  t2vGetResultParamsSchema,
  kf2vGetResultParamsSchema,
} from '../../services/wan';

export class WanAdapter extends BaseGenerationAdapter {
  private wanService: WanService;

  constructor() {
    super('wan');
    this.wanService = new WanService();
  }

  getSupportedGenerationTypes(): GenerationType[] {
    return ['text-to-image', 'image-to-video', 'text-to-video', 'keyframe-to-video'];
  }

  async getModels(
    generationType: GenerationType,
  ): Promise<{ model: string; displayName: string; description?: string; parameterLimits?: ModelParameterLimits }[]> {
    const models: Record<GenerationType, { model: string; displayName: string; description?: string; parameterLimits?: ModelParameterLimits }[]> = {
      'text-to-image': [
        {
          model: 'wan2.2-t2i-flash',
          displayName: '万相 T2I Flash',
          description: '快速文生图模型',
          parameterLimits: {
            canvasSize: {
              minWidth: 512,
              maxWidth: 1024,
              minHeight: 512,
              maxHeight: 1024,
              step: 64,
              aspectRatio: ['1:1', '16:9', '4:3', '9:16', '3:4'],
            },
          },
        },
        {
          model: 'wan2.2-t2i-plus',
          displayName: '万相 T2I Plus',
          description: '高质量文生图模型',
          parameterLimits: {
            canvasSize: {
              minWidth: 512,
              maxWidth: 1536,
              minHeight: 512,
              maxHeight: 1536,
              step: 64,
              aspectRatio: ['1:1', '16:9', '4:3', '9:16', '3:4'],
            },
          },
        },
        {
          model: 'wanx2.1-t2i-turbo',
          displayName: '万相 2.1 T2I Turbo',
          description: '快速文生图模型',
          parameterLimits: {
            canvasSize: {
              minWidth: 512,
              maxWidth: 1024,
              minHeight: 512,
              maxHeight: 1024,
              step: 64,
              aspectRatio: ['1:1', '16:9', '4:3', '9:16', '3:4'],
            },
          },
        },
        {
          model: 'wanx2.1-t2i-plus',
          displayName: '万相 2.1 T2I Plus',
          description: '高质量文生图模型',
          parameterLimits: {
            canvasSize: {
              minWidth: 512,
              maxWidth: 1536,
              minHeight: 512,
              maxHeight: 1536,
              step: 64,
              aspectRatio: ['1:1', '16:9', '4:3', '9:16', '3:4'],
            },
          },
        },
        {
          model: 'wanx2.0-t2i-turbo',
          displayName: '万相 2.0 T2I Turbo',
          description: '快速文生图模型',
          parameterLimits: {
            canvasSize: {
              minWidth: 512,
              maxWidth: 1024,
              minHeight: 512,
              maxHeight: 1024,
              step: 64,
              aspectRatio: ['1:1', '16:9', '4:3', '9:16', '3:4'],
            },
          },
        },
      ],
      'image-to-image': [], // 万相不支持图生图
      'image-to-video': [
        {
          model: 'wan2.2-i2v-flash',
          displayName: '万相 I2V Flash',
          description: '快速图生视频模型',
          parameterLimits: {
            canvasSize: {
              minWidth: 512,
              maxWidth: 1024,
              minHeight: 512,
              maxHeight: 1024,
              step: 64,
              aspectRatio: ['1:1', '16:9', '9:16'],
            },
            duration: [5],
          },
        },
        {
          model: 'wan2.2-i2v-plus',
          displayName: '万相 I2V Plus',
          description: '高质量图生视频模型',
          parameterLimits: {
            canvasSize: {
              minWidth: 512,
              maxWidth: 1024,
              minHeight: 512,
              maxHeight: 1024,
              step: 64,
              aspectRatio: ['1:1', '16:9', '9:16'],
            },
            duration: [5],
          },
        },
        {
          model: 'wanx2.1-i2v-plus',
          displayName: '万相 2.1 I2V Plus',
          description: '高质量图生视频模型',
          parameterLimits: {
            canvasSize: {
              minWidth: 512,
              maxWidth: 1024,
              minHeight: 512,
              maxHeight: 1024,
              step: 64,
              aspectRatio: ['1:1', '16:9', '9:16'],
            },
            duration: [5],
          },
        },
        {
          model: 'wanx2.1-i2v-turbo',
          displayName: '万相 2.1 I2V Turbo',
          description: '快速图生视频模型',
          parameterLimits: {
            canvasSize: {
              minWidth: 512,
              maxWidth: 1024,
              minHeight: 512,
              maxHeight: 1024,
              step: 64,
              aspectRatio: ['1:1', '16:9', '9:16'],
            },
            duration: [3, 4, 5],
          },
        },
      ],
      'text-to-video': [
        {
          model: 'wan2.2-t2v-plus',
          displayName: '万相 T2V Plus',
          description: '高质量文生视频模型',
          parameterLimits: {
            canvasSize: {
              minWidth: 512,
              maxWidth: 1024,
              minHeight: 512,
              maxHeight: 1024,
              step: 64,
              aspectRatio: ['1:1', '16:9', '9:16'],
            },
            duration: [5],
          },
        },
        {
          model: 'wanx2.1-t2v-turbo',
          displayName: '万相 2.1 T2V Turbo',
          description: '快速文生视频模型',
          parameterLimits: {
            canvasSize: {
              minWidth: 512,
              maxWidth: 1024,
              minHeight: 512,
              maxHeight: 1024,
              step: 64,
              aspectRatio: ['1:1', '16:9', '9:16'],
            },
            duration: [5],
          },
        },
        {
          model: 'wanx2.1-t2v-plus',
          displayName: '万相 2.1 T2V Plus',
          description: '高质量文生视频模型',
          parameterLimits: {
            canvasSize: {
              minWidth: 512,
              maxWidth: 1024,
              minHeight: 512,
              maxHeight: 1024,
              step: 64,
              aspectRatio: ['1:1', '16:9', '9:16'],
            },
            duration: [5],
          },
        },
      ],
      'keyframe-to-video': [
        {
          model: 'wanx2.1-kf2v-plus',
          displayName: '万相 2.1 首尾帧生视频',
          description: '首尾帧生视频模型',
          parameterLimits: {
            canvasSize: {
              minWidth: 512,
              maxWidth: 1024,
              minHeight: 512,
              maxHeight: 1024,
              step: 64,
              aspectRatio: ['1:1', '16:9', '9:16'],
            },
            duration: [5],
          },
        },
      ],
    };

    return models[generationType] || [];
  }

  async submitTask(
    model: string,
    generationType: GenerationType,
    params: TextToImageParams | ImageToImageParams | TextToVideoParams | ImageToVideoParams | KeyframeToVideoParams,
  ): Promise<GenerationTaskResponse> {
    try {
      // 验证参数
      this.validateParams(generationType, params);

      switch (generationType) {
        case 'text-to-image': {
          const t2iParams = params as TextToImageParams;
          const parsed = t2iSubmitParamsSchema.safeParse({
            model: model as 'wan2.2-t2i-flash' | 'wan2.2-t2i-plus' | 'wanx2.1-t2i-turbo' | 'wanx2.1-t2i-plus' | 'wanx2.0-t2i-turbo',
            input: {
              prompt: t2iParams.prompt,
            },
            parameters: {
              size: {
                width: t2iParams.canvasSize.width,
                height: t2iParams.canvasSize.height,
              },
              n: 1,
              seed: 0,
              prompt_extend: true,
              watermark: false,
            },
          });
          if (!parsed.success) {
            throw new Error(parsed.error.message);
          }
          const result = await this.wanService.t2iSubmit(parsed.data);
          return {
            success: true,
            taskId: result.output.task_id,
            data: result,
          };
        }

        case 'image-to-video': {
          const i2vParams = params as ImageToVideoParams;
          const parsed = i2vSubmitParamsSchema.safeParse({
            model: model as 'wan2.2-i2v-flash' | 'wan2.2-i2v-plus' | 'wanx2.1-i2v-plus' | 'wanx2.1-i2v-turbo',
            input: {
              prompt: i2vParams.prompt || '',
              image_url: i2vParams.referenceImage,
            },
            parameters: {
              resolution: this.getResolution(model),
              duration: i2vParams.duration,
              prompt_extend: true,
              seed: 0,
              watermark: false,
            },
          });
          if (!parsed.success) {
            throw new Error(parsed.error.message);
          }
          const result = await this.wanService.i2vSubmit(parsed.data);
          return {
            success: true,
            taskId: result.output.task_id,
            data: result,
          };
        }

        case 'text-to-video': {
          const t2vParams = params as TextToVideoParams;
          const parsed = t2vSubmitParamsSchema.safeParse({
            model: model as 'wan2.2-t2v-plus' | 'wanx2.1-t2v-turbo' | 'wanx2.1-t2v-plus',
            input: {
              prompt: t2vParams.prompt,
            },
            parameters: {
              size: this.getT2VSize(model),
              duration: t2vParams.duration,
              prompt_extend: true,
              seed: 0,
              watermark: false,
            },
          });
          if (!parsed.success) {
            throw new Error(parsed.error.message);
          }
          const result = await this.wanService.t2vSubmit(parsed.data);
          return {
            success: true,
            taskId: result.output.task_id,
            data: result,
          };
        }

        case 'keyframe-to-video': {
          const kf2vParams = params as KeyframeToVideoParams;
          const parsed = kf2vSubmitParamsSchema.safeParse({
            model: 'wanx2.1-kf2v-plus',
            input: {
              first_frame_url: kf2vParams.firstFrame,
              last_frame_url: kf2vParams.lastFrame,
              prompt: kf2vParams.prompt,
            },
            parameters: {
              duration: kf2vParams.duration,
            },
          });
          if (!parsed.success) {
            throw new Error(parsed.error.message);
          }
          const result = await this.wanService.kf2vSubmit(parsed.data);
          return {
            success: true,
            taskId: result.output.task_id,
            data: result,
          };
        }

        default:
          throw new Error(`不支持的生成类型: ${generationType}`);
      }
    } catch (error) {
      return this.handleError(error, 'submitTask');
    }
  }

  async getTaskResult(generationType: string, taskId: string): Promise<GenerationTaskResult> {
    try {
      switch (generationType) {
        case 'text-to-image': {
          const parsed = t2iGetResultParamsSchema.safeParse({ task_id: taskId });
          if (!parsed.success) {
            throw new Error(parsed.error.message);
          }
          const result = await this.wanService.t2iGetResult(parsed.data);
          return {
            status: this.getStatus(result.output.task_status),
            data: result.output.results?.map(item => ({ url: item.url, type: 'image' })) || [],
            usage: result.usage,
            error: result.output.task_status === 'FAILED' ? `[${result.output.code}] ${result.output.message}` || 'Task failed' : undefined,
          };
        }
        case 'image-to-video': {
          const parsed = i2vGetResultParamsSchema.safeParse({ task_id: taskId });
          if (!parsed.success) {
            throw new Error(parsed.error.message);
          }
          const result = await this.wanService.i2vGetResult(parsed.data);
          return {
            status: this.getStatus(result.output.task_status),
            data: [{ url: result.output.video_url, type: 'video' }],
            usage: result.usage,
            error: result.output.task_status === 'FAILED' ? `[${result.output.code}] ${result.output.message}` || 'Task failed' : undefined,
          };
        }
        case 'text-to-video': {
          const parsed = t2vGetResultParamsSchema.safeParse({ task_id: taskId });
          if (!parsed.success) {
            throw new Error(parsed.error.message);
          }
          const result = await this.wanService.t2vGetResult(parsed.data);
          return {
            status: this.getStatus(result.output.task_status),
            data: [{ url: result.output.video_url, type: 'video' }],
            usage: result.usage,
            error: result.output.task_status === 'FAILED' ? `[${result.output.code}] ${result.output.message}` || 'Task failed' : undefined,
          };
        }
        case 'keyframe-to-video': {
          const parsed = kf2vGetResultParamsSchema.safeParse({ task_id: taskId });
          if (!parsed.success) {
            throw new Error(parsed.error.message);
          }
          const result = await this.wanService.kf2vGetResult(parsed.data);
          return {
            status: this.getStatus(result.output.task_status),
            data: [{ url: result.output.video_url, type: 'video' }],
            usage: result.usage,
            error: result.output.task_status === 'FAILED' ? `[${result.output.code}] ${result.output.message}` || 'Task failed' : undefined,
          };
        }
        default:
          throw new Error(`不支持的生成类型: ${generationType}`);
      }
    } catch (error) {
      throw new Error(`获取任务结果失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private getStatus(
    status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' | 'UNKNOWN',
  ): 'pending' | 'processing' | 'completed' | 'failed' {
    switch (status) {
      case 'PENDING':
        return 'pending';
      case 'RUNNING':
        return 'processing';
      case 'SUCCEEDED':
        return 'completed';
      case 'FAILED':
        return 'failed';
      case 'CANCELED':
        return 'failed';
      case 'UNKNOWN':
        return 'failed';
      default:
        return 'failed';
    }
  }

  // 根据模型获取支持的分辨率
  private getResolution(model: string): '480P' | '720P' | '1080P' {
    switch (model) {
      case 'wan2.2-i2v-plus':
        return '1080P';
      case 'wan2.2-i2v-flash':
      case 'wanx2.1-i2v-plus':
      case 'wanx2.1-i2v-turbo':
        return '720P';
      default:
        return '720P';
    }
  }

  // 根据模型获取T2V的尺寸
  private getT2VSize(model: string): string {
    switch (model) {
      case 'wan2.2-t2v-plus':
        return '1920*1080';
      case 'wanx2.1-t2v-turbo':
      case 'wanx2.1-t2v-plus':
        return '1280*720';
      default:
        return '1280*720';
    }
  }
}
