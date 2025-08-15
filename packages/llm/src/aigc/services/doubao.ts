import { z } from 'zod';
import { VolcengineArkService, volcengineArkServiceConfigSchema } from '../providers/volcengine/ark';
import { ToAsyncTaskManager } from '../../utils/to-async-task';

// 文生图参数
export const t2iSubmitParamsSchema = z.object({
  model: z.literal('doubao-seedream-3-0-t2i-250415'),
  prompt: z.string(),
  size: z.enum(['1024x1024', '864x1152', '1152x864', '1280x720', '720x1280', '832x1248', '1248x832', '1512x648']).default('1024x1024'),
  seed: z.number().default(-1).optional(),
  guidance_scale: z.number().min(1).max(10).default(2.5).optional(),
  watermark: z.boolean().default(true).optional(),
  response_format: z.enum(['url', 'b64_json']).default('url').optional(),
});

export interface T2iSubmitResponse {
  task_id: string;
}

export const t2iGetResultParamsSchema = z.object({
  model: z.literal('doubao-seedream-3-0-t2i-250415'),
  id: z.string(),
});

export interface T2iGetResultResponse {
  model: string;
  created: Date;
  status: 'running' | 'succeeded' | 'failed';
  data: { url: string }[];
  usage: {
    generated_images: number;
    output_tokens: number;
    total_tokens: number;
  };
}

// 图生图参数
export const i2iSubmitParamsSchema = z.object({
  model: z.literal('doubao-seededit-3-0-i2i-250628'),
  prompt: z.string(),
  image: z.string(),
  size: z.literal('adaptive').default('adaptive'),
  seed: z.number().default(-1),
  guidance_scale: z.number().min(1).max(10).default(5.5),
  watermark: z.boolean().default(true),
  response_format: z.enum(['url', 'b64_json']).default('url'),
});

export interface I2iSubmitResponse {
  task_id: string;
}

export const i2iGetResultParamsSchema = z.object({
  model: z.literal('doubao-seededit-3-0-i2i-250628'),
  id: z.string(),
});

export interface I2iGetResultResponse {
  model: string;
  created: number;
  status: 'running' | 'succeeded' | 'failed';
  data: { url: string }[];
  usage: {
    generated_images: number;
    output_tokens: number;
    total_tokens: number;
  };
}

// 文生视频参数
export const t2vSubmitParamsSchema = z.discriminatedUnion('model', [
  z.object({
    model: z.literal('doubao-seedance-1-0-lite-t2v-250428'),
    prompt: z.string(),
    resolution: z.enum(['720p']).default('720p'),
    duration: z.number().int().min(5).max(5).default(5),
    ratio: z.enum(['16:9', '9:16', '4:3', '3:4']).default('16:9'),
    fps: z.number().int().min(24).max(24).default(24),
    seed: z.number().default(-1),
    watermark: z.boolean().default(true),
    callback_url: z.string().optional(),
  }),
  z.object({
    model: z.literal('doubao-seedance-1-0-pro-250528'),
    prompt: z.string(),
    resolution: z.enum(['720p']).default('720p'),
    duration: z.number().int().min(5).max(5).default(5),
    ratio: z.enum(['16:9', '9:16', '4:3', '3:4']).default('16:9'),
    fps: z.number().int().min(24).max(24).default(24),
    seed: z.number().default(-1),
    watermark: z.boolean().default(true),
    callback_url: z.string().optional(),
  }),
]);

export interface T2vSubmitResponse {
  id: string;
}

export const t2vGetResultParamsSchema = z.discriminatedUnion('model', [
  z.object({
    model: z.literal('doubao-seedance-1-0-lite-t2v-250428'),
    id: z.string(),
  }),
]);

export interface T2vGetResultResponse {
  id: string;
  model: string;
  status: 'queued' | 'running' | 'cancelled' | 'succeeded' | 'failed';
  content: { video_url: string };
  seed: number;
  resolution: '720p';
  duration: number;
  ratio: string;
  framespersecond: number;
  usage: {
    completion_tokens: number;
    total_tokens: number;
  };
  created_at: number;
  updated_at: number;
  error: { code: string; message: string } | null;
}

// 图生视频参数（基于首帧）
export const i2vSubmitParamsSchema = z.discriminatedUnion('model', [
  z.object({
    model: z.literal('doubao-seedance-1-0-lite-i2v-250428'),
    prompt: z.string(),
    image_url: z.string(),
    resolution: z.enum(['720p']).default('720p'),
    duration: z.number().int().min(5).max(5).default(5),
    ratio: z.enum(['16:9', '9:16', '4:3', '3:4']).default('16:9'),
    fps: z.number().int().min(24).max(24).default(24),
    seed: z.number().default(-1),
    watermark: z.boolean().default(true),
    callback_url: z.string().optional(),
  }),
  z.object({
    model: z.literal('doubao-seedance-1-0-pro-250528'),
    prompt: z.string(),
    image_url: z.string(),
    resolution: z.enum(['720p']).default('720p'),
    duration: z.number().int().min(5).max(5).default(5),
    ratio: z.enum(['16:9', '9:16', '4:3', '3:4']).default('16:9'),
    fps: z.number().int().min(24).max(24).default(24),
    seed: z.number().default(-1),
    watermark: z.boolean().default(true),
    callback_url: z.string().optional(),
  }),
]);

export interface I2vSubmitResponse {
  id: string;
}

export const i2vGetResultParamsSchema = z.discriminatedUnion('model', [
  z.object({
    model: z.literal('doubao-seedance-1-0-lite-i2v-250428'),
    id: z.string(),
  }),
]);

export interface I2vGetResultResponse {
  id: string;
  model: string;
  status: 'queued' | 'running' | 'cancelled' | 'succeeded' | 'failed';
  content: { video_url: string };
  seed: number;
  resolution: '720p';
  duration: number;
  ratio: string;
  framespersecond: number;
  usage: {
    completion_tokens: number;
    total_tokens: number;
  };
  created_at: number;
  updated_at: number;
  error: { code: string; message: string } | null;
}

// 图生视频参数（基于首尾帧）
export const kf2vSubmitParamsSchema = z.discriminatedUnion('model', [
  z.object({
    model: z.literal('doubao-seedance-1-0-lite-i2v-250428'),
    prompt: z.string(),
    first_frame_url: z.string(),
    last_frame_url: z.string(),
    resolution: z.enum(['720p']).default('720p'),
    duration: z.number().int().min(5).max(5).default(5),
    ratio: z.enum(['16:9', '9:16', '4:3', '3:4']).default('16:9'),
    fps: z.number().int().min(24).max(24).default(24),
    seed: z.number().default(-1),
    watermark: z.boolean().default(true),
    callback_url: z.string().optional(),
  }),
]);

export interface Kf2vSubmitResponse {
  id: string;
}

export const kf2vGetResultParamsSchema = z.discriminatedUnion('model', [
  z.object({
    model: z.literal('doubao-seedance-1-0-lite-i2v-250428'),
    id: z.string(),
  }),
]);

export interface Kf2vGetResultResponse {
  id: string;
  model: string;
  status: 'queued' | 'running' | 'cancelled' | 'succeeded' | 'failed';
  content: { video_url: string };
  seed: number;
  resolution: '720p';
  duration: number;
  ratio: string;
  framespersecond: number;
  usage: {
    completion_tokens: number;
    total_tokens: number;
  };
  created_at: number;
  updated_at: number;
  error: { code: string; message: string } | null;
}

const doubaoSeedream30T2iAsyncTaskManager = new ToAsyncTaskManager<Awaited<ReturnType<VolcengineArkService['seedream30T2i']>>>();
const doubaoSeedEdit30I2iAsyncTaskManager = new ToAsyncTaskManager<Awaited<ReturnType<VolcengineArkService['seedEdit30I2i']>>>();

export class DoubaoService {
  private readonly arkService: VolcengineArkService;

  constructor(config: z.infer<typeof volcengineArkServiceConfigSchema>) {
    this.arkService = new VolcengineArkService(config);
  }

  /**
   * 文生图
   */
  async t2iSubmit(params: z.infer<typeof t2iSubmitParamsSchema>): Promise<T2iSubmitResponse> {
    if (params.model === 'doubao-seedream-3-0-t2i-250415') {
      const task = doubaoSeedream30T2iAsyncTaskManager.addTask(this.arkService.seedream30T2i({ ...params }));
      return { task_id: task.id };
    }
    throw new Error('Invalid model');
  }

  async t2iGetResult(params: z.infer<typeof t2iGetResultParamsSchema>): Promise<T2iGetResultResponse> {
    if (params.model === 'doubao-seedream-3-0-t2i-250415') {
      const task = doubaoSeedream30T2iAsyncTaskManager.getTask(params.id);
      if (!task) {
        throw new Error('Task not found');
      }
      if (task.status === 'pending') {
        return {
          model: 'doubao-seedream-3-0-t2i-250415',
          created: task.created,
          status: 'running',
          data: [],
          usage: {
            generated_images: 0,
            output_tokens: 0,
            total_tokens: 0,
          },
        };
      }
      if (task.status === 'succeeded') {
        return {
          model: 'doubao-seedream-3-0-t2i-250415',
          created: task.created,
          status: 'succeeded',
          data: task.result.data,
          usage: task.result.usage,
        };
      }
      if (task.status === 'failed') {
        return {
          model: 'doubao-seedream-3-0-t2i-250415',
          created: task.created,
          status: 'failed',
          data: [],
          usage: {
            generated_images: 0,
            output_tokens: 0,
            total_tokens: 0,
          },
        };
      }
      throw new Error('Invalid task status');
    }
    throw new Error('Invalid model');
  }

  /**
   * 图生图
   */
  async i2iSubmit(params: z.infer<typeof i2iSubmitParamsSchema>): Promise<I2iSubmitResponse> {
    if (params.model === 'doubao-seededit-3-0-i2i-250628') {
      const task = doubaoSeedEdit30I2iAsyncTaskManager.addTask(this.arkService.seedEdit30I2i(params));
      return { task_id: task.id };
    }
    throw new Error('Invalid model');
  }

  async i2iGetResult(params: z.infer<typeof i2iGetResultParamsSchema>): Promise<I2iGetResultResponse> {
    const task = doubaoSeedEdit30I2iAsyncTaskManager.getTask(params.id);
    if (!task) {
      throw new Error('Task not found');
    }
    if (task.status === 'pending') {
      return {
        model: 'doubao-seededit-3-0-i2i-250628',
        created: task.created.getTime(),
        status: 'running',
        data: [],
        usage: {
          generated_images: 0,
          output_tokens: 0,
          total_tokens: 0,
        },
      };
    }
    if (task.status === 'succeeded') {
      return {
        model: 'doubao-seededit-3-0-i2i-250628',
        created: task.created.getTime(),
        status: 'succeeded',
        data: task.result.data,
        usage: task.result.usage,
      };
    }
    if (task.status === 'failed') {
      return {
        model: 'doubao-seededit-3-0-i2i-250628',
        created: task.created.getTime(),
        status: 'failed',
        data: [],
        usage: {
          generated_images: 0,
          output_tokens: 0,
          total_tokens: 0,
        },
      };
    }
    throw new Error('Invalid task status');
  }

  /**
   * 文生视频
   */
  async t2vSubmit(params: z.infer<typeof t2vSubmitParamsSchema>): Promise<T2vSubmitResponse> {
    if (params.model === 'doubao-seedance-1-0-lite-t2v-250428' || params.model === 'doubao-seedance-1-0-pro-250528') {
      const content = [
        {
          type: 'text' as const,
          text: `${params.prompt} --rs ${params.resolution} --rt ${params.ratio} --dur ${params.duration} --fps ${params.fps} --wm ${params.watermark} --seed ${params.seed}`,
        },
      ];

      return this.arkService.seedanceSubmit({
        model: params.model,
        content,
        callback_url: params.callback_url,
      });
    }
    throw new Error('Invalid model');
  }

  async t2vGetResult(params: z.infer<typeof t2vGetResultParamsSchema>): Promise<T2vGetResultResponse> {
    if (params.model === 'doubao-seedance-1-0-lite-t2v-250428' || params.model === 'doubao-seedance-1-0-pro-250528') {
      return this.arkService.seedanceGetResult({
        id: params.id,
      });
    }
    throw new Error('Invalid model');
  }

  /**
   * 图生视频（基于首帧）
   */
  async i2vSubmit(params: z.infer<typeof i2vSubmitParamsSchema>): Promise<I2vSubmitResponse> {
    if (params.model === 'doubao-seedance-1-0-lite-i2v-250428' || params.model === 'doubao-seedance-1-0-pro-250528') {
      const content = [
        {
          type: 'text' as const,
          text: `${params.prompt} --rs ${params.resolution} --rt ${params.ratio} --dur ${params.duration} --fps ${params.fps} --wm ${params.watermark} --seed ${params.seed}`,
        },
        { type: 'image' as const, image_url: { url: params.image_url }, role: 'first_frame' as const },
      ];

      return this.arkService.seedanceSubmit({
        model: params.model,
        content,
        callback_url: params.callback_url,
      });
    }
    throw new Error('Invalid model');
  }

  async i2vGetResult(params: z.infer<typeof i2vGetResultParamsSchema>): Promise<I2vGetResultResponse> {
    if (params.model === 'doubao-seedance-1-0-lite-i2v-250428' || params.model === 'doubao-seedance-1-0-pro-250528') {
      return this.arkService.seedanceGetResult({
        id: params.id,
      });
    }
    throw new Error('Invalid model');
  }

  /**
   * 图生视频（基于首尾帧）
   */
  async kf2vSubmit(params: z.infer<typeof kf2vSubmitParamsSchema>): Promise<Kf2vSubmitResponse> {
    if (params.model === 'doubao-seedance-1-0-lite-i2v-250428') {
      const content = [
        {
          type: 'text' as const,
          text: `${params.prompt} --rs ${params.resolution} --rt ${params.ratio} --dur ${params.duration} --fps ${params.fps} --wm ${params.watermark} --seed ${params.seed}`,
        },
        { type: 'image' as const, image_url: { url: params.first_frame_url }, role: 'first_frame' as const },
        { type: 'image' as const, image_url: { url: params.last_frame_url }, role: 'last_frame' as const },
      ];

      return this.arkService.seedanceSubmit({
        model: params.model,
        content,
        callback_url: params.callback_url,
      });
    }
    throw new Error('Invalid model');
  }

  async kf2vGetResult(params: z.infer<typeof kf2vGetResultParamsSchema>): Promise<Kf2vGetResultResponse> {
    if (params.model === 'doubao-seedance-1-0-lite-i2v-250428') {
      return this.arkService.seedanceGetResult({
        id: params.id,
      });
    }
    throw new Error('Invalid model');
  }
}
