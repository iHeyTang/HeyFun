/**
 * 通用 AIGC API 适配器 - 处理不同服务商的 API 调用
 */
import { ServiceAdapter, ModelProviderConfig } from './types';
import type {
  GenerationType,
  GenerationTaskRequest,
  GenerationTaskResponse,
  GenerationTaskResult,
  TextToImageParams,
  ImageToImageParams,
  TextToVideoParams,
  ImageToVideoParams,
  KeyframeToVideoParams,
} from '../../types';

export interface AigcApiAdapter {
  submitTask(params: GenerationTaskRequest): Promise<GenerationTaskResponse>;
  getTaskResult(taskId: string): Promise<GenerationTaskResult>;
}

/**
 * 通用 AIGC API 适配器实现
 */
export class UniversalAigcApiAdapter implements AigcApiAdapter {
  private adapter: ServiceAdapter;
  private modelConfig: ModelProviderConfig;

  constructor(adapter: ServiceAdapter, modelConfig: ModelProviderConfig) {
    this.adapter = adapter;
    this.modelConfig = modelConfig;
  }

  async submitTask(params: GenerationTaskRequest): Promise<GenerationTaskResponse> {
    const url = this.buildSubmitUrl(params.generationType);
    const headers = this.buildHeaders();
    const body = this.transformSubmitRequest(params);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      return this.transformSubmitResponse(data);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getTaskResult(taskId: string): Promise<GenerationTaskResult> {
    const url = this.buildResultUrl(taskId);
    const headers = this.buildHeaders();

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      return this.transformResultResponse(data);
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private buildSubmitUrl(generationType: GenerationType): string {
    const baseUrl = this.adapter.baseUrl || '';
    const endpoints = this.adapter.apiConfig.endpoints;

    let endpoint: string;
    switch (generationType) {
      case 'text-to-image':
        endpoint = endpoints.text_to_image?.submit || '';
        break;
      case 'image-to-image':
        endpoint = endpoints.image_to_image?.submit || '';
        break;
      case 'text-to-video':
        endpoint = endpoints.text_to_video?.submit || '';
        break;
      case 'image-to-video':
        endpoint = endpoints.image_to_video?.submit || '';
        break;
      case 'keyframe-to-video':
        endpoint = endpoints.keyframe_to_video?.submit || '';
        break;
      default:
        throw new Error(`Unsupported generation type: ${generationType}`);
    }

    return `${baseUrl}${endpoint}`;
  }

  private buildResultUrl(taskId: string): string {
    const baseUrl = this.adapter.baseUrl || '';
    // 使用第一个可用的 result endpoint，通常所有类型都使用相同的查询接口
    const endpoints = this.adapter.apiConfig.endpoints;

    let endpoint =
      endpoints.text_to_image?.result ||
      endpoints.image_to_image?.result ||
      endpoints.text_to_video?.result ||
      endpoints.image_to_video?.result ||
      endpoints.keyframe_to_video?.result ||
      '';

    // 替换 task_id 占位符
    endpoint = endpoint.replace('{task_id}', taskId);

    return `${baseUrl}${endpoint}`;
  }

  private buildHeaders(): Record<string, string> {
    const headers = { ...(this.adapter.apiConfig.headers || {}) };
    const { env } = this.adapter;

    // 根据认证方式添加授权头
    switch (this.adapter.authMethod) {
      case 'api-key':
        if (env.apiKey) {
          const apiKey = process.env[env.apiKey];
          if (!apiKey) {
            throw new Error(`API key not found for ${this.adapter.name}`);
          }
          headers['Authorization'] = `Bearer ${apiKey}`;
        }
        break;
      case 'access-key-secret':
        // Access key secret 认证通常在请求体中处理，不在 headers
        break;
    }

    return headers;
  }

  private transformSubmitRequest(params: GenerationTaskRequest): any {
    const transformName = this.adapter.apiConfig.requestTransform;

    if (transformName && SubmitRequestTransforms[transformName]) {
      return SubmitRequestTransforms[transformName](params, this.modelConfig.modelId, this.adapter);
    }

    // 默认格式
    return {
      model: this.modelConfig.modelId,
      input: params.params,
    };
  }

  private transformSubmitResponse(data: any): GenerationTaskResponse {
    const transformName = this.adapter.apiConfig.responseTransform;

    if (transformName && SubmitResponseTransforms[transformName]) {
      return SubmitResponseTransforms[transformName](data);
    }

    // 默认返回格式
    return {
      success: true,
      taskId: data.task_id || data.id,
      data,
    };
  }

  private transformResultResponse(data: any): GenerationTaskResult {
    const transformName = this.adapter.apiConfig.responseTransform;

    if (transformName && ResultResponseTransforms[transformName]) {
      return ResultResponseTransforms[transformName](data);
    }

    // 默认返回格式
    return {
      status: data.status || 'completed',
      data: data.output || data.result,
    };
  }
}

/**
 * 提交请求转换函数集合
 */
const SubmitRequestTransforms: Record<string, (params: GenerationTaskRequest, modelId: string, adapter: ServiceAdapter) => any> = {
  wanRequestTransform: (params, modelId) => {
    const { generationType } = params;

    switch (generationType) {
      case 'text-to-image':
        const t2iParams = params.params as TextToImageParams;
        return {
          model: modelId,
          input: {
            prompt: t2iParams.prompt,
            size: t2iParams.aspectRatio,
          },
        };
      case 'image-to-image':
        const i2iParams = params.params as ImageToImageParams;
        return {
          model: modelId,
          input: {
            prompt: i2iParams.prompt,
            ref_img: i2iParams.referenceImage,
            size: i2iParams.aspectRatio,
          },
        };
      case 'text-to-video':
        const t2vParams = params.params as TextToVideoParams;
        return {
          model: modelId,
          input: {
            prompt: t2vParams.prompt,
            size: t2vParams.aspectRatio,
            length: `${t2vParams.duration}s`,
          },
        };
      case 'image-to-video':
        const i2vParams = params.params as ImageToVideoParams;
        return {
          model: modelId,
          input: {
            prompt: i2vParams.prompt,
            first_frame_image: i2vParams.referenceImage,
            size: i2vParams.aspectRatio,
            length: `${i2vParams.duration}s`,
          },
        };
      case 'keyframe-to-video':
        const kf2vParams = params.params as KeyframeToVideoParams;
        return {
          model: modelId,
          input: {
            prompt: kf2vParams.prompt,
            first_frame_image: kf2vParams.firstFrame,
            last_frame_image: kf2vParams.lastFrame,
            size: kf2vParams.aspectRatio,
            length: `${kf2vParams.duration}s`,
          },
        };
      default:
        throw new Error(`Unsupported generation type: ${generationType}`);
    }
  },

  doubaoRequestTransform: (params, modelId, adapter) => {
    const { env } = adapter;
    const accessKey = process.env[env.accessKeyId!];
    const secretKey = process.env[env.accessKeySecret!];

    if (!accessKey || !secretKey) {
      throw new Error('Volcengine access keys not configured');
    }

    const { generationType } = params;
    const baseRequest = {
      req_key: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    switch (generationType) {
      case 'text-to-image':
        const t2iParams = params.params as TextToImageParams;
        return {
          ...baseRequest,
          model_version: modelId,
          prompt: t2iParams.prompt,
          width: getWidthFromAspectRatio(t2iParams.aspectRatio),
          height: getHeightFromAspectRatio(t2iParams.aspectRatio),
        };
      case 'image-to-image':
        const i2iParams = params.params as ImageToImageParams;
        return {
          ...baseRequest,
          model_version: modelId,
          prompt: i2iParams.prompt,
          ref_img: i2iParams.referenceImage,
          width: getWidthFromAspectRatio(i2iParams.aspectRatio),
          height: getHeightFromAspectRatio(i2iParams.aspectRatio),
        };
      case 'text-to-video':
        const t2vParams = params.params as TextToVideoParams;
        return {
          ...baseRequest,
          model_version: modelId,
          prompt: t2vParams.prompt,
          video_duration: t2vParams.duration,
        };
      case 'image-to-video':
        const i2vParams = params.params as ImageToVideoParams;
        return {
          ...baseRequest,
          model_version: modelId,
          prompt: i2vParams.prompt,
          image: i2vParams.referenceImage,
          video_duration: i2vParams.duration,
        };
      case 'keyframe-to-video':
        const kf2vParams = params.params as KeyframeToVideoParams;
        return {
          ...baseRequest,
          model_version: modelId,
          prompt: kf2vParams.prompt,
          first_frame_image: kf2vParams.firstFrame,
          last_frame_image: kf2vParams.lastFrame,
          video_duration: kf2vParams.duration,
        };
      default:
        throw new Error(`Unsupported generation type: ${generationType}`);
    }
  },

  jimengRequestTransform: (params, modelId, adapter) => {
    const { env } = adapter;
    const accessKey = process.env[env.accessKeyId!];
    const secretKey = process.env[env.accessKeySecret!];

    if (!accessKey || !secretKey) {
      throw new Error('Volcengine access keys not configured');
    }

    const { generationType } = params;
    const baseRequest = {
      req_key: `jimeng_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    switch (generationType) {
      case 'text-to-image':
        const t2iParams = params.params as TextToImageParams;
        return {
          ...baseRequest,
          model_version: modelId,
          prompt: t2iParams.prompt,
          width: getWidthFromAspectRatio(t2iParams.aspectRatio),
          height: getHeightFromAspectRatio(t2iParams.aspectRatio),
          // 即梦特有参数
          style_mode: 1, // 默认自由创作模式
          use_sr: false, // 是否启用超分辨率
          use_variation_seed: false, // 是否使用变化种子
        };
      case 'image-to-image':
        const i2iParams = params.params as ImageToImageParams;
        return {
          ...baseRequest,
          model_version: modelId,
          prompt: i2iParams.prompt,
          ref_img: i2iParams.referenceImage,
          width: getWidthFromAspectRatio(i2iParams.aspectRatio),
          height: getHeightFromAspectRatio(i2iParams.aspectRatio),
          // 即梦图生图特有参数
          style_mode: 1,
          use_sr: false,
          strength: 0.75, // 参考图像强度，0-1之间
        };
      case 'text-to-video':
        const t2vParams = params.params as TextToVideoParams;
        return {
          ...baseRequest,
          model_version: modelId,
          prompt: t2vParams.prompt,
          video_duration: t2vParams.duration || 4, // 默认4秒
          // 即梦视频生成特有参数
          resolution: '1280x720', // 默认分辨率
          fps: 8, // 帧率
          seed: -1, // 随机种子，-1表示随机
        };
      case 'image-to-video':
        const i2vParams = params.params as ImageToVideoParams;
        return {
          ...baseRequest,
          model_version: modelId,
          prompt: i2vParams.prompt || '',
          image: i2vParams.referenceImage,
          video_duration: i2vParams.duration || 4,
          // 即梦图生视频特有参数
          resolution: '1280x720',
          fps: 8,
          seed: -1,
          motion_strength: 0.8, // 运动强度，0-1之间
        };
      default:
        throw new Error(`Unsupported generation type: ${generationType}`);
    }
  },
};

/**
 * 工具函数
 */
function getWidthFromAspectRatio(aspectRatio: string): number {
  const ratioMap: Record<string, number> = {
    '1:1': 1024,
    '3:4': 768,
    '4:3': 1024,
    '16:9': 1024,
    '9:16': 576,
  };
  return ratioMap[aspectRatio] || 1024;
}

function getHeightFromAspectRatio(aspectRatio: string): number {
  const ratioMap: Record<string, number> = {
    '1:1': 1024,
    '3:4': 1024,
    '4:3': 768,
    '16:9': 576,
    '9:16': 1024,
  };
  return ratioMap[aspectRatio] || 1024;
}

/**
 * 提交响应转换函数集合
 */
const SubmitResponseTransforms: Record<string, (data: any) => GenerationTaskResponse> = {
  wanResponseTransform: data => ({
    success: !data.code || data.code === '200',
    taskId: data.output?.task_id || data.task_id,
    error: data.message,
    data,
  }),

  doubaoResponseTransform: data => ({
    success: data.code === 10000,
    taskId: data.data?.primary_task_id || data.data?.task_id,
    error: data.message,
    data,
  }),

  jimengResponseTransform: data => {
    // 即梦API的成功码可能是不同的值
    const isSuccess = data.code === 10000 || data.status === 'success' || data.code === 200;
    
    return {
      success: isSuccess,
      taskId: data.data?.primary_task_id || data.data?.task_id || data.task_id,
      error: data.message || data.msg || data.error,
      data,
    };
  },
};

/**
 * 结果响应转换函数集合
 */
const ResultResponseTransforms: Record<string, (data: any) => GenerationTaskResult> = {
  wanResponseTransform: data => {
    const output = data.output;
    if (!output) {
      return {
        status: data.task_status === 'SUCCEEDED' ? 'completed' : data.task_status === 'FAILED' ? 'failed' : 'processing',
        error: data.message,
      };
    }

    const results = output.results || [];
    return {
      status: data.task_status === 'SUCCEEDED' ? 'completed' : data.task_status === 'FAILED' ? 'failed' : 'processing',
      data: results.map((result: any) => ({
        url: result.url,
        type: result.url.includes('.mp4') ? 'video' : 'image',
      })),
      usage: output.usage,
    };
  },

  doubaoResponseTransform: data => {
    if (data.code !== 10000) {
      return {
        status: 'failed',
        error: data.message,
      };
    }

    const taskData = data.data;
    const status = taskData.task_status === 'SUCCESS' ? 'completed' : taskData.task_status === 'FAILED' ? 'failed' : 'processing';

    if (status !== 'completed' || !taskData.output_image_url) {
      return { status, error: taskData.reason };
    }

    return {
      status,
      data: [
        {
          url: taskData.output_image_url,
          type: 'image',
        },
      ],
    };
  },

  jimengResponseTransform: data => {
    // 即梦API可能有不同的响应结构
    if (data.code !== 10000 && data.status !== 'success' && data.code !== 200) {
      return {
        status: 'failed',
        error: data.message || data.msg || data.error || 'Unknown error',
      };
    }

    const taskData = data.data || data;
    
    // 处理不同的任务状态映射
    let status: 'processing' | 'completed' | 'failed';
    if (taskData.task_status === 'SUCCESS' || taskData.status === 'completed') {
      status = 'completed';
    } else if (taskData.task_status === 'FAILED' || taskData.status === 'failed') {
      status = 'failed';
    } else {
      status = 'processing';
    }

    if (status !== 'completed') {
      return { 
        status, 
        error: taskData.reason || taskData.error_msg || taskData.message 
      };
    }

    // 处理输出结果
    const outputResults = [];
    
    // 图片结果
    if (taskData.output_image_url) {
      outputResults.push({
        url: taskData.output_image_url,
        type: 'image' as const,
      });
    }
    
    // 视频结果
    if (taskData.output_video_url) {
      outputResults.push({
        url: taskData.output_video_url,
        type: 'video' as const,
      });
    }
    
    // 多个结果的情况
    if (taskData.output_urls && Array.isArray(taskData.output_urls)) {
      taskData.output_urls.forEach((url: string) => {
        outputResults.push({
          url,
          type: url.includes('.mp4') || url.includes('.avi') ? 'video' as const : 'image' as const,
        });
      });
    }

    return {
      status,
      data: outputResults.length > 0 ? outputResults : undefined,
      usage: taskData.usage,
    };
  },
};
