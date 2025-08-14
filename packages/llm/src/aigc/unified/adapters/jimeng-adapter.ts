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
  JimengService,
  t2iSubmitParamsSchema,
  i2iSubmitParamsSchema,
  t2vSubmitParamsSchema,
  i2vSubmitParamsSchema,
  t2iGetResultParamsSchema,
  i2iGetResultParamsSchema,
  t2vGetResultParamsSchema,
  i2vGetResultParamsSchema,
} from '../../services/jimeng';

export class JimengAdapter extends BaseGenerationAdapter {
  private jimengService: JimengService;

  constructor() {
    super('jimeng');
    this.jimengService = new JimengService();
  }

  getSupportedGenerationTypes(): GenerationType[] {
    return ['text-to-image', 'image-to-image', 'text-to-video', 'image-to-video'];
  }

  async getModels(
    generationType: GenerationType,
  ): Promise<{ model: string; displayName: string; description?: string; parameterLimits?: ModelParameterLimits }[]> {
    const models: Record<GenerationType, { model: string; displayName: string; description?: string; parameterLimits?: ModelParameterLimits }[]> = {
      'text-to-image': [
        {
          model: 'jimeng_high_aes_general_v21_L',
          displayName: '即梦 文生图 2.1',
          description: '高质量文生图模型',
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
          model: 'jimeng_t2i_v30',
          displayName: '即梦 文生图 3.0',
          description: '高质量文生图模型',
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
          model: 'jimeng_t2i_v31',
          displayName: '即梦 文生图 3.1',
          description: '高质量文生图模型',
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
      'image-to-image': [
        {
          model: 'jimeng_i2i_v30',
          displayName: '即梦 图生图 3.0',
          description: '高质量图生图模型',
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
      'text-to-video': [
        {
          model: 'jimeng_vgfm_t2v_l20',
          displayName: '即梦 文生视频 S2.0 Pro',
          description: '专业文生视频模型',
          parameterLimits: {
            canvasSize: {
              minWidth: 512,
              maxWidth: 1024,
              minHeight: 512,
              maxHeight: 1024,
              step: 64,
              aspectRatio: ['16:9', '9:16', '4:3', '3:4', '21:9'],
            },
          },
        },
      ],
      'image-to-video': [
        {
          model: 'jimeng_vgfm_i2v_l20',
          displayName: '即梦 图生视频 S2.0 Pro',
          description: '专业图生视频模型',
          parameterLimits: {
            canvasSize: {
              minWidth: 512,
              maxWidth: 1024,
              minHeight: 512,
              maxHeight: 1024,
              step: 64,
              aspectRatio: ['16:9', '9:16', '4:3', '3:4', '21:9'],
            },
          },
        },
      ],
      'keyframe-to-video': [
        // 即梦暂时没有首尾帧生视频模型
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
            req_key: model as 'jimeng_t2i_v30' | 'jimeng_t2i_v31',
            prompt: t2iParams.prompt,
            seed: -1, // 使用默认种子
            width: t2iParams.canvasSize.width,
            height: t2iParams.canvasSize.height,
            use_pre_llm: true, // 使用预训练LLM
          });
          if (!parsed.success) {
            throw new Error(parsed.error.message);
          }
          const result = await this.jimengService.t2iSubmit(parsed.data);
          return {
            success: true,
            taskId: result.data.task_id,
            data: result,
          };
        }

        case 'image-to-image': {
          const i2iParams = params as ImageToImageParams;
          const parsed = i2iSubmitParamsSchema.safeParse({
            req_key: 'jimeng_i2i_v30',
            prompt: i2iParams.prompt,
            seed: -1, // 使用默认种子
            width: i2iParams.canvasSize.width,
            height: i2iParams.canvasSize.height,
            scale: 0.5, // 默认缩放比例
            binary_data_base64: [i2iParams.referenceImage],
            image_url: [i2iParams.referenceImage],
          });
          if (!parsed.success) {
            throw new Error(parsed.error.message);
          }
          const result = await this.jimengService.i2iSubmit(parsed.data);
          return {
            success: true,
            taskId: result.data.task_id,
            data: result,
          };
        }

        case 'text-to-video': {
          const t2vParams = params as TextToVideoParams;
          const parsed = t2vSubmitParamsSchema.safeParse({
            req_key: 'jimeng_vgfm_t2v_l20',
            prompt: t2vParams.prompt,
            seed: -1, // 使用默认种子
            aspect_ratio: this.getAspectRatio(t2vParams.canvasSize),
          });
          if (!parsed.success) {
            throw new Error(parsed.error.message);
          }
          const result = await this.jimengService.t2vSubmit(parsed.data);
          return {
            success: true,
            taskId: result.data.task_id,
            data: result,
          };
        }

        case 'image-to-video': {
          const i2vParams = params as ImageToVideoParams;
          const parsed = i2vSubmitParamsSchema.safeParse({
            req_key: 'jimeng_vgfm_i2v_l20',
            prompt: i2vParams.prompt,
            seed: -1, // 使用默认种子
            aspect_ratio: this.getAspectRatio(i2vParams.canvasSize),
            binary_data_base64: [i2vParams.referenceImage],
            image_urls: [i2vParams.referenceImage],
          });
          if (!parsed.success) {
            throw new Error(parsed.error.message);
          }
          const result = await this.jimengService.i2vSubmit(parsed.data);
          return {
            success: true,
            taskId: result.data.task_id,
            data: result,
          };
        }

        case 'keyframe-to-video': {
          // 即梦暂时不支持首尾帧生视频
          throw new Error('即梦服务暂不支持首尾帧生视频');
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
          const result = await this.jimengService.t2iGetResult(parsed.data);
          return {
            status: this.getStatus(result.data.status),
            data: result.data.image_urls.map(url => ({ url, type: 'image' })),
            usage: {
              image_count: result.data.image_urls.length,
            },
          };
        }
        case 'image-to-image': {
          const parsed = i2iGetResultParamsSchema.safeParse({ task_id: taskId });
          if (!parsed.success) {
            throw new Error(parsed.error.message);
          }
          const result = await this.jimengService.i2iGetResult(parsed.data);
          return {
            status: this.getStatus(result.data.status),
            data: result.data.image_urls.map(url => ({ url, type: 'image' })),
            usage: {
              image_count: result.data.image_urls.length,
            },
          };
        }
        case 'text-to-video': {
          const parsed = t2vGetResultParamsSchema.safeParse({ task_id: taskId });
          if (!parsed.success) {
            throw new Error(parsed.error.message);
          }
          const result = await this.jimengService.t2vGetResult(parsed.data);
          return {
            status: this.getStatus(result.data.status),
            data: [{ url: result.data.video_url, type: 'video' }],
            usage: {
              video_duration: 5,
              video_count: 1,
            },
          };
        }
        case 'image-to-video': {
          const parsed = i2vGetResultParamsSchema.safeParse({ task_id: taskId });
          if (!parsed.success) {
            throw new Error(parsed.error.message);
          }
          const result = await this.jimengService.i2vGetResult(parsed.data);
          return {
            status: this.getStatus(result.data.status),
            data: [{ url: result.data.video_url, type: 'video' }],
            usage: {
              video_duration: 5,
              video_count: 1,
            },
          };
        }
        case 'keyframe-to-video': {
          // 即梦暂时不支持首尾帧生视频
          throw new Error('即梦服务暂不支持首尾帧生视频');
        }
        default:
          throw new Error(`不支持的生成类型: ${generationType}`);
      }
    } catch (error) {
      throw new Error(`获取任务结果失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 根据画幅大小计算宽高比
  private getAspectRatio(canvasSize: { width: number; height: number }): '16:9' | '9:16' | '4:3' | '3:4' | '21:9' {
    const ratio = canvasSize.width / canvasSize.height;
    if (Math.abs(ratio - 16 / 9) < 0.1) return '16:9';
    if (Math.abs(ratio - 4 / 3) < 0.1) return '4:3';
    if (Math.abs(ratio - 1 / 1) < 0.1) return '16:9'; // 1:1 映射到 16:9
    if (Math.abs(ratio - 9 / 16) < 0.1) return '9:16';
    if (Math.abs(ratio - 21 / 9) < 0.1) return '21:9';
    return '16:9'; // 默认宽高比
  }

  private getStatus(status: 'in_queue' | 'generating' | 'done' | 'not_found' | 'expired'): 'pending' | 'processing' | 'completed' | 'failed' {
    switch (status) {
      case 'in_queue':
        return 'pending';
      case 'generating':
        return 'processing';
      case 'done':
        return 'completed';
      case 'not_found':
        return 'failed';
      case 'expired':
        return 'failed';
      default:
        return 'failed';
    }
  }
}
