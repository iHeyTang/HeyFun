import { z } from 'zod';
import { DashscopeWanProvider } from '../providers/dashscope/wan';

export const t2iSubmitParamsSchema = z.object({
  model: z.enum(['wan2.2-t2i-flash', 'wan2.2-t2i-plus', 'wanx2.1-t2i-turbo', 'wanx2.1-t2i-plus', 'wanx2.0-t2i-turbo']).describe('模型'),
  input: z.object({
    prompt: z.string(),
    negative_prompt: z.string().optional(),
  }),
  parameters: z
    .object({
      size: z
        .object({
          width: z.number().int().min(512).max(1440),
          height: z.number().int().min(512).max(1440),
        })
        .transform(val => `${val.width}*${val.height}`),
      n: z.number().int().min(1).max(4).default(4).optional(),
      seed: z.number().int().min(0).max(2147483647).optional(),
      prompt_extend: z.boolean().default(true).optional(),
      watermark: z.boolean().default(false).optional(),
    })
    .optional(),
});

export interface T2iSubmitResponse {
  output: {
    task_id: string;
    task_status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' | 'UNKNOWN';
  };
  request_id: string;
  code: string;
  message: string;
}

export const t2iGetResultParamsSchema = z.object({
  task_id: z.string(),
});

export interface T2iGetResultResponse {
  request_id: string;
  output: {
    task_id: string;
    task_status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' | 'UNKNOWN';
    submit_time: string;
    scheduled_time: string;
    end_time: string;
    results?: { orig_prompt: string; actual_prompt: string; url: string }[];
    task_metrics: { TOTAL: number; SUCCEEDED: number; FAILED: number };
    code?: string;
    message?: string;
  };
  usage: {
    image_count: number;
  };
}

export const i2vSubmitParamsSchema = z
  .object({
    model: z.enum(['wan2.2-i2v-flash', 'wan2.2-i2v-plus', 'wanx2.1-i2v-plus', 'wanx2.1-i2v-turbo']),
    input: z.object({
      prompt: z.string().optional(),
      negative_prompt: z.string().optional(),
      image_url: z.string(),
    }),
    parameters: z
      .object({
        resolution: z.enum(['480P', '720P', '1080P']).optional(),
        duration: z.number().int().min(3).max(5).default(5).optional(),
        prompt_extend: z.boolean().default(true).optional(),
        seed: z.number().int().min(0).max(2147483647).optional(),
        watermark: z.boolean().default(false).optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    i2vParamsSchemaResolutionSuperRefine(data, ctx);
    i2vParamsSchemaDurationSuperRefine(data, ctx);
  });

const i2vParamsSchemaResolutionSuperRefine = (data: z.infer<typeof i2vSubmitParamsSchema>, ctx: z.RefinementCtx) => {
  const model = data.model;
  let allowedResolutions: string[] = [];
  let defaultResolution: string = '';

  switch (model) {
    case 'wan2.2-i2v-plus':
      allowedResolutions = ['480P', '1080P'];
      defaultResolution = '1080P';
      break;
    case 'wan2.2-i2v-flash':
      allowedResolutions = ['480P', '720P'];
      defaultResolution = '720P';
      break;
    case 'wanx2.1-i2v-plus':
      allowedResolutions = ['720P'];
      defaultResolution = '720P';
      break;
    case 'wanx2.1-i2v-turbo':
      allowedResolutions = ['480P', '720P'];
      defaultResolution = '720P';
      break;
    default:
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '未知模型',
        path: ['model'],
      });
      return;
  }

  // 如果未传 resolution，则设置默认值
  if (!data.parameters || !data.parameters.resolution) {
    if (!data.parameters) data.parameters = {};
    data.parameters.resolution = defaultResolution as any;
  }

  // 校验 resolution 是否在允许范围
  if (data.parameters.resolution && !allowedResolutions.includes(data.parameters.resolution)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `模型 ${model} 仅支持分辨率: ${allowedResolutions.join('、')}，当前为 ${data.parameters.resolution}`,
      path: ['parameters', 'resolution'],
    });
  }
};

const i2vParamsSchemaDurationSuperRefine = (data: z.infer<typeof i2vSubmitParamsSchema>, ctx: z.RefinementCtx) => {
  // 校验 duration 合法性及设置默认值
  let allowedDurations: number[] = [];
  let defaultDuration = 5;

  switch (data.model) {
    case 'wan2.2-i2v-plus':
    case 'wan2.2-i2v-flash':
    case 'wanx2.1-i2v-plus':
      allowedDurations = [5];
      defaultDuration = 5;
      break;
    case 'wanx2.1-i2v-turbo':
      allowedDurations = [3, 4, 5];
      defaultDuration = 5;
      break;
  }

  // 如果未传 duration，则设置默认值
  if (!data.parameters || data.parameters.duration === undefined) {
    if (!data.parameters) data.parameters = {};
    data.parameters.duration = defaultDuration as any;
  }

  // 校验 duration 是否在允许范围
  if (data.parameters.duration !== undefined && !allowedDurations.includes(Number(data.parameters.duration))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `模型 ${data.model} 仅支持时长: ${allowedDurations.join('、')} 秒，当前为 ${data.parameters.duration}`,
      path: ['parameters', 'duration'],
    });
  }
};

export interface I2vSubmitResponse {
  output: {
    task_id: string;
    task_status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' | 'UNKNOWN';
  };
  request_id: string;
  code: string;
  message: string;
}

export const i2vGetResultParamsSchema = z.object({
  task_id: z.string(),
});

export interface I2vGetResultResponse {
  request_id: string;
  output: {
    task_id: string;
    task_status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' | 'UNKNOWN';
    submit_time: string;
    scheduled_time: string;
    end_time: string;
    video_url: string;
    orig_prompt: string;
    actual_prompt: string;
    code?: string;
    message?: string;
  };
  usage: {
    video_duration: number;
    video_ratio: string;
    video_count: number;
  };
}

export const kf2vSubmitParamsSchema = z.object({
  model: z.enum(['wanx2.1-kf2v-plus']),
  input: z.object({
    prompt: z.string().optional(),
    negative_prompt: z.string().optional(),
    first_frame_url: z.string(),
    last_frame_url: z.string(),
  }),
  parameters: z
    .object({
      resolution: z.enum(['720P']).optional(),
      duration: z.number().int().min(5).max(5).default(5).optional(),
      prompt_extend: z.boolean().default(true).optional(),
      seed: z.number().int().min(0).max(2147483647).optional(),
      watermark: z.boolean().default(false).optional(),
    })
    .optional(),
});

export interface Kf2vSubmitResponse {
  request_id: string;
  output: {
    task_id: string;
    task_status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' | 'UNKNOWN';
  };
  code: string;
  message: string;
}

export const kf2vGetResultParamsSchema = z.object({
  task_id: z.string(),
});

export interface Kf2vGetResultResponse {
  request_id: string;
  output: {
    task_id: string;
    task_status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' | 'UNKNOWN';
    submit_time: string;
    scheduled_time: string;
    end_time: string;
    video_url: string;
    orig_prompt: string;
    actual_prompt: string;
    code?: string;
    message?: string;
  };
  usage: { video_duration: number; video_ratio: string; video_count: number };
}

export const t2vSubmitParamsSchema = z
  .object({
    model: z.enum(['wan2.2-t2v-plus', 'wanx2.1-t2v-turbo', 'wanx2.1-t2v-plus']),
    input: z.object({
      prompt: z.string().optional(),
      negative_prompt: z.string().optional(),
    }),
    parameters: z
      .object({
        size: z.string().optional(),
        duration: z.number().int().min(3).max(5).default(5).optional(),
        prompt_extend: z.boolean().default(true).optional(),
        seed: z.number().int().min(0).max(2147483647).optional(),
        watermark: z.boolean().default(false).optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    const resolutionMap = {
      '480P': ['832*480', '480*832', '624*624'],
      '720P': ['1280*720', '720*1280', '960*960', '1088*832', '832*1088'],
      '1080P': ['1920*1080', '1080*1920', '1440*1440', '1632*1248', '1248*1632'],
    };

    // 校验 size 是否在允许范围，并设置默认值
    const allowedResolutions = {
      'wan2.2-t2v-plus': ['480P', '1080P'],
      'wanx2.1-t2v-turbo': ['480P', '720P'],
      'wanx2.1-t2v-plus': ['720P'],
    };

    const allowedSizes = Object.keys(allowedResolutions)
      .map(model => {
        const resolutions = allowedResolutions[model as keyof typeof allowedResolutions];
        const sizes = resolutions.flatMap(resolution => resolutionMap[resolution as keyof typeof resolutionMap]);
        return { model: model as keyof typeof allowedResolutions, sizes };
      })
      .reduce(
        (pre, cur) => {
          pre[cur.model] = cur.sizes;
          return pre;
        },
        {} as Record<keyof typeof allowedResolutions, string[]>,
      );

    const defaultSizes = {
      'wan2.2-t2v-plus': '1920*1080',
      'wanx2.1-t2v-turbo': '1280*720',
      'wanx2.1-t2v-plus': '1280*720',
    };

    const model = data.model;
    if (!data.parameters) data.parameters = {};

    if (!data.parameters.size) {
      data.parameters.size = defaultSizes[model];
    }

    if (!allowedSizes[model].includes(data.parameters.size)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `模型 ${model} 仅支持分辨率: ${allowedSizes[model].join('、')}，当前为 ${data.parameters.size}`,
        path: ['parameters', 'size'],
      });
    }
  });

export interface T2vSubmitResponse {
  request_id: string;
  output: {
    task_id: string;
    task_status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' | 'UNKNOWN';
  };
  code: string;
  message: string;
}

export const t2vGetResultParamsSchema = z.object({
  task_id: z.string(),
});

export interface T2vGetResultResponse {
  request_id: string;
  output: {
    task_id: string;
    task_status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' | 'UNKNOWN';
    submit_time: string;
    scheduled_time: string;
    end_time: string;
    video_url: string;
    orig_prompt: string;
    actual_prompt: string;
    code?: string;
    message?: string;
  };
  usage: { video_duration: number; video_ratio: string; video_count: number };
}

export class WanService {
  private provider: DashscopeWanProvider;
  constructor() {
    this.provider = new DashscopeWanProvider();
  }

  /**
   * 文生图
   * https://bailian.console.aliyun.com/?tab=api#/api/?type=model&url=2862677
   */
  async t2iSubmit(params: z.infer<typeof t2iSubmitParamsSchema>): Promise<T2iSubmitResponse> {
    console.log('t2iSubmit', params);
    return this.provider.t2iSubmit(params);
  }

  async t2iGetResult(params: z.infer<typeof t2iGetResultParamsSchema>): Promise<T2iGetResultResponse> {
    return this.provider.t2iGetResult(params);
  }

  /**
   * 图生视频(基于首帧)
   * https://bailian.console.aliyun.com/?tab=api#/api/?type=model&url=2867393
   */
  async i2vSubmit(params: z.infer<typeof i2vSubmitParamsSchema>): Promise<I2vSubmitResponse> {
    return this.provider.i2vSubmit(params);
  }

  async i2vGetResult(params: z.infer<typeof i2vGetResultParamsSchema>): Promise<I2vGetResultResponse> {
    return this.provider.i2vGetResult(params);
  }

  /**
   * 图生视频(基于首尾帧)
   * https://bailian.console.aliyun.com/?tab=api#/api/?type=model&url=2880649
   */
  async kf2vSubmit(params: z.infer<typeof kf2vSubmitParamsSchema>): Promise<Kf2vSubmitResponse> {
    return this.provider.kf2vSubmit(params);
  }

  async kf2vGetResult(params: z.infer<typeof kf2vGetResultParamsSchema>): Promise<Kf2vGetResultResponse> {
    return this.provider.kf2vGetResult(params);
  }

  /**
   * 文生视频
   * https://bailian.console.aliyun.com/?tab=api#/api/?type=model&url=2865250
   */
  async t2vSubmit(params: z.infer<typeof t2vSubmitParamsSchema>): Promise<T2vSubmitResponse> {
    return this.provider.t2vSubmit(params);
  }

  async t2vGetResult(params: z.infer<typeof t2vGetResultParamsSchema>): Promise<T2vGetResultResponse> {
    return this.provider.t2vGetResult(params);
  }
}
