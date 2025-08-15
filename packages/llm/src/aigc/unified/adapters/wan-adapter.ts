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
import { dashscopeWanServiceConfigSchema } from '../../providers/dashscope/wan';
import z from 'zod';

export class WanAdapter extends BaseGenerationAdapter {
  private wanService: WanService;

  constructor(config?: z.infer<typeof dashscopeWanServiceConfigSchema>) {
    super('wan');
    this.wanService = new WanService(config ?? { apiKey: '' });
  }

  async getModels(): Promise<Record<string, ModelInfo>> {
    const modelMap: Record<string, ModelInfo> = {
      'wan2.2-t2i-flash': {
        displayName: '万相 T2I Flash',
        description: '快速文生图模型',
        parameterLimits: {
          generationType: ['text-to-image'],
          aspectRatio: ['1:1', '16:9', '4:3', '9:16', '3:4'],
        },
      },
      'wan2.2-t2i-plus': {
        displayName: '万相 T2I Plus',
        description: '高质量文生图模型',
        parameterLimits: {
          generationType: ['text-to-image'],
          aspectRatio: ['1:1', '16:9', '4:3', '9:16', '3:4'],
        },
      },
      'wanx2.1-t2i-turbo': {
        displayName: '万相 2.1 T2I Turbo',
        description: '快速文生图模型',
        parameterLimits: {
          generationType: ['text-to-image'],
          aspectRatio: ['1:1', '16:9', '4:3', '9:16', '3:4'],
        },
      },
      'wanx2.1-t2i-plus': {
        displayName: '万相 2.1 T2I Plus',
        description: '高质量文生图模型',
        parameterLimits: {
          generationType: ['text-to-image'],
          aspectRatio: ['1:1', '16:9', '4:3', '9:16', '3:4'],
        },
      },
      'wanx2.0-t2i-turbo': {
        displayName: '万相 2.0 T2I Turbo',
        description: '快速文生图模型',
        parameterLimits: {
          generationType: ['text-to-image'],
          aspectRatio: ['1:1', '16:9', '4:3', '9:16', '3:4'],
        },
      },
      'wan2.2-i2v-flash': {
        displayName: '万相 I2V Flash',
        description: '快速图生视频模型',
        parameterLimits: {
          generationType: ['image-to-video'],
          aspectRatio: ['1:1', '16:9', '9:16'],
          duration: [5],
        },
      },
      'wan2.2-i2v-plus': {
        displayName: '万相 I2V Plus',
        description: '高质量图生视频模型',
        parameterLimits: {
          generationType: ['image-to-video'],
          aspectRatio: ['1:1', '16:9', '9:16'],
          duration: [5],
        },
      },
      'wanx2.1-i2v-plus': {
        displayName: '万相 2.1 I2V Plus',
        description: '高质量图生视频模型',
        parameterLimits: {
          generationType: ['image-to-video'],
          aspectRatio: ['1:1', '16:9', '9:16'],
          duration: [5],
        },
      },
      'wanx2.1-i2v-turbo': {
        displayName: '万相 2.1 I2V Turbo',
        description: '快速图生视频模型',
        parameterLimits: {
          generationType: ['image-to-video'],
          aspectRatio: ['1:1', '16:9', '9:16'],
          duration: [5],
        },
      },
      'wan2.2-t2v-plus': {
        displayName: '万相 T2V Plus',
        description: '高质量文生视频模型',
        parameterLimits: {
          generationType: ['text-to-video'],
          aspectRatio: ['1:1', '16:9', '9:16'],
          duration: [5],
        },
      },
      'wanx2.1-t2v-turbo': {
        displayName: '万相 2.1 T2V Turbo',
        description: '快速文生视频模型',
        parameterLimits: {
          generationType: ['text-to-video'],
          aspectRatio: ['1:1', '16:9', '9:16'],
          duration: [5],
        },
      },
      'wanx2.1-t2v-plus': {
        displayName: '万相 2.1 T2V Plus',
        description: '高质量文生视频模型',
        parameterLimits: {
          generationType: ['text-to-video'],
          aspectRatio: ['1:1', '16:9', '9:16'],
        },
      },
      'wanx2.1-kf2v-plus': {
        displayName: '万相 2.1 首尾帧生视频',
        description: '首尾帧生视频模型',
        parameterLimits: {
          generationType: ['keyframe-to-video'],
          aspectRatio: ['1:1', '16:9', '9:16'],
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
          const parsed = t2iSubmitParamsSchema.safeParse({
            model: model as 'wan2.2-t2i-flash' | 'wan2.2-t2i-plus' | 'wanx2.1-t2i-turbo' | 'wanx2.1-t2i-plus' | 'wanx2.0-t2i-turbo',
            input: {
              prompt: t2iParams.prompt,
            },
            parameters: {
              size: this.convertAspectRatioToImageSize(model, t2iParams.aspectRatio),
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

        case 'text-to-video': {
          const t2vParams = params as TextToVideoParams;
          const parsed = t2vSubmitParamsSchema.safeParse({
            model: model as 'wan2.2-t2v-plus' | 'wanx2.1-t2v-turbo' | 'wanx2.1-t2v-plus',
            input: {
              prompt: t2vParams.prompt,
            },
            parameters: {
              size: this.convertAspectRatioToVideoSize(model, t2vParams.aspectRatio),
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

        case 'image-to-video': {
          const i2vParams = params as ImageToVideoParams;
          const parsed = i2vSubmitParamsSchema.safeParse({
            model: model as 'wan2.2-i2v-flash' | 'wan2.2-i2v-plus' | 'wanx2.1-i2v-plus' | 'wanx2.1-i2v-turbo',
            input: {
              prompt: i2vParams.prompt || '',
              image_url: i2vParams.referenceImage,
            },
            parameters: {
              resolution: undefined,
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
              resolution: undefined,
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

  async getTaskResult(params: { generationType: string; model: string; taskId: string }): Promise<GenerationTaskResult> {
    const { generationType, model, taskId } = params;
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

  /**
   * 将宽高比转换为尺寸
   * 图像宽高边长的像素范围为：[512, 1440]，单位像素。可任意组合以设置不同的图像分辨率，最高可达200万像素。
   * @see https://bailian.console.aliyun.com/?spm=5176.30371578.J_wilqAZEFYRJvCsnM5_P7j.1.e939154aMDld0n&tab=api&scm=20140722.M_10875430.P_126.MO_3931-ID_10875430-MID_10875430-CID_34338-ST_14391-V_1#/api/?type=model&url=2862677
   *
   * @param model 模型名称
   * @param aspectRatio 宽高比
   * @returns 尺寸
   */
  private convertAspectRatioToImageSize(model: string, aspectRatio: string): string | undefined {
    switch (aspectRatio) {
      case '9:16':
        return '1280*1440';
      case '16:9':
        return '1440*1280';
      case '4:3':
        return '1024*1366';
      case '3:4':
        return '1366*1024';
      case '1:1':
        return '1024*1024';
      default:
        return undefined;
    }
  }

  /**
   *
   * 根据传入的宽高比和对应模型支持的最大resolution，计算出最接近的分辨率
   *
   * 用于指定视频分辨率，格式为宽*高。不同模型支持的分辨率如下：
   * wan2.2-t2v-plus：支持480P和1080P对应的所有分辨率。默认分辨率为1920*1080（1080P）。
   * wanx2.1-t2v-turbo：支持 480P 和 720P 对应的所有分辨率。默认分辨率为1280*720（720P）。
   * wanx2.1-t2v-plus：仅支持 720P 对应的所有分辨率。默认分辨率为1280*720（720P）。
   *
   * 480P档位：可选的视频分辨率及其对应的视频宽高比为：
   * 832*480：16:9。
   * 480*832：9:16。
   * 624*624：1:1。
   * 720P档位：可选的视频分辨率及其对应的视频宽高比为：
   * 1280*720：16:9。
   * 720*1280：9:16。
   * 960*960：1:1。
   * 1088*832：4:3。
   * 832*1088：3:4。
   * 1080P档位：可选的视频分辨率及其对应的视频宽高比为：
   * 1920*1080： 16:9。
   * 1080*1920： 9:16。
   * 1440*1440： 1:1。
   * 1632*1248： 4:3。
   * 1248*1632： 3:4。
   *
   * @see https://bailian.console.aliyun.com/?spm=5176.30371578.J_wilqAZEFYRJvCsnM5_P7j.1.e939154aMDld0n&tab=api&scm=20140722.M_10875430.P_126.MO_3931-ID_10875430-MID_10875430-CID_34338-ST_14391-V_1#/api/?type=model&url=2865250
   *
   * @param model 模型名称
   * @param aspectRatio 宽高比
   * @returns 分辨率
   */
  private convertAspectRatioToVideoSize(model: string, aspectRatio: string): string | undefined {
    const resolutionMap: Record<string, string> = {
      'wan2.2-t2v-plus': '1080',
      'wanx2.1-t2v-turbo': '720',
      'wanx2.1-t2v-plus': '720',
    };
    const resolution = resolutionMap[model];
    if (!resolution) {
      return undefined;
    }

    const sizeMap: Record<string, Record<string, string>> = {
      '9:16': {
        '1080': '1080*1920',
        '720': '720*1280',
        '480': '480*832',
      },
      '16:9': {
        '1080': '1920*1080',
        '720': '1280*720',
        '480': '832*480',
      },
      '4:3': {
        '1080': '1632*1248',
        '720': '1088*832',
        '480': '624*624',
      },
      '3:4': {
        '1080': '1248*1632',
        '720': '832*1088',
        '480': '624*624',
      },
      '1:1': {
        '1080': '1440*1440',
        '720': '960*960',
        '480': '624*624',
      },
    };

    return sizeMap[aspectRatio]?.[resolution];
  }
}
