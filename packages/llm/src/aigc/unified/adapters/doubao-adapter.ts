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
} from '../../types';
import {
  DoubaoService,
  t2iSubmitParamsSchema,
  i2iSubmitParamsSchema,
  t2vSubmitParamsSchema,
  i2vSubmitParamsSchema,
  t2iGetResultParamsSchema,
  i2iGetResultParamsSchema,
  t2vGetResultParamsSchema,
  i2vGetResultParamsSchema,
} from '../../services/doubao';

export class DoubaoAdapter extends BaseGenerationAdapter {
  private doubaoService: DoubaoService;

  constructor() {
    super('doubao');
    this.doubaoService = new DoubaoService();
  }

  getSupportedGenerationTypes(): GenerationType[] {
    return ['text-to-image', 'image-to-image', 'text-to-video', 'image-to-video', 'keyframe-to-video'];
  }

  async getModels(
    generationType: GenerationType,
  ): Promise<{ model: string; displayName: string; description?: string; parameterLimits?: ModelParameterLimits }[]> {
    const models: Record<GenerationType, { model: string; displayName: string; description?: string; parameterLimits?: ModelParameterLimits }[]> = {
      'text-to-image': [
        {
          model: 'doubao-seedream-3-0-t2i-250415',
          displayName: 'Doubao-Seedream-3.0-t2i',
          description: '影视质感，文字更准，直出 2K 高清图',
          parameterLimits: {
            canvasSize: {
              minWidth: 512,
              maxWidth: 2048,
              minHeight: 512,
              maxHeight: 2048,
              step: 64,
              aspectRatio: ['1:1', '16:9', '4:3', '9:16', '3:4'],
            },
          },
        },
      ],
      'image-to-image': [
        {
          model: 'doubao-seededit-3-0-i2i-250628',
          displayName: 'Doubao-SeedEdit-3.0-i2i',
          description: '准确遵循编辑指令，有效保留图像内容',
          parameterLimits: {
            canvasSize: {
              minWidth: 256,
              maxWidth: 2048,
              minHeight: 256,
              maxHeight: 2048,
              step: 8,
              aspectRatio: ['1:1', '16:9', '4:3', '9:16', '3:4'],
            },
          },
        },
      ],
      'text-to-video': [
        {
          model: 'doubao-seedance-1-0-lite-t2v-250428',
          displayName: 'Doubao-Seedance-1.0-lite-t2v',
          description: '精准响应，性价比高',
          parameterLimits: {
            canvasSize: {
              minWidth: 512,
              maxWidth: 1024,
              minHeight: 512,
              maxHeight: 1024,
              step: 64,
              aspectRatio: ['16:9', '9:16', '4:3', '3:4'],
            },
            duration: [5, 10],
          },
        },
        {
          model: 'doubao-seedance-1-0-pro-250528',
          displayName: 'Doubao-Seedance-1.0-pro',
          description: '全面强大，独具多镜头叙事能力',
          parameterLimits: {
            canvasSize: {
              minWidth: 512,
              maxWidth: 1024,
              minHeight: 512,
              maxHeight: 1024,
              step: 64,
              aspectRatio: ['16:9', '9:16', '4:3', '3:4'],
            },
            duration: [5, 10],
          },
        },
      ],
      'image-to-video': [
        {
          model: 'doubao-seedance-1-0-lite-i2v-250428',
          displayName: 'Doubao-Seedance-1.0-lite-i2v',
          description: '支持首尾帧，精准响应，性价比高',
          parameterLimits: {
            canvasSize: {
              minWidth: 512,
              maxWidth: 1024,
              minHeight: 512,
              maxHeight: 1024,
              step: 64,
              aspectRatio: ['16:9', '9:16', '4:3', '3:4'],
            },
            duration: [5, 10],
          },
        },
        {
          model: 'doubao-seedance-1-0-pro-250528',
          displayName: 'Doubao-Seedance-1.0-pro',
          description: '全面强大，独具多镜头叙事能力',
          parameterLimits: {
            canvasSize: {
              minWidth: 512,
              maxWidth: 1024,
              minHeight: 512,
              maxHeight: 1024,
              step: 64,
              aspectRatio: ['16:9', '9:16', '4:3', '3:4'],
            },
            duration: [5, 10],
          },
        },
      ],
      'keyframe-to-video': [
        {
          model: 'doubao-seedance-1-0-lite-i2v-250428',
          displayName: 'Doubao-Seedance-1.0-lite-i2v',
          description: '支持首尾帧，精准响应，性价比高',
          parameterLimits: {
            canvasSize: {
              minWidth: 512,
              maxWidth: 1024,
              minHeight: 512,
              maxHeight: 1024,
              step: 64,
              aspectRatio: ['16:9', '9:16', '4:3', '3:4'],
            },
            duration: [5, 10],
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
          if (model !== 'doubao-seedream-3-0-t2i-250415') {
            throw new Error('不支持的模型');
          }
          const t2iParams = params as TextToImageParams;
          const parsed = t2iSubmitParamsSchema.safeParse({
            model: model,
            prompt: t2iParams.prompt,
            size: `${t2iParams.canvasSize.width}x${t2iParams.canvasSize.height}`,
          });
          if (!parsed.success) {
            throw new Error(parsed.error.message);
          }
          const result = await this.doubaoService.t2iSubmit(parsed.data);
          return {
            success: true,
            taskId: result.task_id,
            data: result,
          };
        }

        case 'image-to-image': {
          const i2iParams = params as ImageToImageParams;
          const parsed = i2iSubmitParamsSchema.safeParse({
            model: 'doubao-seededit-3-0-i2i-250628',
            prompt: i2iParams.prompt,
            image: i2iParams.referenceImage,
            size: 'adaptive',
            seed: -1,
            guidance_scale: 5.5,
            watermark: true,
            response_format: 'url',
          });
          if (!parsed.success) {
            throw new Error(parsed.error.message);
          }
          const result = await this.doubaoService.i2iSubmit(parsed.data);
          return {
            success: true,
            taskId: result.task_id,
            data: result,
          };
        }

        case 'text-to-video': {
          const t2vParams = params as TextToVideoParams;
          const parsed = t2vSubmitParamsSchema.safeParse({
            model: 'doubao-seedance-1-0-lite-t2v-250428',
            prompt: t2vParams.prompt,
            duration: t2vParams.duration,
            ratio: this.getAspectRatio(t2vParams.canvasSize),
            seed: -1,
            watermark: true,
            resolution: '720p',
            fps: 24,
          });
          if (!parsed.success) {
            throw new Error(parsed.error.message);
          }
          const result = await this.doubaoService.t2vSubmit(parsed.data);
          return {
            success: true,
            taskId: result.id,
            data: result,
          };
        }

        case 'image-to-video': {
          const i2vParams = params as ImageToVideoParams;
          const parsed = i2vSubmitParamsSchema.safeParse({
            model: 'doubao-seedance-1-0-lite-i2v-250428',
            prompt: i2vParams.prompt,
            image_url: i2vParams.referenceImage,
            duration: i2vParams.duration,
            ratio: this.getAspectRatio(i2vParams.canvasSize),
            seed: -1,
            watermark: true,
            resolution: '720p',
            fps: 24,
          });
          if (!parsed.success) {
            throw new Error(parsed.error.message);
          }
          const result = await this.doubaoService.i2vSubmit(parsed.data);
          return {
            success: true,
            taskId: result.id,
            data: result,
          };
        }

        case 'keyframe-to-video': {
          // 豆包暂时不支持首尾帧生视频
          throw new Error('豆包服务暂不支持首尾帧生视频');
        }

        default:
          throw new Error(`不支持的生成类型: ${generationType}`);
      }
    } catch (error) {
      return this.handleError(error, 'submitTask');
    }
  }

  async getTaskResult(params: { generationType: string; model: string; taskId: string }): Promise<GenerationTaskResult> {
    const { generationType, model, taskId } = params;
    try {
      switch (generationType) {
        case 'text-to-image': {
          const parsed = t2iGetResultParamsSchema.safeParse({ task_id: taskId, model: model });
          if (!parsed.success) {
            throw new Error(parsed.error.message);
          }
          const result = await this.doubaoService.t2iGetResult(parsed.data);
          return {
            status: this.getStatus(result.status),
            data: result.data.map(item => ({ url: item.url, type: 'image' })),
            usage: {
              image_count: result.data.length,
            },
          };
        }
        case 'image-to-image': {
          const parsed = i2iGetResultParamsSchema.safeParse({ task_id: taskId, model: model });
          if (!parsed.success) {
            throw new Error(parsed.error.message);
          }
          const result = await this.doubaoService.i2iGetResult(parsed.data);
          return {
            status: this.getStatus(result.status),
            data: result.data.map(item => ({ url: item.url, type: 'image' })),
            usage: {
              image_count: result.data.length,
            },
          };
        }
        case 'text-to-video': {
          const parsed = t2vGetResultParamsSchema.safeParse({ task_id: taskId, model: model });
          if (!parsed.success) {
            throw new Error(parsed.error.message);
          }
          const result = await this.doubaoService.t2vGetResult(parsed.data);
          return {
            status: this.getStatus(result.status),
            data: [{ url: result.content.video_url, type: 'video' }],
            usage: {
              video_duration: 5,
              video_count: 1,
            },
          };
        }
        case 'image-to-video': {
          const parsed = i2vGetResultParamsSchema.safeParse({ task_id: taskId, model: model });
          if (!parsed.success) {
            throw new Error(parsed.error.message);
          }
          const result = await this.doubaoService.i2vGetResult(parsed.data);
          return {
            status: this.getStatus(result.status),
            data: [{ url: result.content.video_url, type: 'video' }],
            usage: {
              video_duration: 5,
              video_count: 1,
            },
          };
        }
        case 'keyframe-to-video': {
          // 豆包暂时不支持首尾帧生视频
          throw new Error('豆包服务暂不支持首尾帧生视频');
        }
        default:
          throw new Error(`不支持的生成类型: ${generationType}`);
      }
    } catch (error) {
      throw new Error(`获取任务结果失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 根据画幅大小计算宽高比
  private getAspectRatio(canvasSize: { width: number; height: number }): '16:9' | '9:16' | '4:3' | '3:4' {
    const ratio = canvasSize.width / canvasSize.height;
    if (Math.abs(ratio - 16 / 9) < 0.1) return '16:9';
    if (Math.abs(ratio - 4 / 3) < 0.1) return '4:3';
    if (Math.abs(ratio - 1 / 1) < 0.1) return '16:9'; // 1:1 映射到 16:9
    if (Math.abs(ratio - 9 / 16) < 0.1) return '9:16';
    return '16:9'; // 默认宽高比
  }

  private getStatus(status: 'failed' | 'running' | 'succeeded' | 'queued' | 'cancelled'): 'pending' | 'processing' | 'completed' | 'failed' {
    switch (status) {
      case 'failed':
        return 'failed';
      case 'running':
        return 'processing';
      case 'succeeded':
        return 'completed';
      case 'queued':
        return 'pending';
      case 'cancelled':
        return 'failed';
      default:
        return 'failed';
    }
  }
}
