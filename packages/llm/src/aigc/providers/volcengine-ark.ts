import z from 'zod';

export const seedEdit30I2iParamsSchema = z.object({
  model: z.literal('doubao-seededit-3-0-i2i-250628'),
  prompt: z.string(),
  image: z.string(),
  response_format: z.enum(['url', 'b64_json']).default('url'),
  size: z.literal('adaptive').default('adaptive'),
  seed: z.number().default(-1),
  guidance_scale: z.number().min(1).max(10).default(5.5),
  watermark: z.boolean().default(true),
});

export interface SeedEdit30I2iResponse {
  model: 'doubao-seededit-3-0-i2i-250628';
  created: number;
  data: [{ url: string }];
  usage: {
    generated_images: number;
    output_tokens: number;
    total_tokens: number;
  };
}

export const seedance10ProSubmitParamsSchema = z.object({
  model: z.enum(['doubao-seedance-1-0-pro-250528', 'doubao-seedance-1-0-lite-t2v-250428', 'doubao-seedance-1-0-lite-i2v-250428']),
  /** 模型有文本命令，如 --rs 720p --rt 16:9 --dur 5 --fps 24 --wm true --seed 11 --cf false */
  content: z.array(
    z.discriminatedUnion('type', [
      z.object({ type: z.literal('text'), text: z.string() }),
      z.object({ type: z.literal('image'), image_url: z.object({ url: z.string() }), role: z.enum(['first_frame', 'last_frame']) }),
    ]),
  ),
  callback_url: z.string().optional(),
});

export interface Seedance10ProSubmitResponse {
  id: string;
}

export const seedance10ProGetResultParamsSchema = z.object({
  id: z.string(),
});

export interface Seedance10ProGetResultResponse {
  id: string;
  model: 'doubao-seedance-1-0-pro-250528' | 'doubao-seedance-1-0-lite-t2v-250428' | 'doubao-seedance-1-0-lite-i2v-250428';
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

export const seedream30T2iParamsSchema = z.object({
  model: z.literal('doubao-seedream-3-0-t2i-250415'),
  prompt: z.string(),
  response_format: z.enum(['url', 'b64_json']).default('url').optional(),
  size: z.enum(['1024x1024', '864x1152', '1152x864', '1280x720', '720x1280', '832x1248', '1248x832', '1512x648']).default('1024x1024'),
  seed: z.number().default(-1).optional(),
  guidance_scale: z.number().min(1).max(10).default(2.5).optional(),
  watermark: z.boolean().default(true).optional(),
});

export interface Seedream30T2iResponse {
  model: 'doubao-seedream-3-0-t2i-250415';
  created: number;
  data: { url: string }[];
  usage: {
    generated_images: number;
    output_tokens: number;
    total_tokens: number;
  };
}

export const volcengineArkServiceConfigSchema = z.object({
  apiKey: z.string(),
});

export class VolcengineArkProvider {
  private readonly apiKey: string;

  constructor(config: z.infer<typeof volcengineArkServiceConfigSchema>) {
    this.apiKey = config.apiKey;
  }

  /**
   * 豆包视频生成API，包含多个版本的模型
   * Seedance 1.0 Pro | Seedance 1.0 Lite T2V | Seedance 1.0 Lite I2V
   * doubao-seaweed-241128 官网标记为【下线中】，故不再支持
   * https://www.volcengine.com/docs/82379/1330310#%E8%A7%86%E9%A2%91%E7%94%9F%E6%88%90%E8%83%BD%E5%8A%9B
   */
  async seedanceSubmit(params: z.infer<typeof seedance10ProSubmitParamsSchema>): Promise<Seedance10ProSubmitResponse> {
    const url = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks';
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(params),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
    return response.json();
  }

  async seedanceGetResult(params: z.infer<typeof seedance10ProGetResultParamsSchema>): Promise<Seedance10ProGetResultResponse> {
    const url = `https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/${params.id}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
    return response.json();
  }

  /**
   * 图片生成API/图片编辑 SeedEdit 3.0 I2I
   * https://www.volcengine.com/docs/82379/1666946
   */
  async seedEdit30I2i(params: z.infer<typeof seedEdit30I2iParamsSchema>): Promise<SeedEdit30I2iResponse> {
    const url = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(params),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
    return response.json();
  }

  /**
   * 图片生成API/文生图 Seedream 3.0 T2I
   * https://www.volcengine.com/docs/82379/1541523
   */
  async seedream30T2i(params: z.infer<typeof seedream30T2iParamsSchema>): Promise<Seedream30T2iResponse> {
    const url = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(params),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
    return response.json();
  }
}
