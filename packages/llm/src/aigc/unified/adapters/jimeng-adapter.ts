import { BaseGenerationAdapter } from '../core/base-adapter';
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
import { volcengineJimengServiceConfigSchema } from '../../providers/volcengine/jimeng';
import z from 'zod';

export class JimengAdapter extends BaseGenerationAdapter {
  private jimengService: JimengService;

  constructor(config?: z.infer<typeof volcengineJimengServiceConfigSchema>) {
    super('jimeng');
    this.jimengService = new JimengService(config ?? { accessKeyId: '', secretAccessKey: '' });
  }

  async getModels(): Promise<Record<string, ModelInfo>> {
    const modelMap: Record<string, ModelInfo> = {
      jimeng_t2i_v30: {
        displayName: '即梦 文生图 3.0',
        description: '高质量文生图模型',
        parameterLimits: {
          generationType: ['text-to-image'],
          aspectRatio: ['16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '1:1', '21:9'],
        },
      },
      jimeng_t2i_v31: {
        displayName: '即梦 文生图 3.1',
        description: '高质量文生图模型',
        parameterLimits: {
          generationType: ['text-to-image'],
          aspectRatio: ['16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '1:1', '21:9'],
        },
      },
      jimeng_i2i_v30: {
        displayName: '即梦 图生图 3.0',
        description: '高质量图生图模型',
        parameterLimits: {
          generationType: ['image-to-image'],
          aspectRatio: ['16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '1:1', '21:9'],
        },
      },
      jimeng_vgfm_t2v_l20: {
        displayName: '即梦 文生视频 S2.0 Pro',
        description: '专业文生视频模型',
        parameterLimits: {
          generationType: ['text-to-video'],
          aspectRatio: ['16:9', '9:16', '4:3', '3:4', '21:9'],
        },
      },
      jimeng_vgfm_i2v_l20: {
        displayName: '即梦 图生视频 S2.0 Pro',
        description: '专业图生视频模型',
        parameterLimits: {
          generationType: ['image-to-video'],
          aspectRatio: [],
        },
      },
    };
    return modelMap;
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
          const size = this.convertAspectRatioToImageSize(model, t2iParams.aspectRatio);
          const parsed = t2iSubmitParamsSchema.safeParse({
            req_key: model as 'jimeng_t2i_v30' | 'jimeng_t2i_v31',
            prompt: t2iParams.prompt,
            seed: -1, // 使用默认种子
            width: size?.width,
            height: size?.height,
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
          const size = this.convertAspectRatioToImageSize(model, i2iParams.aspectRatio);
          const parsed = i2iSubmitParamsSchema.safeParse({
            req_key: 'jimeng_i2i_v30',
            prompt: i2iParams.prompt,
            seed: -1, // 使用默认种子
            width: size?.width,
            height: size?.height,
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
            aspect_ratio: t2vParams.aspectRatio,
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
            aspect_ratio: i2vParams.aspectRatio,
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

  async getTaskResult(params: { generationType: string; model: string; taskId: string }): Promise<GenerationTaskResult> {
    const { generationType, model, taskId } = params;
    try {
      switch (generationType) {
        case 'text-to-image': {
          const parsed = t2iGetResultParamsSchema.safeParse({ task_id: taskId, req_key: model, req_json: { return_url: true } });
          if (!parsed.success) {
            throw new Error(parsed.error.message);
          }
          const result = await this.jimengService.t2iGetResult(parsed.data);
          console.log('result', result);
          return {
            status: this.getStatus(result.data.status),
            data: result.data.image_urls?.map(url => ({ url, type: 'image' })) || [],
            usage: {
              image_count: result.data.image_urls?.length || 0,
            },
          };
        }
        case 'image-to-image': {
          const parsed = i2iGetResultParamsSchema.safeParse({ task_id: taskId, req_key: model, req_json: { return_url: true } });
          if (!parsed.success) {
            throw new Error(parsed.error.message);
          }
          const result = await this.jimengService.i2iGetResult(parsed.data);
          return {
            status: this.getStatus(result.data.status),
            data: result.data.image_urls?.map(url => ({ url, type: 'image' })) || [],
            usage: {
              image_count: result.data.image_urls?.length || 0,
            },
          };
        }
        case 'text-to-video': {
          const parsed = t2vGetResultParamsSchema.safeParse({ task_id: taskId, req_key: model, req_json: { return_url: true } });
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
          const parsed = i2vGetResultParamsSchema.safeParse({ task_id: taskId, req_key: model, req_json: { return_url: true } });
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

  /**
   *
   * 暂时只接入1k标清
   * 1328 * 1328（1:1）
   * 1472 * 1104 （4:3）
   * 1584 * 1056（3:2）
   * 1664 * 936（16:9）
   * 2016 * 864（21:9）
   * @see https://www.volcengine.com/docs/85621/1616429
   * @see https://www.volcengine.com/docs/85621/1756900
   *
   * @param model 模型名称
   * @param aspectRatio 宽高比
   * @returns 尺寸
   */
  private convertAspectRatioToImageSize(model: string, aspectRatio: string): { width: number; height: number } | undefined {
    switch (aspectRatio) {
      case '1:1':
        return { width: 1328, height: 1328 };
      case '4:3':
        return { width: 1472, height: 1104 };
      case '3:2':
        return { width: 1584, height: 1056 };
      case '16:9':
        return { width: 1664, height: 936 };
      case '21:9':
        return { width: 2016, height: 864 };
      default:
        return undefined;
    }
  }
}
